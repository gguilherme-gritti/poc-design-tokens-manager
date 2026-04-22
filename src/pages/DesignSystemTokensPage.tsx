import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Hash,
  History as HistoryIcon,
  Redo2,
  Save,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  buildLeafNode,
  buildTokenIndex,
  buildTokenTree,
  TokenPreview,
  TokenTree,
  type TokenLeafNode,
  type TokenSelectHandler,
  type TokenTreeActions,
} from '@/components/token-tree';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddTokenDialog } from '@/components/token-editor/add-token-dialog';
import { CommitDialog } from '@/components/token-editor/commit-dialog';
import { HistoryPanel } from '@/components/token-editor/history-panel';
import { RemoveConfirmDialog } from '@/components/token-editor/remove-confirm-dialog';
import { TokenEditor } from '@/components/token-editor/token-editor';
import { getDesignSystemById } from '@/design-systems/registry';
import {
  diagnoseTree,
  indexDiagnostics,
  rollupSeverityByBranch,
} from '@/lib/token-diagnostics';
import { getAt, isLeafObject } from '@/lib/token-mutations';
import {
  getTemporalDesignSystemState,
  useDesignSystemStore,
  useTemporalDesignSystemStore,
} from '@/stores/design-system-store';

export function DesignSystemTokensPage() {
  const activeId = useDesignSystemStore((s) => s.activeDesignSystemId);
  const setActiveId = useDesignSystemStore((s) => s.setActiveDesignSystemId);
  const ensureWorkspace = useDesignSystemStore((s) => s.ensureWorkspace);
  const workspace = useDesignSystemStore((s) =>
    activeId ? s.workspaces[activeId] : undefined,
  );
  const updateLeafValue = useDesignSystemStore((s) => s.updateLeafValue);
  const removeNode = useDesignSystemStore((s) => s.removeNode);
  const addLeaf = useDesignSystemStore((s) => s.addLeaf);
  const addBranch = useDesignSystemStore((s) => s.addBranch);
  const undoLastPendingChange = useDesignSystemStore(
    (s) => s.undoLastPendingChange,
  );
  const commit = useDesignSystemStore((s) => s.commit);
  const discard = useDesignSystemStore((s) => s.discard);
  const restoreHistoryEntry = useDesignSystemStore(
    (s) => s.restoreHistoryEntry,
  );

  const definition = activeId ? getDesignSystemById(activeId) : undefined;

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [tab, setTab] = useState<'tokens' | 'history'>('tokens');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogParent, setAddDialogParent] = useState('');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [commitOpen, setCommitOpen] = useState(false);
  /**
   * Valor "ao vivo" sendo digitado no `TokenEditor`. Quando `null`, o preview usa o valor
   * persistido no store. Quando não-null, usamos esse valor para renderizar o preview
   * em tempo real (mesmo antes do "Aplicar alteração").
   */
  const [liveValue, setLiveValue] = useState<unknown>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (activeId) ensureWorkspace(activeId);
  }, [activeId, ensureWorkspace]);

  useEffect(() => {
    if (activeId && !definition) setActiveId(null);
  }, [activeId, definition, setActiveId]);

  useEffect(() => {
    setSelectedPath(null);
    setTab('tokens');
  }, [activeId]);

  useEffect(() => {
    setLiveValue(null);
    setIsDirty(false);
  }, [selectedPath]);

  const draft = workspace?.draft;

  const tree = useMemo(() => (draft ? buildTokenTree(draft) : []), [draft]);

  const tokenIndex = useMemo(() => buildTokenIndex(tree), [tree]);

  const diagnostics = useMemo(
    () => (tree.length ? diagnoseTree(tree, tokenIndex) : []),
    [tree, tokenIndex],
  );

  const diagnosticsContext = useMemo(
    () => ({
      byPath: indexDiagnostics(diagnostics),
      rollupByPath: rollupSeverityByBranch(diagnostics),
    }),
    [diagnostics],
  );

  const selectedNode = useMemo<TokenLeafNode | null>(() => {
    if (!selectedPath || !draft) return null;
    const raw = getAt(draft, selectedPath);
    if (!isLeafObject(raw)) return null;
    const fromIndex = tokenIndex.get(selectedPath);
    if (fromIndex && fromIndex.path === selectedPath) return fromIndex;
    const leaves = collectLeaf(tree, selectedPath);
    return leaves ?? null;
  }, [selectedPath, draft, tokenIndex, tree]);

  /**
   * Nó usado exclusivamente pelo preview. Quando o editor tem alterações pendentes
   * (`isDirty`), recomputamos uma folha "virtual" com os mesmos heuristics da árvore
   * principal, garantindo que cor/alias/preview se atualizem em tempo real.
   */
  const previewNode = useMemo<TokenLeafNode | null>(() => {
    if (!selectedNode) return null;
    if (!isDirty) return selectedNode;
    return buildLeafNode(
      selectedNode.path,
      liveValue,
      selectedNode.attributes,
    );
  }, [selectedNode, isDirty, liveValue]);

  const handleSelect = useCallback<TokenSelectHandler>((path) => {
    setSelectedPath(path);
  }, []);

  const handleBack = useCallback(() => {
    setActiveId(null);
  }, [setActiveId]);

  /* --------------------------------- Edit --------------------------------- */

  const handleSubmitValue = useCallback(
    (nextValue: unknown) => {
      if (!activeId || !selectedPath) return;
      updateLeafValue(activeId, selectedPath, nextValue);
      setLiveValue(null);
      setIsDirty(false);
      toast.success('Alteração aplicada', {
        description: selectedPath,
        action: {
          label: 'Desfazer',
          onClick: () => undoLastPendingChange(activeId),
        },
      });
    },
    [activeId, selectedPath, undoLastPendingChange, updateLeafValue],
  );

  const handleLiveValueChange = useCallback(
    (next: unknown, nextIsDirty: boolean) => {
      setLiveValue(next);
      setIsDirty(nextIsDirty);
    },
    [],
  );

  /* ---------------------------- Add / Remove ------------------------------ */

  const openAddDialog = useCallback((parentPath: string) => {
    setAddDialogParent(parentPath);
    setAddDialogOpen(true);
  }, []);

  const handleRequestRemove = useCallback((path: string) => {
    setRemoveTarget(path);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (!activeId || !removeTarget) return;
    const target = removeTarget;
    removeNode(activeId, target);
    if (selectedPath === target || selectedPath?.startsWith(`${target}.`)) {
      setSelectedPath(null);
    }
    toast.success('Token removido', {
      description: target,
      action: {
        label: 'Desfazer',
        onClick: () => undoLastPendingChange(activeId),
      },
    });
  }, [activeId, removeTarget, removeNode, selectedPath, undoLastPendingChange]);

  const handleAddSubmit = useCallback(
    ({
      kind,
      parentPath,
      name,
      value,
      attributes,
    }: {
      kind: 'leaf' | 'branch';
      parentPath: string;
      name: string;
      value?: unknown;
      attributes?: Record<string, unknown>;
    }) => {
      if (!activeId) return;
      if (kind === 'branch') {
        addBranch(activeId, parentPath, name);
      } else {
        addLeaf(activeId, parentPath, name, value ?? '', attributes);
      }
      const fullPath = parentPath ? `${parentPath}.${name}` : name;
      toast.success('Adicionado', {
        description: fullPath,
        action: {
          label: 'Desfazer',
          onClick: () => undoLastPendingChange(activeId),
        },
      });
      if (kind === 'leaf') setSelectedPath(fullPath);
    },
    [activeId, addBranch, addLeaf, undoLastPendingChange],
  );

  /* ---------------------------- Commit / Discard -------------------------- */

  const handleCommit = useCallback(
    (label?: string) => {
      if (!activeId) return;
      const entry = commit(activeId, label);
      if (entry) {
        toast.success('Alterações salvas no histórico', {
          description: entry.label ?? entry.id.slice(0, 6),
        });
      }
    },
    [activeId, commit],
  );

  const handleDiscard = useCallback(() => {
    if (!activeId) return;
    discard(activeId);
    toast.info('Alterações pendentes descartadas.');
  }, [activeId, discard]);

  /* --------------------------------- Undo --------------------------------- */

  const pastStatesLength = useTemporalDesignSystemStore(
    (s) => s.pastStates.length,
  );
  const futureStatesLength = useTemporalDesignSystemStore(
    (s) => s.futureStates.length,
  );
  const undo = useCallback(() => getTemporalDesignSystemState().undo(), []);
  const redo = useCallback(() => getTemporalDesignSystemState().redo(), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  /* --------------------------------- Render ------------------------------- */

  if (!definition || !workspace) {
    return null;
  }

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning')
    .length;
  const pendingCount = workspace.pendingChanges.length;

  const treeActions: TokenTreeActions = {
    onAddChild: openAddDialog,
    onRequestRemove: handleRequestRemove,
  };

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '22rem',
        } as React.CSSProperties
      }
    >
      <TokenTree
        title={definition.name}
        data={draft!}
        onTokenSelect={handleSelect}
        diagnostics={diagnosticsContext}
        actions={treeActions}
        headerSlot={
          <div className="flex flex-col gap-2 px-2 pb-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 justify-start gap-1.5 text-[11px]"
              onClick={() => openAddDialog('')}
            >
              + Adicionar token na raiz
            </Button>
            <div className="flex flex-wrap gap-1">
              {errorCount > 0 && (
                <Badge variant="destructive">
                  <AlertCircle className="size-3" /> {errorCount}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="warning">
                  <AlertTriangle className="size-3" /> {warningCount}
                </Badge>
              )}
            </div>
          </div>
        }
      />

      <main className="bg-background text-foreground flex min-h-svh w-full flex-col">
        <header className="flex flex-col gap-4 border-b px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleBack}
            >
              <ArrowLeft className="size-4" />
              Escolher outro design system
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={pastStatesLength === 0}
                title="Desfazer (Ctrl/⌘+Z)"
              >
                <Undo2 className="size-3.5" />
                Desfazer
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={futureStatesLength === 0}
                title="Refazer (Ctrl/⌘+Shift+Z)"
              >
                <Redo2 className="size-3.5" />
                Refazer
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => setCommitOpen(true)}
                disabled={pendingCount === 0}
              >
                <Save className="size-3.5" />
                Salvar alterações
                {pendingCount > 0 && (
                  <span className="bg-primary-foreground/20 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Sparkles className="size-4" />
              <span>{definition.name}</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Gerenciador de Tokens
            </h1>
            <p className="text-muted-foreground text-sm">
              {definition.description}
            </p>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-8 py-8">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as 'tokens' | 'history')}
            className="gap-6"
          >
            <TabsList>
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="history">
                <HistoryIcon className="size-3.5" />
                Histórico ({workspace.history.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tokens" className="flex flex-col gap-4">
              {selectedNode && previewNode ? (
                <>
                  {/* Card de JSON bruto */}
                  <Card>
                    <CardHeader className="gap-1">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Hash className="text-muted-foreground size-4" />
                        <code className="font-mono text-xs">
                          {selectedNode.path}
                        </code>
                        <span className="text-muted-foreground font-sans text-xs font-normal">
                          · JSON atual
                        </span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Representação bruta{' '}
                        {isDirty ? 'do rascunho sendo editado' : 'persistida'}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-muted/50 overflow-auto rounded-md border p-3 text-[11px] leading-relaxed">
                        {JSON.stringify(previewNode.value, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>

                  {/* Card unificado: edição (esq.) + preview (dir.) */}
                  <Card>
                    <CardHeader className="gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          Edição do token
                        </CardTitle>
                        {isDirty && (
                          <Badge variant="warning">
                            Edição em andamento
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        Alterações são refletidas no preview em tempo real. Erros
                        não bloqueiam o salvamento — ficam marcados na árvore.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 sm:grid-cols-2">
                        {/* Coluna esquerda: edição */}
                        <section className="min-w-0 sm:border-r sm:pr-4">
                          <TokenEditor
                            key={selectedNode.path}
                            node={selectedNode}
                            index={tokenIndex}
                            onSubmit={handleSubmitValue}
                            onValueChange={handleLiveValueChange}
                          />
                        </section>

                        {/* Coluna direita: preview ao vivo */}
                        <section className="flex min-w-0 flex-col gap-2">
                          {isDirty && (
                            <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center gap-2 rounded-md border border-amber-500/30 px-3 py-1.5 text-[11px]">
                              <Sparkles className="size-3.5" />
                              Preview ao vivo — o valor ainda não foi aplicado.
                            </div>
                          )}
                          <TokenPreview
                            node={previewNode}
                            index={tokenIndex}
                            embedded
                          />
                        </section>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-12 text-sm">
                  Selecione um token na árvore para editar ou use os botões "+"
                  em hover nos grupos para criar novos.
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              <HistoryPanel
                history={workspace.history}
                onRestore={(id) => {
                  restoreHistoryEntry(activeId!, id);
                  toast.success('Estado restaurado — novo commit criado.');
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <AddTokenDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        parentPath={addDialogParent}
        tree={draft!}
        index={tokenIndex}
        onSubmit={handleAddSubmit}
      />

      <RemoveConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        path={removeTarget}
        tree={draft!}
        onConfirm={handleConfirmRemove}
      />

      <CommitDialog
        open={commitOpen}
        onOpenChange={setCommitOpen}
        pendingChanges={workspace.pendingChanges}
        diagnostics={diagnostics}
        onConfirm={handleCommit}
        onDiscard={handleDiscard}
      />
    </SidebarProvider>
  );
}

/**
 * Navega a árvore já construída para encontrar a folha exata (com metadados
 * normalizados — colorPreview, isAlias, etc.). Usado quando `tokenIndex`
 * retorna um sufixo diferente do path completo.
 */
function collectLeaf(nodes: ReturnType<typeof buildTokenTree>, path: string) {
  const stack = [...nodes];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.kind === 'leaf' && node.path === path) return node;
    if (node.kind === 'branch') {
      for (const child of node.children) stack.push(child);
    }
  }
  return null;
}
