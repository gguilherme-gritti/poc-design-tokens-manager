import type { TokenTreeData } from '@/components/token-tree';

/**
 * Helpers para manipular a árvore de tokens a partir de paths "dotted" (`global.colors.color.grey.500`).
 *
 * A árvore é um JSON arbitrário onde:
 * - Um "branch" é um objeto sem a chave `value` (contém outros objetos).
 * - Uma "leaf" é um objeto que possui `value` (token final, podendo também ter `attributes`, `mobile`...).
 *
 * Todas as funções recebem e modificam um `draft` compatível com Immer — isto é, espera-se que
 * sejam chamadas dentro de um producer. Assinaturas retornam `void` para seguir o estilo Immer.
 */

export type PathSegments = readonly string[];

export interface TokenLeafObject {
  value: unknown;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * `global.colors.color.grey.500` -> ['global', 'colors', 'color', 'grey', '500']
 */
export function splitPath(path: string): string[] {
  return path.split('.').filter(Boolean);
}

export function joinPath(segments: PathSegments): string {
  return segments.join('.');
}

export function parentPath(path: string): string {
  const segments = splitPath(path);
  segments.pop();
  return joinPath(segments);
}

export function lastSegment(path: string): string {
  const segments = splitPath(path);
  return segments[segments.length - 1] ?? '';
}

/** Retorna o nó bruto em `path`, ou `undefined` se o caminho não existir. */
export function getAt(tree: TokenTreeData, path: string): unknown {
  const segments = splitPath(path);
  let cursor: unknown = tree;
  for (const segment of segments) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

export function existsAt(tree: TokenTreeData, path: string): boolean {
  return getAt(tree, path) !== undefined;
}

export function isLeafObject(value: unknown): value is TokenLeafObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, 'value')
  );
}

/**
 * Garante que todos os ancestrais do `path` existam como objetos (cria os que faltam).
 * Retorna o container direto (pai) do último segmento. Lança se encontrar uma folha no meio.
 */
function ensureParent(
  tree: TokenTreeData,
  segments: PathSegments,
): Record<string, unknown> {
  let cursor: Record<string, unknown> = tree as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    const next = cursor[key];
    if (next === undefined) {
      cursor[key] = {};
      cursor = cursor[key] as Record<string, unknown>;
      continue;
    }
    if (typeof next !== 'object' || next === null) {
      throw new Error(
        `Não é possível criar nó em "${joinPath(segments)}": o segmento "${key}" não é um branch.`,
      );
    }
    if (isLeafObject(next)) {
      throw new Error(
        `Não é possível criar nó em "${joinPath(segments)}": "${segments.slice(0, i + 1).join('.')}" já é uma folha.`,
      );
    }
    cursor = next as Record<string, unknown>;
  }
  return cursor;
}

/**
 * Atualiza o `value` de uma folha existente. Não cria folhas novas — use `addLeafAt` para isso.
 */
export function setLeafValueAt(
  tree: TokenTreeData,
  path: string,
  newValue: unknown,
): void {
  const node = getAt(tree, path);
  if (!isLeafObject(node)) {
    throw new Error(`"${path}" não é uma folha ou não existe.`);
  }
  (node as TokenLeafObject).value = newValue;
}

/**
 * Remove o nó (folha ou branch) em `path`.
 */
export function removeAt(tree: TokenTreeData, path: string): void {
  const segments = splitPath(path);
  if (segments.length === 0) return;
  const parentSegments = segments.slice(0, -1);
  const key = segments[segments.length - 1];
  const parent = parentSegments.length
    ? (getAt(tree, joinPath(parentSegments)) as Record<string, unknown> | undefined)
    : (tree as Record<string, unknown>);
  if (!parent || typeof parent !== 'object') return;
  delete parent[key];
}

/**
 * Adiciona um objeto arbitrário em `path`. Cria ancestrais que não existam.
 * Se já existir algo em `path`, lança.
 */
export function addAt(
  tree: TokenTreeData,
  path: string,
  node: unknown,
): void {
  const segments = splitPath(path);
  if (segments.length === 0) throw new Error('Path vazio.');
  const container = ensureParent(tree, segments);
  const key = segments[segments.length - 1];
  if (container[key] !== undefined) {
    throw new Error(`Já existe um token em "${path}".`);
  }
  container[key] = node;
}

export function addLeafAt(
  tree: TokenTreeData,
  path: string,
  value: unknown,
  attributes?: Record<string, unknown>,
): void {
  const leaf: TokenLeafObject = { value };
  if (attributes && Object.keys(attributes).length) {
    leaf.attributes = attributes;
  }
  addAt(tree, path, leaf);
}

export function addBranchAt(tree: TokenTreeData, path: string): void {
  addAt(tree, path, {});
}

/**
 * Renomeia o último segmento de `path` para `newName`. Mantém o valor intacto.
 * Observação: a ordem das chaves no JSON pode mudar (o nó renomeado tende a ir para o final).
 */
export function renameAt(
  tree: TokenTreeData,
  path: string,
  newName: string,
): string {
  const segments = splitPath(path);
  if (!segments.length) throw new Error('Path vazio.');
  const parentSegments = segments.slice(0, -1);
  const oldKey = segments[segments.length - 1];
  const parent = parentSegments.length
    ? (getAt(tree, joinPath(parentSegments)) as Record<string, unknown> | undefined)
    : (tree as Record<string, unknown>);
  if (!parent) throw new Error(`Pai de "${path}" não existe.`);
  if (!(oldKey in parent)) throw new Error(`"${path}" não existe.`);
  if (newName in parent) {
    throw new Error(`Já existe um nó chamado "${newName}" em ${parentSegments.join('.')}.`);
  }
  parent[newName] = parent[oldKey];
  delete parent[oldKey];
  return joinPath([...parentSegments, newName]);
}

/**
 * Conta quantas folhas descendentes existem a partir de `path`.
 * Útil para mensagens como "Remover 7 tokens?".
 */
export function countLeavesAt(tree: TokenTreeData, path: string): number {
  const node = getAt(tree, path);
  return countLeavesOf(node);
}

function countLeavesOf(value: unknown): number {
  if (typeof value !== 'object' || value === null) return 0;
  if (isLeafObject(value)) return 1;
  let total = 0;
  for (const child of Object.values(value as Record<string, unknown>)) {
    total += countLeavesOf(child);
  }
  return total;
}
