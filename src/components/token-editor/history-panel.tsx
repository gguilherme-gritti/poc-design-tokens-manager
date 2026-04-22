import { useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  History as HistoryIcon,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { diffTrees, type TokenDiffEntry } from '@/lib/token-diff';
import { cn } from '@/lib/utils';
import type { HistoryEntry } from '@/stores/design-system-store';

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestore: (entryId: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function stringifyValue(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === undefined) return '—';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function HistoryPanel({ history, onRestore }: HistoryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    history[0]?.id ?? null,
  );

  const selected = useMemo(
    () => history.find((h) => h.id === selectedId) ?? history[0] ?? null,
    [history, selectedId],
  );

  const diff = useMemo<TokenDiffEntry[]>(() => {
    if (!selected) return [];
    return diffTrees(selected.snapshotBefore, selected.snapshotAfter);
  }, [selected]);

  if (history.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-12 text-sm">
        <HistoryIcon className="size-8 opacity-40" />
        <p>Nenhum commit ainda. Salve alterações para gerar o histórico.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[260px,1fr]">
      <aside className="flex flex-col gap-1">
        {history.map((entry) => {
          const active = entry.id === selected?.id;
          const counts = summarizeChangeCounts(entry);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className={cn(
                'hover:bg-accent flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                active && 'border-primary/40 bg-accent',
              )}
            >
              <span className="font-medium">
                {entry.label ?? `Commit ${entry.id.slice(0, 6)}`}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {formatDate(entry.timestamp)}
              </span>
              <div className="flex flex-wrap gap-1 pt-1">
                {counts.add > 0 && (
                  <Badge variant="success">+{counts.add}</Badge>
                )}
                {counts.update > 0 && (
                  <Badge variant="info">~{counts.update}</Badge>
                )}
                {counts.remove > 0 && (
                  <Badge variant="destructive">−{counts.remove}</Badge>
                )}
                {counts.rename > 0 && (
                  <Badge variant="warning">↻{counts.rename}</Badge>
                )}
                {counts.disable > 0 && (
                  <Badge variant="warning">
                    <EyeOff className="size-2.5" />
                    {counts.disable}
                  </Badge>
                )}
                {counts.enable > 0 && (
                  <Badge variant="success">
                    <Eye className="size-2.5" />
                    {counts.enable}
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </aside>

      <section className="flex min-w-0 flex-col gap-3">
        {selected && (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold">
                  {selected.label ?? `Commit ${selected.id.slice(0, 6)}`}
                </h3>
                <span className="text-muted-foreground text-xs">
                  {formatDate(selected.timestamp)} — {diff.length} arquivo(s)
                  afetado(s)
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRestore(selected.id)}
              >
                <RotateCcw className="size-3.5" />
                Restaurar este estado
              </Button>
            </header>

            <DiffList diff={diff} />
          </>
        )}
      </section>
    </div>
  );
}

function summarizeChangeCounts(entry: HistoryEntry) {
  const counts = {
    add: 0,
    remove: 0,
    update: 0,
    rename: 0,
    disable: 0,
    enable: 0,
  };
  for (const c of entry.changes) {
    if (c.kind === 'toggle-disabled') {
      if (c.disabled) counts.disable += 1;
      else counts.enable += 1;
    } else {
      counts[c.kind] += 1;
    }
  }
  return counts;
}

function DiffList({ diff }: { diff: TokenDiffEntry[] }) {
  if (diff.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-xs">
        Este commit não alterou valores de folhas da árvore.
      </p>
    );
  }
  return (
    <ul className="flex max-h-[480px] flex-col gap-2 overflow-auto pr-1">
      {diff.map((entry) => (
        <li
          key={entry.path}
          className="bg-background rounded-md border p-2.5 text-[11px]"
        >
          <div className="flex items-center gap-2">
            <DiffBadge kind={entry.kind} />
            <code className="font-mono">{entry.path}</code>
          </div>
          {entry.kind === 'modified' && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-sm border border-red-500/30 bg-red-500/5 p-2">
                <div className="mb-1 text-[9px] uppercase opacity-75">antes</div>
                <pre className="whitespace-pre-wrap break-words">
                  {stringifyValue(entry.before)}
                </pre>
              </div>
              <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/5 p-2">
                <div className="mb-1 text-[9px] uppercase opacity-75">depois</div>
                <pre className="whitespace-pre-wrap break-words">
                  {stringifyValue(entry.after)}
                </pre>
              </div>
            </div>
          )}
          {entry.kind === 'added' && (
            <pre className="bg-emerald-500/5 mt-2 rounded-sm border border-emerald-500/30 p-2 text-[10px]">
              {stringifyValue(entry.after)}
            </pre>
          )}
          {entry.kind === 'removed' && (
            <pre className="bg-red-500/5 mt-2 rounded-sm border border-red-500/30 p-2 text-[10px]">
              {stringifyValue(entry.before)}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}

function DiffBadge({ kind }: { kind: TokenDiffEntry['kind'] }) {
  if (kind === 'added')
    return (
      <Badge variant="success">
        <Plus className="size-3" /> added
      </Badge>
    );
  if (kind === 'removed')
    return (
      <Badge variant="destructive">
        <Minus className="size-3" /> removed
      </Badge>
    );
  return (
    <Badge variant="info">
      <Pencil className="size-3" /> modified
    </Badge>
  );
}
