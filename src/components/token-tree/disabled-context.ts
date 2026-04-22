import { createContext, useContext, useMemo } from 'react';

import {
  isDirectlyDisabled,
  isEffectivelyDisabled,
  type DisabledMap,
} from '@/lib/disabled-paths';

/**
 * Estado de "soft-delete" propagado do `DesignSystemTokensPage` → `TokenTree` → nós.
 * Um path neste map está **diretamente** desabilitado (view-only). Descendentes
 * herdam essa condição de forma automática via `isEffectivelyDisabled`.
 */
export const DisabledContext = createContext<DisabledMap>({});

export function useDisabledMap(): DisabledMap {
  return useContext(DisabledContext);
}

export interface PathDisabledState {
  /** O path exato foi marcado como disabled pelo usuário. */
  directly: boolean;
  /** O path (ou algum ancestral) está disabled — exibir estilo view-only. */
  effectively: boolean;
}

/**
 * Hook que retorna, em uma única chamada, se o path em questão está disabled
 * diretamente e/ou efetivamente (via ancestral). Memoiza o resultado para
 * evitar re-renders desnecessários.
 */
export function usePathDisabledState(path: string): PathDisabledState {
  const map = useDisabledMap();
  return useMemo(
    () => ({
      directly: isDirectlyDisabled(map, path),
      effectively: isEffectivelyDisabled(map, path),
    }),
    [map, path],
  );
}
