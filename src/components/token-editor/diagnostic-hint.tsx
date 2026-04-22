import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

import type {
  DiagnosticSeverity,
  TokenDiagnostic,
} from '@/lib/token-diagnostics';
import { cn } from '@/lib/utils';

interface DiagnosticHintProps {
  diagnostics: TokenDiagnostic[];
  onPickSuggestion?: (suggestion: string) => void;
}

const STYLES: Record<DiagnosticSeverity, string> = {
  error:
    'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400',
  warning:
    'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
  info: 'border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400',
};

function SeverityIcon({ severity }: { severity: DiagnosticSeverity }) {
  if (severity === 'error')
    return <AlertCircle className="mt-0.5 size-3.5 shrink-0" />;
  if (severity === 'warning')
    return <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />;
  return <Info className="mt-0.5 size-3.5 shrink-0" />;
}

export function DiagnosticHint({
  diagnostics,
  onPickSuggestion,
}: DiagnosticHintProps) {
  if (diagnostics.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {diagnostics.map((d, i) => (
        <div
          key={i}
          className={cn(
            'flex flex-col gap-1 rounded-md border px-3 py-2 text-xs',
            STYLES[d.severity],
          )}
        >
          <div className="flex items-start gap-2">
            <SeverityIcon severity={d.severity} />
            <span className="leading-relaxed">{d.message}</span>
          </div>
          {d.suggestions && d.suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[10px] opacity-75">
                Sugestões:
              </span>
              {d.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onPickSuggestion?.(s)}
                  className="bg-background/60 hover:bg-background rounded-sm border px-1.5 py-0.5 font-mono text-[10px]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
