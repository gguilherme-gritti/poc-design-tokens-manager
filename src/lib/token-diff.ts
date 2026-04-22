import type { TokenTreeData } from '@/components/token-tree';
import { isLeafObject } from '@/lib/token-mutations';

export interface TokenDiffEntry {
  path: string;
  kind: 'added' | 'removed' | 'modified';
  before?: unknown;
  after?: unknown;
}

/**
 * Achata a árvore em `Map<path, value>` considerando somente folhas (objetos com `value`).
 * Nós branch apenas servem como namespaces aqui — mudanças estruturais são inferidas
 * a partir da presença/ausência de folhas.
 */
export function flattenLeaves(tree: TokenTreeData): Map<string, unknown> {
  const map = new Map<string, unknown>();
  walk(tree, '', map);
  return map;
}

function walk(
  value: unknown,
  path: string,
  sink: Map<string, unknown>,
): void {
  if (typeof value !== 'object' || value === null) return;
  if (isLeafObject(value)) {
    sink.set(path, value);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    walk(child, path ? `${path}.${key}` : key, sink);
  }
}

/**
 * Comparação estrutural rasa entre duas árvores. Considera uma folha "modificada" apenas
 * se o JSON dela (value + attributes etc.) mudou.
 */
export function diffTrees(
  before: TokenTreeData,
  after: TokenTreeData,
): TokenDiffEntry[] {
  const left = flattenLeaves(before);
  const right = flattenLeaves(after);
  const entries: TokenDiffEntry[] = [];
  const seen = new Set<string>();

  for (const [path, a] of left) {
    seen.add(path);
    if (!right.has(path)) {
      entries.push({ path, kind: 'removed', before: a });
      continue;
    }
    const b = right.get(path);
    if (!deepEqual(a, b)) {
      entries.push({ path, kind: 'modified', before: a, after: b });
    }
  }
  for (const [path, b] of right) {
    if (seen.has(path)) continue;
    entries.push({ path, kind: 'added', after: b });
  }
  entries.sort((x, y) => x.path.localeCompare(y.path));
  return entries;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const entriesA = Object.entries(a as Record<string, unknown>);
  const entriesB = Object.entries(b as Record<string, unknown>);
  if (entriesA.length !== entriesB.length) return false;
  const bMap = new Map(entriesB);
  for (const [key, value] of entriesA) {
    if (!bMap.has(key)) return false;
    if (!deepEqual(value, bMap.get(key))) return false;
  }
  return true;
}
