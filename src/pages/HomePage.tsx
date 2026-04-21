import { Layers, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { designSystemsByDefaultFirst } from '@/design-systems/registry';
import { useDesignSystemStore } from '@/stores/design-system-store';

export function HomePage() {
  const setActiveId = useDesignSystemStore((s) => s.setActiveDesignSystemId);
  const systems = designSystemsByDefaultFirst();

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-b px-8 py-10">
        <div className="text-muted-foreground mx-auto flex max-w-4xl flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4" />
            <span>POC — Design Tokens Manager</span>
          </div>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">
            Escolha o design system
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Cada opção carrega uma árvore de tokens diferente. O padrão da POC
            usa o dicionário de exemplo; depois da escolha você acessa o
            visualizador em árvore e o preview do token.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-8 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {systems.map((ds) => (
            <Card
              key={ds.id}
              className={ds.isDefault ? 'border-primary/40 shadow-sm' : ''}
            >
              <CardHeader className="gap-2">
                <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                  <Layers className="size-3.5" />
                  {ds.isDefault ? 'Padrão' : 'Design system'}
                </div>
                <CardTitle className="text-lg">{ds.name}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {ds.description}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  variant={ds.isDefault ? 'default' : 'secondary'}
                  onClick={() => setActiveId(ds.id)}
                >
                  Gerenciar tokens
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
