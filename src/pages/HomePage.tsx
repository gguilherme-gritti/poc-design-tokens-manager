import { useState } from 'react';
import { Palette, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Página de exemplo: prova que Tailwind + Shadcn estão funcionando
// (cores via CSS vars, dark mode via classe `.dark` no <html>).
export function HomePage() {
  const [tokenName, setTokenName] = useState('');

  return (
    <main className="bg-background text-foreground min-h-svh w-full">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Sparkles className="size-4" />
            <span>POC inicializada com sucesso</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Design Tokens Manager
          </h1>
          <p className="text-muted-foreground text-base">
            Scaffold React + Vite + Tailwind v4 + Shadcn/UI pronto para começar.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-5" />
              Criar novo token
            </CardTitle>
            <CardDescription>
              Exemplo de formulário usando os componentes Shadcn (Card, Input,
              Button).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              placeholder="Ex.: color.primary.500"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {tokenName
                ? `Pré-visualização: "${tokenName}"`
                : 'Digite um nome para o token...'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTokenName('')}>
              Limpar
            </Button>
            <Button disabled={!tokenName}>Salvar token</Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
