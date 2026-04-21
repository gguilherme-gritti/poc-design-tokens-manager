import type { TokenLeafNode, TokenNode } from './types';

/**
 * Índice invertido de tokens, pronto para resolver aliases (`{color.grey.500}`).
 *
 * Estratégia: para cada folha indexamos TODOS os sufixos dotted do seu `path`.
 * Assim, uma referência como `{color.grey.500}` (que no dicionário aparece sob
 * `global.colors.color.grey.500`) é encontrada diretamente, sem precisar conhecer
 * os prefixos de namespace (`global.colors`, `global.shape`, `global.type`...).
 *
 * Em caso de colisão, a primeira ocorrência vence — o que na prática dá preferência
 * ao token "mais próximo" da raiz.
 */
export type TokenIndex = Map<string, TokenLeafNode>;

export function buildTokenIndex(nodes: TokenNode[]): TokenIndex {
  const index: TokenIndex = new Map();
  const stack: TokenNode[] = [...nodes];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.kind === 'branch') {
      for (const child of node.children) stack.push(child);
      continue;
    }
    const parts = node.path.split('.');
    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(i).join('.');
      if (!index.has(key)) index.set(key, node);
    }
  }
  return index;
}

const ALIAS_STRICT_REGEX = /^\s*\{([^{}]+)\}\s*$/;
const REFERENCE_REGEX = /\{([^{}]+)\}/g;

/**
 * Resolve `{token.path}` para a folha correspondente, seguindo cadeias de aliases.
 */
function followAlias(
  path: string,
  index: TokenIndex,
  seen = new Set<string>(),
): TokenLeafNode | null {
  if (seen.has(path)) return null;
  seen.add(path);
  const hit = index.get(path);
  if (!hit) return null;
  if (typeof hit.value === 'string') {
    const match = ALIAS_STRICT_REGEX.exec(hit.value);
    if (match) {
      const next = followAlias(match[1].trim(), index, seen);
      if (next) return next;
    }
  }
  return hit;
}

export function resolveAlias(aliasExpr: string, index: TokenIndex): TokenLeafNode | null {
  const match = ALIAS_STRICT_REGEX.exec(aliasExpr);
  if (!match) return null;
  return followAlias(match[1].trim(), index);
}

/**
 * Substitui `{x.y.z}` inline pelo valor primitivo resolvido.
 * Útil para valores que embutem várias referências (ex.: shadows, text-styles):
 * `"0px 4px 16px -2px rgb({color.grey.900-rgb} / {opacity.low})"`
 *   → `"0px 4px 16px -2px rgb(130 138 130 / 0.16)"`
 */
export function resolveValue(value: unknown, index: TokenIndex, depth = 0): unknown {
  if (depth > 10) return value;
  if (typeof value !== 'string' || !value.includes('{')) return value;
  return value.replace(REFERENCE_REGEX, (_, path: string) => {
    const leaf = followAlias(path.trim(), index);
    if (!leaf) return `{${path}}`;
    const inner = resolveValue(leaf.value, index, depth + 1);
    return typeof inner === 'string' ? inner : String(inner);
  });
}
