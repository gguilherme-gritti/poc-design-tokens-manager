import { memo, useCallback, useContext, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import { ColorPreview } from './color-preview';
import {
  useBranchDiagnosticSeverity,
  useDiagnosticsForPath,
} from './diagnostics-context';
import { useTokenTreeActions } from './actions-context';
import { TokenSelectContext } from './token-select-context';
import { useIsSelected } from './selection-store';
import type { TokenBranchNode, TokenLeafNode, TokenNode } from './types';

const INDENT_PX = 12;

interface TokenTreeNodeProps {
  node: TokenNode;
  depth: number;
}

export const TokenTreeNode = memo(function TokenTreeNode({
  node,
  depth,
}: TokenTreeNodeProps) {
  if (node.kind === 'branch') {
    return <TokenBranch node={node} depth={depth} />;
  }
  return <TokenLeaf node={node} depth={depth} />;
});

/* -------------------------------------------------------------------------- */
/*                                   Branch                                    */
/* -------------------------------------------------------------------------- */

interface BranchProps {
  node: TokenBranchNode;
  depth: number;
}

const TokenBranch = memo(function TokenBranch({ node, depth }: BranchProps) {
  const [open, setOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const severity = useBranchDiagnosticSeverity(node.path);
  const { onAddChild, onRequestRemove } = useTokenTreeActions();

  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value);
    if (value) setHasMounted(true);
  }, []);

  const handleAddChild = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onAddChild?.(node.path);
    },
    [node.path, onAddChild],
  );

  const handleRemove = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onRequestRemove?.(node.path);
    },
    [node.path, onRequestRemove],
  );

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className="select-none"
    >
      <CollapsibleTrigger
        className={cn(
          'group/row text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-1 rounded-sm px-2 py-0.5 text-left text-[13px] leading-6 outline-none',
          'focus-visible:ring-sidebar-ring focus-visible:ring-2',
        )}
        style={{ paddingLeft: 8 + depth * INDENT_PX }}
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        {open ? (
          <FolderOpen className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
        ) : (
          <Folder className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
        )}
        <span className="truncate">{node.name}</span>
        {severity === 'error' ? (
          <AlertCircle
            className="ml-1 size-3 shrink-0 text-red-500"
            aria-label="Contém erros"
          />
        ) : severity === 'warning' ? (
          <AlertTriangle
            className="ml-1 size-3 shrink-0 text-amber-500"
            aria-label="Contém avisos"
          />
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          {onAddChild && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleAddChild}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleAddChild(e as unknown as React.MouseEvent<HTMLSpanElement>);
              }}
              title="Adicionar token aqui"
              className="hover:bg-sidebar-accent-foreground/10 text-sidebar-foreground/60 hover:text-sidebar-foreground invisible flex size-5 items-center justify-center rounded-sm group-hover/row:visible"
            >
              <Plus className="size-3.5" />
            </span>
          )}
          {onRequestRemove && depth > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleRemove}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleRemove(e as unknown as React.MouseEvent<HTMLSpanElement>);
              }}
              title="Remover grupo"
              className="hover:bg-destructive/10 text-sidebar-foreground/60 hover:text-destructive invisible flex size-5 items-center justify-center rounded-sm group-hover/row:visible"
            >
              <Trash2 className="size-3.5" />
            </span>
          )}
          <span className="text-sidebar-foreground/40 text-[11px] tabular-nums">
            {node.children.length}
          </span>
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent forceMount className={cn(!open && 'hidden')}>
        {hasMounted
          ? node.children.map((child) => (
              <TokenTreeNode key={child.path} node={child} depth={depth + 1} />
            ))
          : null}
      </CollapsibleContent>
    </Collapsible>
  );
});

/* -------------------------------------------------------------------------- */
/*                                    Leaf                                    */
/* -------------------------------------------------------------------------- */

interface LeafProps {
  node: TokenLeafNode;
  depth: number;
}

const TokenLeaf = memo(function TokenLeaf({ node, depth }: LeafProps) {
  const onSelect = useContext(TokenSelectContext);
  const isSelected = useIsSelected(node.path);
  const diagnostics = useDiagnosticsForPath(node.path);
  const { onRequestRemove } = useTokenTreeActions();
  const topSeverity = diagnostics.reduce<null | 'error' | 'warning' | 'info'>(
    (acc, d) => {
      if (d.severity === 'error') return 'error';
      if (d.severity === 'warning' && acc !== 'error') return 'warning';
      if (d.severity === 'info' && acc === null) return 'info';
      return acc;
    },
    null,
  );

  const handleClick = useCallback(() => {
    onSelect?.(node.path, node.value, node);
  }, [onSelect, node]);

  const handleRemove = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onRequestRemove?.(node.path);
    },
    [node.path, onRequestRemove],
  );

  const diagTitle = diagnostics.map((d) => `• ${d.message}`).join('\n');

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        diagnostics.length
          ? `${node.path}\n${node.displayValue}\n\nProblemas:\n${diagTitle}`
          : `${node.path}\n${node.displayValue}`
      }
      data-selected={isSelected || undefined}
      className={cn(
        'group/row text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-1 rounded-sm px-2 py-0.5 text-left text-[13px] leading-6 outline-none',
        'focus-visible:ring-sidebar-ring focus-visible:ring-2',
        isSelected &&
          'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
      )}
      style={{
        paddingLeft:
          8 + depth * INDENT_PX + 14 /* compensa a ausência do chevron */,
      }}
    >
      {node.isColor ? (
        <ColorPreview color={node.colorPreview} />
      ) : node.isAlias ? (
        <Link2 className="size-3.5 shrink-0 text-sky-500 dark:text-sky-400" />
      ) : (
        <File className="text-sidebar-foreground/50 size-3.5 shrink-0" />
      )}

      <span className="truncate">{node.name}</span>

      {topSeverity === 'error' ? (
        <AlertCircle
          className="size-3 shrink-0 text-red-500"
          aria-label="Erro de validação"
        />
      ) : topSeverity === 'warning' ? (
        <AlertTriangle
          className="size-3 shrink-0 text-amber-500"
          aria-label="Aviso de validação"
        />
      ) : null}

      <span
        className={cn(
          'text-sidebar-foreground/40 ml-auto truncate pl-2 text-[11px] font-mono',
          node.isAlias && 'italic text-sky-500 dark:text-sky-400',
        )}
      >
        {node.displayValue}
      </span>

      {onRequestRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={handleRemove}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleRemove(e as unknown as React.MouseEvent<HTMLSpanElement>);
          }}
          title="Remover token"
          className="hover:bg-destructive/10 text-sidebar-foreground/60 hover:text-destructive invisible ml-1 flex size-5 items-center justify-center rounded-sm group-hover/row:visible"
        >
          <Trash2 className="size-3.5" />
        </span>
      )}
    </button>
  );
});
