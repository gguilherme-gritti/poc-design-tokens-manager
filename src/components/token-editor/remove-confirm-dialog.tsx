import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';

import type { TokenTreeData } from '@/components/token-tree';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { countLeavesAt, getAt, isLeafObject } from '@/lib/token-mutations';

interface RemoveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string | null;
  tree: TokenTreeData;
  onConfirm: () => void;
}

export function RemoveConfirmDialog({
  open,
  onOpenChange,
  path,
  tree,
  onConfirm,
}: RemoveConfirmDialogProps) {
  const summary = useMemo(() => {
    if (!path) return null;
    const node = getAt(tree, path);
    if (node === undefined) return null;
    if (isLeafObject(node)) return { kind: 'leaf' as const, count: 1 };
    return { kind: 'branch' as const, count: countLeavesAt(tree, path) };
  }, [path, tree]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Remover token?
          </DialogTitle>
          <DialogDescription className="flex flex-col gap-1">
            {path ? (
              <code className="bg-muted rounded px-1 font-mono text-[11px]">
                {path}
              </code>
            ) : null}
            {summary?.kind === 'branch' ? (
              <span>
                Este grupo contém <b>{summary.count}</b> token(s). Todos serão
                removidos.
              </span>
            ) : (
              <span>O token será removido da árvore.</span>
            )}
            <span className="text-muted-foreground text-xs">
              Você ainda poderá desfazer via toast ou descartar alterações antes
              de salvar.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
