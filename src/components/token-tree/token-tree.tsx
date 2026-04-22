import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FolderTree, Search } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInput,
} from '@/components/ui/sidebar';

import { createSelectionStore, SelectionStoreContext } from './selection-store';
import {
  DiagnosticsContext,
  type DiagnosticsContextValue,
} from './diagnostics-context';
import {
  TokenTreeActionsContext,
  type TokenTreeActions,
} from './actions-context';
import { TokenSelectContext } from './token-select-context';
import { TokenTreeNode } from './token-tree-node';
import type { TokenNode, TokenSelectHandler, TokenTreeData } from './types';
import { buildTokenTree } from './utils';

export interface TokenTreeProps {
  data: TokenTreeData;
  title?: string;
  onTokenSelect?: TokenSelectHandler;
  searchable?: boolean;
  /** Diagnósticos já pré-computados (pelo consumidor) para exibir badges nos nós. */
  diagnostics?: DiagnosticsContextValue;
  /** Ações inline (adicionar filho, remover) mostradas em hover nos nós. */
  actions?: TokenTreeActions;
  /** Conteúdo renderizado acima do campo de busca (ex.: botão Salvar). */
  headerSlot?: React.ReactNode;
  /** Conteúdo renderizado abaixo da árvore (ex.: botão Adicionar no topo). */
  footerSlot?: React.ReactNode;
}

export const TokenTree = memo(function TokenTree({
  data,
  title = 'Tokens',
  onTokenSelect,
  searchable = true,
  diagnostics,
  actions,
  headerSlot,
  footerSlot,
}: TokenTreeProps) {
  const tree = useMemo(() => buildTokenTree(data), [data]);

  const storeRef = useRef(createSelectionStore());

  const [query, setQuery] = useState('');

  const filteredTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tree;
    return filterTree(tree, q);
  }, [tree, query]);

  const handleSelect = useCallback<TokenSelectHandler>(
    (path, value, node) => {
      storeRef.current.select(path);
      onTokenSelect?.(path, value, node);
    },
    [onTokenSelect],
  );

  const diagnosticsValue = useMemo<DiagnosticsContextValue>(
    () => diagnostics ?? { byPath: new Map(), rollupByPath: new Map() },
    [diagnostics],
  );

  const actionsValue = useMemo<TokenTreeActions>(() => actions ?? {}, [actions]);

  return (
    <SelectionStoreContext.Provider value={storeRef.current}>
      <DiagnosticsContext.Provider value={diagnosticsValue}>
        <TokenTreeActionsContext.Provider value={actionsValue}>
          <TokenSelectContext.Provider value={handleSelect}>
            <Sidebar collapsible="none" className="h-svh border-r">
              <SidebarHeader className="gap-2 border-b">
                <div className="text-sidebar-foreground flex items-center gap-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider">
                  <FolderTree className="size-3.5" />
                  <span className="truncate">{title}</span>
                </div>
                {headerSlot}
                {searchable && (
                  <div className="relative px-2">
                    <Search className="text-sidebar-foreground/50 pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2" />
                    <SidebarInput
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar token..."
                      className="h-7 pl-7 text-[12px]"
                    />
                  </div>
                )}
              </SidebarHeader>

              <SidebarContent>
                <SidebarGroup className="gap-0 p-1">
                  {filteredTree.length === 0 ? (
                    <p className="text-sidebar-foreground/50 px-3 py-4 text-xs">
                      Nenhum token encontrado.
                    </p>
                  ) : (
                    filteredTree.map((node) => (
                      <TokenTreeNode key={node.path} node={node} depth={0} />
                    ))
                  )}
                </SidebarGroup>
                {footerSlot}
              </SidebarContent>
            </Sidebar>
          </TokenSelectContext.Provider>
        </TokenTreeActionsContext.Provider>
      </DiagnosticsContext.Provider>
    </SelectionStoreContext.Provider>
  );
});

function filterTree(nodes: TokenNode[], query: string): TokenNode[] {
  const result: TokenNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'leaf') {
      if (
        node.path.toLowerCase().includes(query) ||
        node.displayValue.toLowerCase().includes(query)
      ) {
        result.push(node);
      }
      continue;
    }
    const children = filterTree(node.children, query);
    if (children.length > 0 || node.path.toLowerCase().includes(query)) {
      result.push({ ...node, children });
    }
  }
  return result;
}
