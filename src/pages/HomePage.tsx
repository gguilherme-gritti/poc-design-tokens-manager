import { useMemo, useState } from 'react';
import {
  FilePlus2,
  FileUp,
  Layers,
  MoreVertical,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { CreateDesignSystemDialog } from '@/components/design-system/create-design-system-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getTemplateById } from '@/design-systems/registry';
import {
  useDesignSystemStore,
  type DesignSystemMeta,
} from '@/stores/design-system-store';

export function HomePage() {
  const designSystems = useDesignSystemStore((s) => s.designSystems);
  const workspaces = useDesignSystemStore((s) => s.workspaces);
  const setActiveId = useDesignSystemStore((s) => s.setActiveDesignSystemId);
  const createDesignSystem = useDesignSystemStore((s) => s.createDesignSystem);
  const deleteDesignSystem = useDesignSystemStore((s) => s.deleteDesignSystem);

  const [createOpen, setCreateOpen] = useState(false);

  const sorted = useMemo(() => {
    return [...designSystems].sort((a, b) => b.createdAt - a.createdAt);
  }, [designSystems]);

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-b px-8 py-10">
        <div className="text-muted-foreground mx-auto flex max-w-4xl flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4" />
            <span>POC — Design Tokens Manager</span>
          </div>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">
            Seus design systems
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Crie um design system do zero, a partir de um template, ou importe uma
            árvore Style Dictionary em .zip. Cada DS tem seu próprio histórico e
            workspace de edição.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            {sorted.length} design system{sorted.length === 1 ? '' : 's'}
          </span>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => setCreateOpen(true)}
          >
            <FilePlus2 className="size-4" />
            Novo design system
          </Button>
        </div>

        {sorted.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sorted.map((ds) => (
              <DesignSystemCard
                key={ds.id}
                meta={ds}
                leafCount={countLeaves(workspaces[ds.id]?.baseline)}
                historyCount={workspaces[ds.id]?.history.length ?? 0}
                onOpen={() => setActiveId(ds.id)}
                onDelete={() => {
                  deleteDesignSystem(ds.id);
                  toast.info('Design system removido.');
                }}
              />
            ))}
          </div>
        )}
      </main>

      <CreateDesignSystemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onConfirm={(input) => {
          const id = createDesignSystem(input);
          toast.success('Design system criado.');
          setActiveId(id);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Cards                                   */
/* -------------------------------------------------------------------------- */

function DesignSystemCard({
  meta,
  leafCount,
  historyCount,
  onOpen,
  onDelete,
}: {
  meta: DesignSystemMeta;
  leafCount: number;
  historyCount: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const originLabel = formatOrigin(meta);
  return (
    <Card className="relative">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
            <Layers className="size-3.5" />
            Design system
          </div>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-1 size-7"
                aria-label="Opções"
              >
                <MoreVertical className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive w-full justify-start gap-2 text-xs"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="size-3.5" />
                Remover
              </Button>
            </PopoverContent>
          </Popover>
        </div>
        <CardTitle className="text-lg">{meta.name}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {meta.description || <span className="italic opacity-60">Sem descrição</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{originLabel}</Badge>
        <Badge variant="outline">{leafCount} folha(s)</Badge>
        {historyCount > 0 && (
          <Badge variant="info">{historyCount} commit(s)</Badge>
        )}
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          className="w-full sm:w-auto"
          variant="default"
          onClick={onOpen}
        >
          Gerenciar tokens
        </Button>
      </CardFooter>
    </Card>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-sm">
      <FileUp className="size-8 opacity-40" />
      <p>Nenhum design system por enquanto.</p>
      <Button type="button" size="sm" className="gap-2" onClick={onCreate}>
        <FilePlus2 className="size-4" />
        Criar primeiro design system
      </Button>
    </div>
  );
}

function formatOrigin(meta: DesignSystemMeta): string {
  if (meta.origin.kind === 'empty') return 'Vazio';
  if (meta.origin.kind === 'import') {
    return `Import: ${truncate(meta.origin.fileName, 28)}`;
  }
  const tpl = getTemplateById(meta.origin.templateId);
  return `Template: ${tpl?.name ?? meta.origin.templateId}`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function countLeaves(tree: Record<string, unknown> | undefined): number {
  if (!tree) return 0;
  let count = 0;
  const stack: unknown[] = [tree];
  while (stack.length) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) continue;
    if (Object.prototype.hasOwnProperty.call(node, 'value')) {
      count += 1;
      continue;
    }
    for (const child of Object.values(node as Record<string, unknown>)) {
      stack.push(child);
    }
  }
  return count;
}
