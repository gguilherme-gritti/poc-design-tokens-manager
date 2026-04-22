import { createContext, useContext } from 'react';

import type {
  DiagnosticSeverity,
  TokenDiagnostic,
} from '@/lib/token-diagnostics';

export interface DiagnosticsContextValue {
  /** Diagnósticos agrupados pelo `path` da folha. */
  byPath: Map<string, TokenDiagnostic[]>;
  /** Severidade propagada para cada branch ancestral (útil para destacar grupos). */
  rollupByPath: Map<string, DiagnosticSeverity>;
}

const EMPTY: DiagnosticsContextValue = {
  byPath: new Map(),
  rollupByPath: new Map(),
};

export const DiagnosticsContext =
  createContext<DiagnosticsContextValue>(EMPTY);

export function useDiagnosticsForPath(path: string): TokenDiagnostic[] {
  const ctx = useContext(DiagnosticsContext);
  return ctx.byPath.get(path) ?? [];
}

export function useBranchDiagnosticSeverity(
  path: string,
): DiagnosticSeverity | null {
  const ctx = useContext(DiagnosticsContext);
  return ctx.rollupByPath.get(path) ?? null;
}
