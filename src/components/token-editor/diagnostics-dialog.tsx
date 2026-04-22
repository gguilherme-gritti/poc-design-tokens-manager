import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CircleCheck,
  Info,
  Sparkles,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  DiagnosticCode,
  DiagnosticSeverity,
  TokenDiagnostic,
} from '@/lib/token-diagnostics';

export type DiagnosticsFilter = 'all' | 'error' | 'warning' | 'info';

interface DiagnosticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnostics: TokenDiagnostic[];
  /** Abre o dialog já filtrado por severidade (ex.: clicou no badge de erro). */
  initialFilter?: DiagnosticsFilter;
  /** Clique em "Ir para o token": recebe o path e deve selecionar + fechar. */
  onSelectToken: (path: string) => void;
}

/**
 * Mapeamento cosmético dos códigos de diagnóstico para rótulos humanos — mantém o
 * motor de validação desacoplado da camada de apresentação.
 */
const CODE_LABELS: Record<DiagnosticCode, string> = {
  'alias-target-missing': 'Alias aponta para token inexistente',
  'alias-out-of-scope': 'Alias fora do escopo permitido (brands)',
  'circular-alias': 'Alias cíclico',
  'inline-reference-missing': 'Referência inline ausente',
};

const SEVERITY_META: Record<
  DiagnosticSeverity,
  {
    label: string;
    Icon: typeof AlertCircle;
    accent: string;
    badge: 'destructive' | 'warning' | 'info';
  }
> = {
  error: {
    label: 'Erros',
    Icon: AlertCircle,
    accent: 'text-red-500',
    badge: 'destructive',
  },
  warning: {
    label: 'Avisos',
    Icon: AlertTriangle,
    accent: 'text-amber-500',
    badge: 'warning',
  },
  info: {
    label: 'Infos',
    Icon: Info,
    accent: 'text-sky-500',
    badge: 'info',
  },
};

export function DiagnosticsDialog({
  open,
  onOpenChange,
  diagnostics,
  initialFilter = 'all',
  onSelectToken,
}: DiagnosticsDialogProps) {
  const [filter, setFilter] = useState<DiagnosticsFilter>(initialFilter);

  // Sempre que o dialog abre, reaplica o filtro inicial (ex.: clicar no badge
  // de warning deve abrir com filter='warning').
  useEffect(() => {
    if (open) setFilter(initialFilter);
  }, [open, initialFilter]);

  const counts = useMemo(() => {
    const acc = { error: 0, warning: 0, info: 0 };
    for (const d of diagnostics) acc[d.severity] += 1;
    return acc;
  }, [diagnostics]);

  const visible = useMemo(() => {
    const filtered =
      filter === 'all'
        ? diagnostics
        : diagnostics.filter((d) => d.severity === filter);
    // Ordena por severidade (error → warning → info) e depois por path.
    const rank: Record<DiagnosticSeverity, number> = {
      error: 0,
      warning: 1,
      info: 2,
    };
    return [...filtered].sort((a, b) => {
      const sev = rank[a.severity] - rank[b.severity];
      if (sev !== 0) return sev;
      return a.path.localeCompare(b.path);
    });
  }, [diagnostics, filter]);

  const handleJumpTo = (path: string) => {
    onSelectToken(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-500" />
            Problemas e avisos da árvore
          </DialogTitle>
          <DialogDescription>
            Inconsistências detectadas no design system em edição. Clique em um
            item para abrir o token correspondente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as DiagnosticsFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">
                Todos ({diagnostics.length})
              </TabsTrigger>
              <TabsTrigger value="error">
                <AlertCircle className="size-3 text-red-500" />
                Erros ({counts.error})
              </TabsTrigger>
              <TabsTrigger value="warning">
                <AlertTriangle className="size-3 text-amber-500" />
                Avisos ({counts.warning})
              </TabsTrigger>
              {counts.info > 0 && (
                <TabsTrigger value="info">
                  <Info className="size-3 text-sky-500" />
                  Infos ({counts.info})
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex max-h-[460px] flex-col gap-2 overflow-auto pr-1">
          {visible.length === 0 ? (
            <EmptyState filter={filter} total={diagnostics.length} />
          ) : (
            visible.map((d, i) => (
              <DiagnosticItem
                key={`${d.path}-${d.code}-${i}`}
                diagnostic={d}
                onJumpTo={handleJumpTo}
              />
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Item                                    */
/* -------------------------------------------------------------------------- */

function DiagnosticItem({
  diagnostic,
  onJumpTo,
}: {
  diagnostic: TokenDiagnostic;
  onJumpTo: (path: string) => void;
}) {
  const meta = SEVERITY_META[diagnostic.severity];
  const { Icon } = meta;

  return (
    <article
      className={cn(
        'bg-background flex flex-col gap-2 rounded-md border p-3 text-[12px]',
        diagnostic.severity === 'error' && 'border-red-500/30',
        diagnostic.severity === 'warning' && 'border-amber-500/30',
        diagnostic.severity === 'info' && 'border-sky-500/30',
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className={cn('mt-0.5 size-4 shrink-0', meta.accent)} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={meta.badge} className="uppercase">
                {diagnostic.severity}
              </Badge>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                {CODE_LABELS[diagnostic.code]}
              </span>
            </div>
            <code className="font-mono text-[11px] leading-tight break-all">
              {diagnostic.path}
            </code>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          onClick={() => onJumpTo(diagnostic.path)}
        >
          Ir para o token
          <ArrowUpRight className="size-3.5" />
        </Button>
      </header>

      <p className="text-[12px] leading-snug">{diagnostic.message}</p>

      {diagnostic.suggestions && diagnostic.suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
          <span className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase tracking-wide">
            <Sparkles className="size-3" />
            Sugestões
          </span>
          {diagnostic.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onJumpTo(s)}
              className="bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded-full px-2 py-0.5 font-mono text-[10px] transition-colors"
              title={`Abrir ${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Empty state                                 */
/* -------------------------------------------------------------------------- */

function EmptyState({
  filter,
  total,
}: {
  filter: DiagnosticsFilter;
  total: number;
}) {
  const noneAtAll = total === 0;
  return (
    <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-8 text-center text-sm">
      <CircleCheck className="size-8 text-emerald-500/70" />
      {noneAtAll ? (
        <p>Nenhum problema detectado — árvore consistente.</p>
      ) : (
        <p>
          Nenhum item na categoria <strong>{filter}</strong>. Ainda há{' '}
          {total} diagnóstico(s) em outras severidades.
        </p>
      )}
    </div>
  );
}
