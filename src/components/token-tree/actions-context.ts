import { createContext, useContext } from 'react';

export interface TokenTreeActions {
  /** Disparado ao clicar em "+" num branch. Recebe o path do branch pai. */
  onAddChild?: (branchPath: string) => void;
  /** Disparado ao clicar em "remover" inline num nó (folha ou branch). */
  onRequestRemove?: (path: string) => void;
}

export const TokenTreeActionsContext = createContext<TokenTreeActions>({});

export function useTokenTreeActions(): TokenTreeActions {
  return useContext(TokenTreeActionsContext);
}
