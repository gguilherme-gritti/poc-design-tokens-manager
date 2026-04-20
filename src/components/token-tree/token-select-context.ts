import { createContext } from 'react';

import type { TokenSelectHandler } from './types';

/**
 * Contexto separado APENAS para o callback `onTokenSelect`.
 * Mantido estável (useCallback no root) para não invalidar os `React.memo` da árvore.
 */
export const TokenSelectContext = createContext<TokenSelectHandler | null>(null);
