import { createContext, useContext } from 'react';

export interface TokenTreeActions {
  /** Disparado ao clicar em "+" num branch. Recebe o path do branch pai. */
  onAddChild?: (branchPath: string) => void;
  /**
   * Disparado ao clicar no toggle de "desabilitar/reabilitar" (soft delete).
   * Não remove o nó — apenas alterna a flag disabled.
   */
  onToggleDisabled?: (path: string) => void;
}

export const TokenTreeActionsContext = createContext<TokenTreeActions>({});

export function useTokenTreeActions(): TokenTreeActions {
  return useContext(TokenTreeActionsContext);
}
