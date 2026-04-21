import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Hash, Sparkles } from 'lucide-react';

import {
  TokenPreview,
  TokenTree,
  buildTokenIndex,
  buildTokenTree,
  type TokenLeafNode,
  type TokenSelectHandler,
} from '@/components/token-tree';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarProvider } from '@/components/ui/sidebar';
import { getDesignSystemById } from '@/design-systems/registry';
import { useDesignSystemStore } from '@/stores/design-system-store';

export function DesignSystemTokensPage() {
  const activeId = useDesignSystemStore((s) => s.activeDesignSystemId);
  const setActiveId = useDesignSystemStore((s) => s.setActiveDesignSystemId);
  const definition = activeId ? getDesignSystemById(activeId) : undefined;

  const [selected, setSelected] = useState<TokenLeafNode | null>(null);

  useEffect(() => {
    if (activeId && !definition) {
      setActiveId(null);
    }
  }, [activeId, definition, setActiveId]);

  useEffect(() => {
    setSelected(null);
  }, [activeId]);

  const tokenIndex = useMemo(() => {
    if (!definition) {
      return buildTokenIndex(buildTokenTree({}));
    }
    const tree = buildTokenTree(definition.data);
    return buildTokenIndex(tree);
  }, [definition]);

  const handleSelect = useCallback<TokenSelectHandler>(
    (_path, _value, node) => {
      setSelected(node);
    },
    [],
  );

  const handleBack = useCallback(() => {
    setActiveId(null);
  }, [setActiveId]);

  if (!definition) {
    return null;
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '20rem',
        } as React.CSSProperties
      }
    >
      <TokenTree
        title={definition.name}
        data={definition.data}
        onTokenSelect={handleSelect}
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
            <p className="text-muted-foreground text-sm">
              Selecione um token na árvore à esquerda para ver seus detalhes.
            </p>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-8 py-8">
          {selected ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Hash className="size-4" />
                    <span className="font-mono text-sm">{selected.path}</span>
                  </CardTitle>
                  <CardDescription>
                    Valor bruto do token selecionado.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted/50 overflow-auto rounded-md border p-4 text-xs leading-relaxed">
                    {JSON.stringify(selected.value, null, 2)}
                  </pre>
                </CardContent>
              </Card>

              <TokenPreview node={selected} index={tokenIndex} />
            </>
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-12 text-sm">
              Nenhum token selecionado.
            </div>
          )}
        </div>
      </main>
    </SidebarProvider>
  );
}
