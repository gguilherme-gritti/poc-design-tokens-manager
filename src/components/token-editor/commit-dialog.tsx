import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Minus,
  Pencil,
  Plus,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TokenDiagnostic } from '@/lib/token-diagnostics';
import { cn } from '@/lib/utils';
import type { PendingChange } from '@/stores/design-system-store';

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingChanges: PendingChange[];
  diagnostics: TokenDiagnostic[];
  onConfirm: (label: string | undefined) => void;
  onDiscard: () => void;
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

/**
 * Dialog de revisão pré-commit. Lista todas as mudanças pendentes, destaca
 * diagnósticos remanescentes e permite nomear o commit antes de confirmar.
 */
export function CommitDialog({
  open,
  onOpenChange,
  pendingChanges,
  diagnostics,
  onConfirm,
  onDiscard,
}: CommitDialogProps) {
  const [label, setLabel] = useState('');

  const grouped = useMemo(() => {
    const out = {
      add: [] as PendingChange[],
      remove: [] as PendingChange[],
      update: [] as PendingChange[],
      rename: [] as PendingChange[],
      disable: [] as PendingChange[],
      enable: [] as PendingChange[],
    };
    for (const c of pendingChanges) {
      if (c.kind === 'toggle-disabled') {
        (c.disabled ? out.disable : out.enable).push(c);
      } else {
        out[c.kind].push(c);
      }
    }
    return out;
  }, [pendingChanges]);

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  const handleConfirm = () => {
    onConfirm(label.trim() || undefined);
    setLabel('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revisar alterações</DialogTitle>
          <DialogDescription>
            {pendingChanges.length} alteração(ões) pendente(s) serão registradas
            no histórico deste design system.
          </DialogDescription>
        </DialogHeader>

        {(errors.length > 0 || warnings.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {errors.length > 0 && (
              <Badge variant="destructive">
                <AlertCircle className="size-3" /> {errors.length} erro(s)
              </Badge>
            )}
            {warnings.length > 0 && (
              <Badge variant="warning">
                <AlertTriangle className="size-3" /> {warnings.length} aviso(s)
              </Badge>
            )}
          </div>
        )}

        <div className="flex max-h-80 flex-col gap-4 overflow-auto pr-1">
          <ChangeGroup
            title="Adicionados"
            icon={<Plus className="size-3.5 text-emerald-500" />}
            items={grouped.add}
            render={(c) =>
              c.kind === 'add' && (
                <div className="flex flex-col gap-1">
                  <code className="font-mono text-[11px]">{c.path}</code>
                  <pre className="bg-muted/40 rounded-sm border p-2 text-[10px] leading-relaxed">
                    {stringifyValue(c.token)}
                  </pre>
                </div>
              )
            }
          />
          <ChangeGroup
            title="Atualizados"
            icon={<Pencil className="size-3.5 text-sky-500" />}
            items={grouped.update}
            render={(c) =>
              c.kind === 'update' && (
                <div className="flex flex-col gap-1">
                  <code className="font-mono text-[11px]">{c.path}</code>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-sm border border-red-500/30 bg-red-500/5 p-2">
                      <div className="mb-1 text-[9px] uppercase opacity-75">
                        antes
                      </div>
                      <pre>{stringifyValue(c.before)}</pre>
                    </div>
                    <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/5 p-2">
                      <div className="mb-1 text-[9px] uppercase opacity-75">
                        depois
                      </div>
                      <pre>{stringifyValue(c.after)}</pre>
                    </div>
                  </div>
                </div>
              )
            }
          />
          <ChangeGroup
            title="Removidos"
            icon={<Minus className="size-3.5 text-red-500" />}
            items={grouped.remove}
            render={(c) =>
              c.kind === 'remove' && (
                <div className="flex flex-col gap-1">
                  <code className="font-mono text-[11px]">{c.path}</code>
                  <pre className="bg-muted/40 rounded-sm border p-2 text-[10px] leading-relaxed">
                    {stringifyValue(c.previous)}
                  </pre>
                </div>
              )
            }
          />
          <ChangeGroup
            title="Renomeados"
            icon={<Pencil className="size-3.5 text-amber-500" />}
            items={grouped.rename}
            render={(c) =>
              c.kind === 'rename' && (
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <code>{c.fromPath}</code>
                  <span className="text-muted-foreground">→</span>
                  <code>{c.toPath}</code>
                </div>
              )
            }
          />
          <ChangeGroup
            title="Desabilitados (view-only)"
            icon={<EyeOff className="size-3.5 text-amber-500" />}
            items={grouped.disable}
            render={(c) =>
              c.kind === 'toggle-disabled' && (
                <code className="font-mono text-[11px]">{c.path}</code>
              )
            }
          />
          <ChangeGroup
            title="Reabilitados"
            icon={<Eye className="size-3.5 text-emerald-500" />}
            items={grouped.enable}
            render={(c) =>
              c.kind === 'toggle-disabled' && (
                <code className="font-mono text-[11px]">{c.path}</code>
              )
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commit-label" className="text-xs">
            Nome do commit (opcional)
          </Label>
          <Input
            id="commit-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Paleta v2, Ajuste de radius..."
            className="text-xs"
          />
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onDiscard();
              onOpenChange(false);
            }}
          >
            Descartar tudo
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Voltar
            </Button>
            <Button type="button" onClick={handleConfirm}>
              Confirmar salvamento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeGroup<T extends PendingChange>({
  title,
  icon,
  items,
  render,
}: {
  title: string;
  icon: React.ReactNode;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className={cn('flex flex-col gap-2')}>
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
        {icon}
        {title}
        <span className="tabular-nums">({items.length})</span>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="bg-background rounded-md border p-2.5">
            {render(item)}
          </li>
        ))}
      </ul>
    </section>
  );
}
