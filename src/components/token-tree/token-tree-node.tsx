import { memo, useCallback, useContext, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  File,
  Folder,
  FolderOpen,
  Link2,
  Plus,
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
import { usePathDisabledState } from './disabled-context';
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
/*                               Disable toggle                                */
/* -------------------------------------------------------------------------- */

/**
 * Botão inline para desabilitar/reabilitar um nó (soft-delete).
 * - Quando o nó está `directly` desabilitado, mostra "Reabilitar" (Eye).
 * - Quando o nó está disabled APENAS por herança (ancestral disabled), o botão
 *   fica oculto — reabilitar deve ser feito no ancestral.
 * - Caso contrário, mostra "Desabilitar" (EyeOff).
 */
function DisableToggle({
  path,
  directly,
  effectively,
  onClick,
  variant = 'leaf',
}: {
  path: string;
  directly: boolean;
  effectively: boolean;
  onClick: (path: string) => void;
  variant?: 'leaf' | 'branch';
}) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onClick(path);
    },
    [onClick, path],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        onClick(path);
      }
    },
    [onClick, path],
  );

  // Disabled só por herança: não permitimos ação inline aqui.
  if (effectively && !directly) return null;

  const label = directly ? 'Reabilitar' : 'Desabilitar';
  const Icon = directly ? Eye : EyeOff;

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={variant === 'branch' ? `${label} grupo` : `${label} token`}
      aria-label={label}
      className={cn(
        'text-sidebar-foreground/60 hover:text-sidebar-foreground flex size-5 items-center justify-center rounded-sm',
        directly
          ? 'visible hover:bg-emerald-500/15 hover:text-emerald-600'
          : 'hover:bg-amber-500/10 hover:text-amber-600 invisible group-hover/row:visible',
      )}
    >
      <Icon className="size-3.5" />
    </span>
  );
}

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
  const { onAddChild, onToggleDisabled } = useTokenTreeActions();
  const { directly: directlyDisabled, effectively: effectivelyDisabled } =
    usePathDisabledState(node.path);

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
          effectivelyDisabled && 'text-sidebar-foreground/50',
        )}
        style={{ paddingLeft: 8 + depth * INDENT_PX }}
        title={
          effectivelyDisabled
            ? `${node.path}\n(grupo desabilitado — view only)`
            : node.path
        }
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        {open ? (
          <FolderOpen
            className={cn(
              'size-4 shrink-0 text-sky-600 dark:text-sky-400',
              effectivelyDisabled && 'opacity-50',
            )}
          />
        ) : (
          <Folder
            className={cn(
              'size-4 shrink-0 text-sky-600 dark:text-sky-400',
              effectivelyDisabled && 'opacity-50',
            )}
          />
        )}
        <span className={cn('truncate', directlyDisabled && 'line-through')}>
          {node.name}
        </span>
        {directlyDisabled && (
          <span className="text-amber-600 dark:text-amber-400 ml-1 text-[10px] uppercase tracking-wide">
            disabled
          </span>
        )}
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
          {onAddChild && !effectivelyDisabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleAddChild}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  handleAddChild(e as unknown as React.MouseEvent<HTMLSpanElement>);
              }}
              title="Adicionar token aqui"
              className="hover:bg-sidebar-accent-foreground/10 text-sidebar-foreground/60 hover:text-sidebar-foreground invisible flex size-5 items-center justify-center rounded-sm group-hover/row:visible"
            >
              <Plus className="size-3.5" />
            </span>
          )}
          {onToggleDisabled && depth > 0 && (
            <DisableToggle
              path={node.path}
              directly={directlyDisabled}
              effectively={effectivelyDisabled}
              onClick={onToggleDisabled}
              variant="branch"
            />
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
  const { onToggleDisabled } = useTokenTreeActions();
  const { directly: directlyDisabled, effectively: effectivelyDisabled } =
    usePathDisabledState(node.path);

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

  const diagTitle = diagnostics.map((d) => `• ${d.message}`).join('\n');
  const disabledHint = effectivelyDisabled
    ? `\n\n(${directlyDisabled ? 'Token desabilitado — view only' : 'Pertence a um grupo desabilitado'})`
    : '';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        diagnostics.length
          ? `${node.path}\n${node.displayValue}\n\nProblemas:\n${diagTitle}${disabledHint}`
          : `${node.path}\n${node.displayValue}${disabledHint}`
      }
      data-selected={isSelected || undefined}
      className={cn(
        'group/row text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-1 rounded-sm px-2 py-0.5 text-left text-[13px] leading-6 outline-none',
        'focus-visible:ring-sidebar-ring focus-visible:ring-2',
        isSelected &&
          'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
        effectivelyDisabled && 'text-sidebar-foreground/50',
      )}
      style={{
        paddingLeft:
          8 + depth * INDENT_PX + 14 /* compensa a ausência do chevron */,
      }}
    >
      {node.isColor ? (
        <ColorPreview
          color={node.colorPreview}
          className={cn(effectivelyDisabled && 'opacity-50 grayscale')}
        />
      ) : node.isAlias ? (
        <Link2
          className={cn(
            'size-3.5 shrink-0 text-sky-500 dark:text-sky-400',
            effectivelyDisabled && 'opacity-50',
          )}
        />
      ) : (
        <File
          className={cn(
            'text-sidebar-foreground/50 size-3.5 shrink-0',
            effectivelyDisabled && 'opacity-50',
          )}
        />
      )}

      <span className={cn('truncate', directlyDisabled && 'line-through')}>
        {node.name}
      </span>

      {directlyDisabled && (
        <span className="text-amber-600 dark:text-amber-400 ml-1 text-[10px] uppercase tracking-wide">
          disabled
        </span>
      )}

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
          effectivelyDisabled && 'line-through opacity-70',
        )}
      >
        {node.displayValue}
      </span>

      {onToggleDisabled && (
        <DisableToggle
          path={node.path}
          directly={directlyDisabled}
          effectively={effectivelyDisabled}
          onClick={onToggleDisabled}
        />
      )}
    </button>
  );
});
