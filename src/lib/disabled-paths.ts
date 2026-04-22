/**
 * Utilitários para o "soft delete" de tokens: um token (ou branch) pode ser marcado
 * como desabilitado sem ser removido da árvore. A estrutura canônica é um
 * `Record<string, true>` — paths que o usuário marcou diretamente como desabilitados.
 *
 * Um token é considerado:
 * - `directlyDisabled`: seu próprio path está no record.
 * - `effectivelyDisabled`: ele ou QUALQUER ancestral está marcado. Ou seja, basta
 *   o ancestral estar disabled para o descendente ser tratado como disabled na UI.
 */

export type DisabledMap = Record<string, true>;

export function isDirectlyDisabled(
  map: DisabledMap | undefined,
  path: string,
): boolean {
  if (!map) return false;
  return map[path] === true;
}

export function isEffectivelyDisabled(
  map: DisabledMap | undefined,
  path: string,
): boolean {
  if (!map) return false;
  if (map[path] === true) return true;
  let current = path;
  while (current.includes('.')) {
    current = current.slice(0, current.lastIndexOf('.'));
    if (map[current] === true) return true;
  }
  return false;
}

/**
 * Retorna um NOVO map com todas as entradas que são descendentes (ou o próprio) do path.
 * Útil se o usuário remover um branch disabled — nenhum descendente deveria continuar marcado
 * (mas como o branch ancestral pai ainda está efetivamente disabled, isso normalmente é
 * auto-resolvido).
 */
export function pruneDescendants(
  map: DisabledMap,
  path: string,
): DisabledMap {
  const next: DisabledMap = {};
  const prefix = `${path}.`;
  for (const key of Object.keys(map)) {
    if (key === path) continue;
    if (key.startsWith(prefix)) continue;
    next[key] = true;
  }
  return next;
}
