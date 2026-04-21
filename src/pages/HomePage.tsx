import { useCallback, useMemo, useState } from 'react';
import { Hash, Sparkles } from 'lucide-react';

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
import { SidebarProvider } from '@/components/ui/sidebar';
import dictionary from '@/dictionary/dictionary-example.json';

export function HomePage() {
  const [selected, setSelected] = useState<TokenLeafNode | null>(null);

  /**
   * Índice de tokens para o preview resolver aliases (`{color.grey.500}`) e
   * referências aninhadas em shadows, text-styles, etc.
   */
  const tokenIndex = useMemo(() => {
    const tree = buildTokenTree(dictionary);
    return buildTokenIndex(tree);
  }, []);

  const handleSelect = useCallback<TokenSelectHandler>(
    (_path, _value, node) => {
      setSelected(node);
    },
    [],
  );

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '20rem',
        } as React.CSSProperties
      }
    >
      <TokenTree
        title="Design Tokens"
        data={dictionary}
        onTokenSelect={handleSelect}
      />

      <main className="bg-background text-foreground flex min-h-svh w-full flex-col">
        <header className="flex flex-col gap-1 border-b px-8 py-6">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Sparkles className="size-4" />
            <span>POC — Design Tokens Manager</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Gerenciador de Tokens
          </h1>
          <p className="text-muted-foreground text-sm">
            Selecione um token na árvore à esquerda para ver seus detalhes.
          </p>
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
