import { useEffect, useMemo, useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import type { TokenIndex, TokenLeafNode } from '@/components/token-tree';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { diagnoseLeaf } from '@/lib/token-diagnostics';

import { AliasSelector } from './alias-selector';
import { DiagnosticHint } from './diagnostic-hint';

interface TokenEditorProps {
  node: TokenLeafNode;
  index: TokenIndex;
  onSubmit: (nextValue: unknown) => void;
  /**
   * Disparado a cada alteração do formulário (modo/valor atual). Habilita preview em tempo real
   * no pai, sem depender de "Aplicar alteração".
   * O segundo argumento informa se o valor difere do persistido no store (`hasChanges`).
   */
  onValueChange?: (liveValue: unknown, hasChanges: boolean) => void;
}

type EditorMode = 'literal' | 'alias' | 'object';

const STRICT_ALIAS_REGEX = /^\s*\{[^{}]+\}\s*$/;

function detectMode(value: unknown): EditorMode {
  if (typeof value === 'object' && value !== null) return 'object';
  if (typeof value === 'string' && STRICT_ALIAS_REGEX.test(value)) {
    return 'alias';
  }
  return 'literal';
}

function stringifyForLiteral(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return JSON.stringify(value);
}

/**
 * Formulário de edição do `value` de uma folha. Exibe dois modos mutuamente exclusivos
 * (literal / alias). Para valores compostos (objetos), cai em um editor JSON simples.
 *
 * Diagnósticos (referências quebradas, escopo fora de `global/mixins` etc.) são
 * calculados em tempo real pelo mesmo motor usado para badges na árvore.
 */
export function TokenEditor({
  node,
  index,
  onSubmit,
  onValueChange,
}: TokenEditorProps) {
  const initialMode = useMemo(() => detectMode(node.value), [node.value]);
  const [mode, setMode] = useState<EditorMode>(initialMode);

  const [literal, setLiteral] = useState(() => stringifyForLiteral(node.value));
  const [aliasExpr, setAliasExpr] = useState(() =>
    typeof node.value === 'string' && STRICT_ALIAS_REGEX.test(node.value)
      ? node.value
      : '',
  );
  const [rawJson, setRawJson] = useState(() =>
    JSON.stringify(node.value ?? null, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setLiteral(stringifyForLiteral(node.value));
    setAliasExpr(
      typeof node.value === 'string' && STRICT_ALIAS_REGEX.test(node.value)
        ? node.value
        : '',
    );
    setRawJson(JSON.stringify(node.value ?? null, null, 2));
    setJsonError(null);
  }, [node.path, node.value, initialMode]);

  const currentValue: unknown = useMemo(() => {
    if (mode === 'alias') return aliasExpr || '';
    if (mode === 'object') {
      try {
        const parsed = JSON.parse(rawJson || 'null');
        return parsed;
      } catch {
        return node.value;
      }
    }
    const numeric = Number(literal);
    if (literal.trim() !== '' && !Number.isNaN(numeric) && !/[^0-9eE+\-.]/.test(literal)) {
      return numeric;
    }
    if (literal === 'true') return true;
    if (literal === 'false') return false;
    return literal;
  }, [mode, aliasExpr, rawJson, literal, node.value]);

  const isBrandsScope = useMemo(
    () => /(^|\.)brands(\.|$)/.test(node.path),
    [node.path],
  );

  const diagnostics = useMemo(
    () =>
      diagnoseLeaf(
        { path: node.path, value: currentValue },
        index,
        {
          checkInlineReferences: true,
          isBrandsScope: () => isBrandsScope,
        },
      ),
    [node.path, currentValue, index, isBrandsScope],
  );

  const hasBlockingError = diagnostics.some((d) => d.severity === 'error');
  const hasChanges = useMemo(() => {
    try {
      return JSON.stringify(currentValue) !== JSON.stringify(node.value);
    } catch {
      return true;
    }
  }, [currentValue, node.value]);

  // Propaga o valor atual para o pai para alimentar o preview ao vivo.
  // Usa `useEffect` para garantir que a notificação aconteça fora da fase de render.
  useEffect(() => {
    onValueChange?.(currentValue, hasChanges);
  }, [currentValue, hasChanges, onValueChange]);

  const canSubmit =
    hasChanges && (mode !== 'object' || jsonError === null);

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (mode === 'object') {
      try {
        JSON.parse(rawJson || 'null');
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : 'JSON inválido');
        return;
      }
    }
    onSubmit(currentValue);
  };

  const handleReset = () => {
    setLiteral(stringifyForLiteral(node.value));
    setAliasExpr(
      typeof node.value === 'string' && STRICT_ALIAS_REGEX.test(node.value)
        ? node.value
        : '',
    );
    setRawJson(JSON.stringify(node.value ?? null, null, 2));
    setMode(initialMode);
    setJsonError(null);
    toast.info('Edição descartada.');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label className="text-xs uppercase tracking-wide">Modo de valor</Label>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as EditorMode)}
          className="gap-2"
        >
          <TabsList>
            <TabsTrigger value="literal">Literal</TabsTrigger>
            <TabsTrigger value="alias">Alias</TabsTrigger>
            <TabsTrigger value="object" disabled={initialMode !== 'object'}>
              Composto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="literal" className="flex flex-col gap-2">
            <Label htmlFor={`editor-literal-${node.path}`} className="text-xs">
              Valor literal
            </Label>
            <Input
              id={`editor-literal-${node.path}`}
              value={literal}
              onChange={(e) => setLiteral(e.target.value)}
              placeholder='Ex.: "#FF00AA", "16px", 400'
              className="font-mono text-xs"
            />
            <p className="text-muted-foreground text-[11px]">
              Números e booleanos são convertidos automaticamente; strings são
              mantidas como estão.
            </p>
          </TabsContent>

          <TabsContent value="alias" className="flex flex-col gap-2">
            <Label className="text-xs">Token de referência</Label>
            <AliasSelector
              index={index}
              value={aliasExpr}
              onChange={(v) => setAliasExpr(v)}
              ownerPath={node.path}
            />
            <p className="text-muted-foreground text-[11px]">
              O valor será armazenado como <code>{'{caminho.pontuado}'}</code>.
              {isBrandsScope && ' Em brands, prefira referências a global.* ou mixins.*'}
            </p>
          </TabsContent>

          <TabsContent value="object" className="flex flex-col gap-2">
            <Label htmlFor={`editor-json-${node.path}`} className="text-xs">
              JSON bruto
            </Label>
            <Textarea
              id={`editor-json-${node.path}`}
              value={rawJson}
              onChange={(e) => {
                setRawJson(e.target.value);
                try {
                  JSON.parse(e.target.value || 'null');
                  setJsonError(null);
                } catch (err) {
                  setJsonError(err instanceof Error ? err.message : 'JSON inválido');
                }
              }}
              rows={8}
              className="font-mono text-xs"
            />
            {jsonError && (
              <p className="text-destructive text-[11px]">{jsonError}</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <DiagnosticHint
        diagnostics={diagnostics}
        onPickSuggestion={(s) => {
          setMode('alias');
          setAliasExpr(`{${s}}`);
        }}
      />

      {hasBlockingError && (
        <p className="text-muted-foreground text-[11px]">
          Você pode salvar mesmo com erros — a inconsistência ficará marcada na
          árvore para correção posterior.
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={!hasChanges}
        >
          <Undo2 className="size-3.5" />
          Restaurar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          <Save className="size-3.5" />
          Aplicar alteração
        </Button>
      </div>
    </div>
  );
}
