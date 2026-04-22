import type {
  TokenLeafNode,
  TokenNode,
} from '@/components/token-tree';
import type { TokenIndex } from '@/components/token-tree';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type DiagnosticCode =
  | 'alias-target-missing'
  | 'alias-out-of-scope'
  | 'circular-alias'
  | 'inline-reference-missing';

export interface TokenDiagnostic {
  path: string;
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  /** Referências (tokens) candidatas via fuzzy match. */
  suggestions?: string[];
}

const STRICT_ALIAS_REGEX = /^\s*\{([^{}]+)\}\s*$/;
const INLINE_REF_REGEX = /\{([^{}]+)\}/g;
const BRANDS_PREFIX_REGEX = /(^|\.)brands(\.|$)/;
const ALLOWED_SCOPES = ['global.', 'mixins.'] as const;

function flattenLeaves(nodes: TokenNode[]): TokenLeafNode[] {
  const stack = [...nodes];
  const leaves: TokenLeafNode[] = [];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.kind === 'branch') {
      for (const child of node.children) stack.push(child);
    } else {
      leaves.push(node);
    }
  }
  return leaves;
}

/**
 * Distância de Levenshtein (iterativa, O(m*n)) limitada — usada apenas para sugestões
 * em cima de um index já pequeno, então não há preocupação de performance.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

export function suggestAliasPaths(
  query: string,
  index: TokenIndex,
  limit = 3,
): string[] {
  if (!query.trim()) return [];
  const keys = Array.from(index.keys());
  const scored: { key: string; score: number }[] = [];
  for (const key of keys) {
    const d = levenshtein(key, query);
    if (d <= Math.max(3, Math.floor(query.length * 0.4))) {
      scored.push({ key, score: d });
    }
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.key);
}

/**
 * Segue uma cadeia de alias partindo de um path (sem `{}`), detectando ciclos.
 * Retorna `{ leaf, cycle }`; `cycle=true` quando um ciclo foi detectado no caminho.
 */
function followAliasStrict(
  startPath: string,
  index: TokenIndex,
): { leaf: TokenLeafNode | null; cycle: boolean; missing: string | null } {
  const seen = new Set<string>();
  let current = startPath.trim();
  while (true) {
    if (seen.has(current)) return { leaf: null, cycle: true, missing: null };
    seen.add(current);
    const hit = index.get(current);
    if (!hit) return { leaf: null, cycle: false, missing: current };
    if (typeof hit.value === 'string') {
      const match = STRICT_ALIAS_REGEX.exec(hit.value);
      if (match) {
        current = match[1].trim();
        continue;
      }
    }
    return { leaf: hit, cycle: false, missing: null };
  }
}

function isInBrandsScope(path: string): boolean {
  return BRANDS_PREFIX_REGEX.test(path);
}

function isAllowedReferenceScope(targetPath: string): boolean {
  return ALLOWED_SCOPES.some((prefix) => targetPath.startsWith(prefix));
}

interface DiagnoseOptions {
  /** Se `true`, avalia inline references em strings compostas (ex.: `rgb({x} / {y})`). */
  checkInlineReferences?: boolean;
}

/**
 * Roda todas as regras conhecidas contra uma árvore + índice e devolve a lista de diagnósticos.
 */
export function diagnoseTree(
  nodes: TokenNode[],
  index: TokenIndex,
  options: DiagnoseOptions = { checkInlineReferences: true },
): TokenDiagnostic[] {
  const diagnostics: TokenDiagnostic[] = [];
  const leaves = flattenLeaves(nodes);
  const isBrandsScope = (p: string) => isInBrandsScope(p);

  for (const leaf of leaves) {
    const diag = diagnoseLeaf(leaf, index, {
      checkInlineReferences: options.checkInlineReferences,
      isBrandsScope,
    });
    diagnostics.push(...diag);
  }

  return diagnostics;
}

