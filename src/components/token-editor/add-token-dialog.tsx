import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { TokenIndex, TokenTreeData } from '@/components/token-tree';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { diagnoseLeaf } from '@/lib/token-diagnostics';
import { existsAt } from '@/lib/token-mutations';

import { AliasSelector } from './alias-selector';
import { DiagnosticHint } from './diagnostic-hint';

export type NewTokenKind = 'leaf' | 'branch';
export type NewLeafValueMode = 'literal' | 'alias';

export interface NewTokenInput {
  kind: NewTokenKind;
  parentPath: string;
  name: string;
  value?: unknown;
  attributes?: Record<string, unknown>;
}

interface AddTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPath: string;
  /** Árvore atual — usada para validar unicidade do path. */
  tree: TokenTreeData;
  index: TokenIndex;
  onSubmit: (input: NewTokenInput) => void;
}

const NAME_REGEX = /^[A-Za-z0-9_-]+$/;

function defaultAttributesForPath(fullPath: string): Record<string, string> {
  if (fullPath.startsWith('global.colors')) return { category: 'colors' };
  if (fullPath.startsWith('global.motion')) return { category: 'motion' };
  if (fullPath.startsWith('global.shape')) return { category: 'shape' };
  if (fullPath.startsWith('global.type')) return { category: 'type' };
  if (fullPath.startsWith('brands.')) return { category: 'alias' };
  if (fullPath.startsWith('mixins.')) return { category: 'alias' };
  return {};
}

/**
 * Dialog guiado para adicionar um novo token ou grupo.
 *
 * Fluxo:
 *   1. Tipo: "Valor" (leaf) ou "Grupo" (branch).
 *   2. Nome do nó (último segmento).
 *   3. Para leaf, modo do valor: literal ou alias (com seletor por busca).
 *   4. Preview do JSON que será inserido.
 */
export function AddTokenDialog({
  open,
  onOpenChange,
  parentPath,
  tree,
  index,
  onSubmit,
}: AddTokenDialogProps) {
  const [kind, setKind] = useState<NewTokenKind>('leaf');
  const [name, setName] = useState('');
  const [valueMode, setValueMode] = useState<NewLeafValueMode>('literal');
  const [literal, setLiteral] = useState('');
  const [aliasExpr, setAliasExpr] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');

  const fullPath = useMemo(
    () => (parentPath ? `${parentPath}.${name}` : name),
    [parentPath, name],
  );

  useEffect(() => {
    if (!open) return;
    setKind('leaf');
    setName('');
    setValueMode('literal');
    setLiteral('');
    setAliasExpr('');
    const defaults = defaultAttributesForPath(parentPath);
    setCategory(defaults.category ?? '');
    setType(defaults.type ?? '');
  }, [open, parentPath]);

  const value: unknown = useMemo(() => {
    if (kind === 'branch') return undefined;
    if (valueMode === 'alias') return aliasExpr;
    const trimmed = literal.trim();
    if (trimmed === '') return '';
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      return numeric;
    }
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    return literal;
  }, [kind, valueMode, aliasExpr, literal]);

  const attributes = useMemo(() => {
    const attrs: Record<string, string> = {};
    if (category.trim()) attrs.category = category.trim();
    if (type.trim()) attrs.type = type.trim();
    return attrs;
  }, [category, type]);

  const nameError = useMemo(() => {
    if (!name) return null;
    if (!NAME_REGEX.test(name))
      return 'Use apenas letras, números, hífen e underline.';
    if (existsAt(tree, fullPath))
      return `Já existe um token em "${fullPath}".`;
    return null;
  }, [name, fullPath, tree]);

  const diagnostics = useMemo(() => {
    if (kind !== 'leaf' || !name || nameError) return [];
    return diagnoseLeaf(
      { path: fullPath, value },
      index,
      {
        checkInlineReferences: true,
        isBrandsScope: (p) => /(^|\.)brands(\.|$)/.test(p),
      },
    );
  }, [kind, fullPath, name, nameError, value, index]);

  const previewJson = useMemo(() => {
    if (!name) return '';
    if (kind === 'branch') {
      return JSON.stringify({ [name]: {} }, null, 2);
    }
    const node: Record<string, unknown> = { value };
    if (Object.keys(attributes).length) node.attributes = attributes;
    return JSON.stringify({ [name]: node }, null, 2);
  }, [name, kind, value, attributes]);

  const canSubmit =
    !!name &&
    !nameError &&
    (kind === 'branch' || value !== '' || valueMode === 'literal');

  const handleSubmit = () => {
    if (!canSubmit) return;
    try {
      onSubmit({
        kind,
        parentPath,
        name,
        value,
        attributes: Object.keys(attributes).length ? attributes : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao adicionar token');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar novo token</DialogTitle>
          <DialogDescription>
            {parentPath ? (
              <>
                Será inserido em{' '}
                <code className="bg-muted rounded px-1 font-mono text-[11px]">
                  {parentPath}
                </code>
                .
              </>
            ) : (
              'Será inserido na raiz do dicionário.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wide">Tipo</Label>
            <Tabs value={kind} onValueChange={(v) => setKind(v as NewTokenKind)}>
              <TabsList>
                <TabsTrigger value="leaf">Valor (token)</TabsTrigger>
                <TabsTrigger value="branch">Grupo (pasta)</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-token-name" className="text-xs">
              Nome
            </Label>
            <Input
              id="new-token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: 600, primary, radius-xl"
              className="font-mono text-xs"
              aria-invalid={!!nameError || undefined}
            />
            {nameError ? (
              <p className="text-destructive text-[11px]">{nameError}</p>
            ) : name ? (
              <p className="text-muted-foreground text-[11px]">
                Caminho final:{' '}
                <code className="bg-muted rounded px-1 font-mono">
                  {fullPath}
                </code>
              </p>
            ) : null}
          </div>

          {kind === 'leaf' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs uppercase tracking-wide">
                  Fonte do valor
                </Label>
                <Tabs
                  value={valueMode}
                  onValueChange={(v) => setValueMode(v as NewLeafValueMode)}
                >
                  <TabsList>
                    <TabsTrigger value="literal">Literal</TabsTrigger>
                    <TabsTrigger value="alias">Alias</TabsTrigger>
                  </TabsList>
                  <TabsContent value="literal" className="flex flex-col gap-2 pt-2">
                    <Input
                      value={literal}
                      onChange={(e) => setLiteral(e.target.value)}
                      placeholder='Ex.: "#828A82", "8px", 400'
                      className="font-mono text-xs"
                    />
                  </TabsContent>
                  <TabsContent value="alias" className="flex flex-col gap-2 pt-2">
                    <AliasSelector
                      index={index}
                      value={aliasExpr}
                      onChange={setAliasExpr}
                      ownerPath={fullPath}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-token-category" className="text-xs">
                    category
                  </Label>
                  <Input
                    id="new-token-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="colors, motion, shape..."
                    className="text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-token-type" className="text-xs">
                    type
                  </Label>
                  <Input
                    id="new-token-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="color, duration, border-radius..."
                    className="text-xs"
                  />
                </div>
              </div>

              <DiagnosticHint
                diagnostics={diagnostics}
                onPickSuggestion={(s) => {
                  setValueMode('alias');
                  setAliasExpr(`{${s}}`);
                }}
              />
            </>
          )}

          {previewJson && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs uppercase tracking-wide">
                Preview do JSON
              </Label>
              <pre className="bg-muted/40 max-h-48 overflow-auto rounded-md border p-3 text-[11px] leading-relaxed">
                {previewJson}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
