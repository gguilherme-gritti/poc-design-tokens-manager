import { memo, useCallback, useContext, useState } from 'react';
import { ChevronRight, File, Folder, FolderOpen, Link2 } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import { ColorPreview } from './color-preview';
import { TokenSelectContext } from './token-select-context';
import { useIsSelected } from './selection-store';
import type { TokenBranchNode, TokenLeafNode, TokenNode } from './types';

const INDENT_PX = 12;

interface TokenTreeNodeProps {
  node: TokenNode;
  depth: number;
}

/**
 * Componente recursivo que renderiza qualquer nó da árvore.
 * Envolto em `React.memo` para evitar re-renders quando a seleção muda em outros ramos;
 * a referência `node` é estável (gerada uma única vez em `buildTokenTree`).
 */
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
  /**
   * Otimização: só montamos os filhos depois que a branch foi aberta pela primeira vez.
   * Isso evita pagar o custo de render de centenas de sub-árvores no primeiro paint
   * enquanto mantém o estado preservado depois que o usuário interage.
   */
  const [hasMounted, setHasMounted] = useState(false);

  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value);
    if (value) setHasMounted(true);
  }, []);

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
        <span className="text-sidebar-foreground/40 ml-auto text-[11px] tabular-nums">
          {node.children.length}
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

  const handleClick = useCallback(() => {
    onSelect?.(node.path, node.value, node);
  }, [onSelect, node]);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${node.path}\n${node.displayValue}`}
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

      <span
        className={cn(
          'text-sidebar-foreground/40 ml-auto truncate pl-2 text-[11px] font-mono',
          node.isAlias && 'italic text-sky-500 dark:text-sky-400',
        )}
      >
        {node.displayValue}
      </span>
    </button>
  );
});
