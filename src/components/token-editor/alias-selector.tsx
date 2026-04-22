import { useMemo, useState } from 'react';
import { ChevronsUpDown, Link2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { resolveValue, type TokenIndex } from '@/components/token-tree';

interface AliasSelectorProps {
  index: TokenIndex;
  /** Valor atual em formato `{path.dotted}` (ou vazio). */
  value: string;
  onChange: (nextExpression: string) => void;
  /** Path do token em edição — usado para priorizar referências de scope apropriado. */
  ownerPath?: string;
  /** Prefixos preferenciais (ordena esses primeiro). Default: ["global.", "mixins."]. */
  preferredPrefixes?: string[];
  placeholder?: string;
}

const DEFAULT_PREFIXES = ['global.', 'mixins.'];

/**
 * Combobox de alias construído sobre o `TokenIndex`. As entradas do index já incluem
 * todos os sufixos dotted para cada folha, então a busca por `color.green.500`
 * encontra diretamente o token em `global.colors.color.green.500`.
 *
 * Ordenação:
 *   1. Começa com os `preferredPrefixes` (ex.: `global.*`, `mixins.*`) quando o owner
 *      está em `brands.*` — satisfaz a regra de consumo do Style Dictionary do projeto.
 *   2. Depois o resto.
 */
export function AliasSelector({
  index,
  value,
  onChange,
  ownerPath,
  preferredPrefixes = DEFAULT_PREFIXES,
  placeholder = 'Buscar token por path...',
}: AliasSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const ownerInBrands = useMemo(
    () => !!ownerPath && /(^|\.)brands(\.|$)/.test(ownerPath),
    [ownerPath],
  );

  const entries = useMemo(() => {
    const keys = Array.from(index.keys());
    const seenLeafPaths = new Set<string>();
    const uniqueByLeafPath: { key: string; leafPath: string }[] = [];
    for (const key of keys) {
      const leaf = index.get(key);
      if (!leaf) continue;
      if (seenLeafPaths.has(leaf.path)) continue;
      seenLeafPaths.add(leaf.path);
      uniqueByLeafPath.push({ key: leaf.path, leafPath: leaf.path });
    }
    return uniqueByLeafPath;
  }, [index]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = q
      ? entries.filter((e) => e.leafPath.toLowerCase().includes(q))
      : entries;

    if (!ownerInBrands) return items.slice(0, 100);

    const preferred: typeof items = [];
    const rest: typeof items = [];
    for (const item of items) {
      if (preferredPrefixes.some((p) => item.leafPath.startsWith(p))) {
        preferred.push(item);
      } else {
        rest.push(item);
      }
    }
    return [...preferred, ...rest].slice(0, 100);
  }, [entries, query, ownerInBrands, preferredPrefixes]);

  const extractedPath = useMemo(() => {
    const match = /^\s*\{([^{}]+)\}\s*$/.exec(value);
    return match ? match[1].trim() : '';
  }, [value]);

  const resolvedLeaf = useMemo(() => {
    if (!extractedPath) return null;
    return index.get(extractedPath) ?? null;
  }, [extractedPath, index]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-mono text-xs"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Link2 className="size-3.5 shrink-0 text-sky-500" />
            <span className="truncate">
              {value || 'Selecionar token de referência...'}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
        <ul
          className="max-h-72 overflow-auto p-1"
          role="listbox"
          aria-label="Tokens disponíveis"
        >
          {filtered.length === 0 ? (
            <li className="text-muted-foreground px-3 py-6 text-center text-xs">
              Nenhum token encontrado.
            </li>
          ) : (
            filtered.map((item) => {
              const leaf = index.get(item.key);
              const leafPath = leaf?.path ?? item.key;
              const isSelected = leafPath === extractedPath;
              const preview =
                typeof leaf?.value === 'string'
                  ? resolveValue(leaf.value, index)
                  : leaf?.displayValue;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(`{${leafPath}}`);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'hover:bg-accent flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-xs',
                      isSelected && 'bg-accent',
                    )}
                  >
                    <span className="font-mono text-foreground">
                      {leafPath}
                    </span>
                    <span className="text-muted-foreground truncate text-[10px]">
                      {typeof preview === 'string'
                        ? preview
                        : String(preview ?? '')}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {resolvedLeaf && (
          <div className="text-muted-foreground border-t px-3 py-2 text-[10px]">
            Selecionado:{' '}
            <code className="bg-muted rounded px-1 font-mono">
              {resolvedLeaf.path}
            </code>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