interface DiagnoseLeafContext {
  checkInlineReferences?: boolean;
  isBrandsScope: (path: string) => boolean;
}

/**
 * Diagnóstico específico para uma folha. Exposto para reuso no formulário de edição,
 * onde avaliamos o `value` em tempo real (antes de commitar na store).
 */
export function diagnoseLeaf(
  leaf: Pick<TokenLeafNode, 'path' | 'value'>,
  index: TokenIndex,
  context: DiagnoseLeafContext,
): TokenDiagnostic[] {
  const results: TokenDiagnostic[] = [];
  const { path, value } = leaf;
  const inBrands = context.isBrandsScope(path);

  if (typeof value !== 'string') {
    return results;
  }

  const strictMatch = STRICT_ALIAS_REGEX.exec(value);
  if (strictMatch) {
    const ref = strictMatch[1].trim();
    const { leaf: resolved, cycle, missing } = followAliasStrict(ref, index);

    if (cycle) {
      results.push({
        path,
        severity: 'error',
        code: 'circular-alias',
        message: `O alias "${value}" entra em um ciclo e não pode ser resolvido.`,
      });
      return results;
    }

    if (missing) {
      results.push({
        path,
        severity: 'error',
        code: 'alias-target-missing',
        message: `O token "${missing}" referenciado pelo alias não existe.`,
        suggestions: suggestAliasPaths(missing, index),
      });
      return results;
    }

    if (inBrands && resolved && !isAllowedReferenceScope(resolved.path)) {
      results.push({
        path,
        severity: 'warning',
        code: 'alias-out-of-scope',
        message: `Tokens em "brands" devem referenciar "global.*" ou "mixins.*" — este alias aponta para "${resolved.path}".`,
      });
    }
    return results;
  }

  if (!context.checkInlineReferences || !value.includes('{')) return results;

  INLINE_REF_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  const missingInline: string[] = [];
  while ((match = INLINE_REF_REGEX.exec(value)) !== null) {
    const ref = match[1].trim();
    const { missing, cycle } = followAliasStrict(ref, index);
    if (cycle) {
      results.push({
        path,
        severity: 'error',
        code: 'circular-alias',
        message: `O valor composto referencia um alias cíclico (${ref}).`,
      });
      continue;
    }
    if (missing) missingInline.push(missing);
  }

  if (missingInline.length) {
    results.push({
      path,
      severity: 'warning',
      code: 'inline-reference-missing',
      message: `Referências não encontradas no valor composto: ${missingInline.map((m) => `{${m}}`).join(', ')}.`,
      suggestions: missingInline.flatMap((m) => suggestAliasPaths(m, index)),
    });
  }

  return results;
}

/** Agrupa os diagnósticos por `path` para leitura O(1) em componentes da árvore. */
export function indexDiagnostics(
  diagnostics: TokenDiagnostic[],
): Map<string, TokenDiagnostic[]> {
  const map = new Map<string, TokenDiagnostic[]>();
  for (const d of diagnostics) {
    const bucket = map.get(d.path);
    if (bucket) bucket.push(d);
    else map.set(d.path, [d]);
  }
  return map;
}

/** "Rollup" de severidade: qualquer erro abaixo de um branch => error. */
export function rollupSeverityByBranch(
  diagnostics: TokenDiagnostic[],
): Map<string, DiagnosticSeverity> {
  const rollup = new Map<string, DiagnosticSeverity>();
  const severityRank: Record<DiagnosticSeverity, number> = {
    info: 0,
    warning: 1,
    error: 2,
  };
  const bump = (key: string, sev: DiagnosticSeverity) => {
    const prev = rollup.get(key);
    if (!prev || severityRank[sev] > severityRank[prev]) rollup.set(key, sev);
  };
  for (const d of diagnostics) {
    const segments = d.path.split('.');
    for (let i = 1; i <= segments.length; i++) {
      bump(segments.slice(0, i).join('.'), d.severity);
    }
  }
  return rollup;
}
