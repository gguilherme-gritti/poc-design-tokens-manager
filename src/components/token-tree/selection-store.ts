import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Store externa de seleção com pub/sub.
 *
 * Motivação: se o `selectedPath` vivesse em contexto/`useState` normal, toda mudança de seleção
 * dispararia re-render em toda a árvore. Como cada folha se inscreve apenas no seu próprio
 * valor derivado (`isSelected`), o `useSyncExternalStore` só re-renderiza o nó que entrou
 * ou saiu da seleção (duas re-renderizações por clique, independentemente do tamanho da árvore).
 */
export interface SelectionStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => string | null;
  select: (path: string | null) => void;
}

export function createSelectionStore(initial: string | null = null): SelectionStore {
  let selected = initial;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return selected;
    },
    select(path) {
      if (selected === path) return;
      selected = path;
      listeners.forEach((l) => l());
    },
  };
}

export const SelectionStoreContext = createContext<SelectionStore | null>(null);

function useSelectionStore(): SelectionStore {
  const store = useContext(SelectionStoreContext);
  if (!store) {
    throw new Error('useSelectionStore precisa estar dentro de <SelectionStoreContext.Provider>');
  }
  return store;
}

/**
 * Hook otimizado: re-renderiza o consumidor SOMENTE quando o boolean `isSelected(path)` muda.
 */
export function useIsSelected(path: string): boolean {
  const store = useSelectionStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot() === path,
    () => false,
  );
}
