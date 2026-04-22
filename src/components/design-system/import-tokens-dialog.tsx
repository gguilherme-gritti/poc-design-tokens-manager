import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  FileJson,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Upload,
} from 'lucide-react';

import type { TokenTreeData } from '@/components/token-tree';
import { Badge } from '@/components/ui/badge';
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
import { diffTrees, type TokenDiffEntry } from '@/lib/token-diff';
import {
  importTokensFromZip,
  type Collision,
  type ImportResult,
} from '@/lib/style-dictionary-import';
import { cn } from '@/lib/utils';

interface ImportTokensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Árvore atual do DS (usada para calcular o diff preview). */
  currentTree: TokenTreeData;
  /** Confirmação aplica a árvore importada; `label` opcional vira o título do commit. */
  onConfirm: (tree: TokenTreeData, label?: string) => void;
}

interface PreviewState {
  file: File;
  result: ImportResult;
  diff: TokenDiffEntry[];
}

/**
 * Fluxo de upload em 3 estados:
 *   1. idle       — campo de upload (drag & drop ou file picker).
 *   2. processing — parser do zip em andamento (pequenos zips são quase instantâneos).
 *   3. preview    — árvore importada + resumo do diff vs. árvore atual.
 *
 * O preview é a parte mais importante para a POC: mostra **o que será alterado no histórico**
 * antes de o usuário confirmar. Na confirmação, a store gera um commit único com todas as
 * mudanças — o diff preview aqui é derivado dos mesmos dados que o `HistoryPanel` vai exibir.
 */
export function ImportTokensDialog({
  open,
  onOpenChange,
  currentTree,
  onConfirm,
}: ImportTokensDialogProps) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [label, setLabel] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setProcessing(false);
    setLabel('');
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setProcessing(true);
      setError(null);
      try {
        const buffer = await file.arrayBuffer();
        const result = await importTokensFromZip(buffer);
        if (result.mergedCount === 0) {
          setError(
            'Nenhum arquivo JSON válido foi encontrado no ZIP. Verifique o conteúdo.',
          );
          setProcessing(false);
          return;
        }
        const diff = diffTrees(currentTree, result.tree);
        setPreview({ file, result, diff });
        setLabel(defaultLabel(file.name, diff.length));
      } catch (err) {
        setError(
          err instanceof Error
            ? `Falha ao ler o ZIP: ${err.message}`
            : 'Falha desconhecida ao ler o ZIP.',
        );
      } finally {
        setProcessing(false);
      }
    },
    [currentTree],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    onConfirm(preview.result.tree, label.trim() || undefined);
    handleOpenChange(false);
  }, [preview, label, onConfirm, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar árvore de tokens via ZIP</DialogTitle>
          <DialogDescription>
            A importação substitui a árvore atual pela árvore do arquivo. O diff abaixo é
            exatamente o que será registrado no histórico.
          </DialogDescription>
        </DialogHeader>

        {!preview && (
          <UploadArea
            isDragging={isDragging}
            processing={processing}
            error={error}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onPickFile={() => fileInputRef.current?.click()}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={handleInputChange}
        />

        {preview && <PreviewPanel preview={preview} />}

        {preview && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-label" className="text-xs">
              Nome do commit no histórico
            </Label>
            <Input
              id="import-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Import tokens.zip (v2)"
              className="text-xs"
            />
          </div>
        )}

        <DialogFooter className="justify-between sm:justify-between">
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setError(null);
                setLabel('');
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Trocar arquivo
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!preview || preview.diff.length === 0}
            >
              Aplicar e salvar no histórico
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultLabel(fileName: string, diffCount: number): string {
  const base = fileName.replace(/\.zip$/i, '');
  return `Import: ${base} (${diffCount} alteração${diffCount === 1 ? '' : 'ões'})`;
}

/* -------------------------------------------------------------------------- */
/*                              Sub-componentes                               */
/* -------------------------------------------------------------------------- */

function UploadArea({
  isDragging,
  processing,
  error,
  onDragOver,
  onDragLeave,
  onDrop,
  onPickFile,
}: {
  isDragging: boolean;
  processing: boolean;
  error: string | null;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onPickFile: () => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/30 bg-muted/20',
      )}
    >
      {processing ? (
        <>
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">Lendo o ZIP…</p>
        </>
      ) : (
        <>
          <Upload className="text-muted-foreground size-6" />
          <p className="text-sm">
            Arraste um arquivo{' '}
            <code className="bg-muted rounded px-1 font-mono text-xs">.zip</code> aqui
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onPickFile}>
            Selecionar arquivo
          </Button>
          <p className="text-muted-foreground mt-1 text-[11px]">
            Formato esperado: árvore Style Dictionary (conteúdo dos JSONs é mesclado na
            raiz).
          </p>
        </>
      )}
      {error && (
        <div className="bg-destructive/10 text-destructive mt-3 flex items-start gap-2 rounded-md border border-destructive/30 px-3 py-2 text-left text-xs">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function PreviewPanel({ preview }: { preview: PreviewState }) {
  const { file, result, diff } = preview;
  const counts = useMemo(() => {
    let added = 0;
    let removed = 0;
    let modified = 0;
    for (const d of diff) {
      if (d.kind === 'added') added += 1;
      else if (d.kind === 'removed') removed += 1;
      else modified += 1;
    }
    return { added, removed, modified };
  }, [diff]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <FileJson className="text-muted-foreground size-4" />
          <span className="font-medium">{file.name}</span>
          <span className="text-muted-foreground">
            ({formatSize(file.size)})
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="info">{result.mergedCount} arquivo(s) JSON</Badge>
          <Badge variant="secondary">{result.leafCount} folha(s)</Badge>
          {result.skippedCount > 0 && (
            <Badge variant="outline">{result.skippedCount} ignorado(s)</Badge>
          )}
        </div>
      </div>

      {result.collisions.length > 0 && (
        <CollisionsWarning collisions={result.collisions} />
      )}

      {diff.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-xs">
          A árvore importada é idêntica à atual. Nada a aplicar.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="success">
              <Plus className="size-3" /> {counts.added} adicionados
            </Badge>
            <Badge variant="info">
              <Pencil className="size-3" /> {counts.modified} modificados
            </Badge>
            <Badge variant="destructive">
              <Minus className="size-3" /> {counts.removed} removidos
            </Badge>
          </div>

          <DiffPreviewList diff={diff} />
        </>
      )}
    </div>
  );
}

function CollisionsWarning({ collisions }: { collisions: Collision[] }) {
  const displayed = collisions.slice(0, 5);
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-400">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-3.5" />
        {collisions.length} colisão(ões) detectada(s) — o último arquivo prevaleceu:
      </div>
      <ul className="mt-1 list-disc pl-5">
        {displayed.map((c, i) => (
          <li key={`${c.path}-${i}`}>
            <code className="font-mono">{c.path}</code>{' '}
            <span className="opacity-70">
              ({c.firstFile} → {c.secondFile})
            </span>
          </li>
        ))}
        {collisions.length > displayed.length && (
          <li className="opacity-70">
            …e mais {collisions.length - displayed.length} não listadas.
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Lista virtualizada-simples: para POCs com dezenas/centenas de mudanças, usamos
 * `max-h` + `overflow-auto` + truncamento das modified/added/removed (mostra até 100
 * entradas; o resumo no topo mostra totais corretos).
 */
function DiffPreviewList({ diff }: { diff: TokenDiffEntry[] }) {
  const LIMIT = 100;
  const visible = diff.slice(0, LIMIT);
  const hiddenCount = diff.length - visible.length;

  return (
    <div className="flex max-h-80 flex-col gap-1 overflow-auto rounded-md border p-2">
      {visible.map((entry) => (
        <DiffRow key={entry.path} entry={entry} />
      ))}
      {hiddenCount > 0 && (
        <p className="text-muted-foreground px-2 py-1 text-center text-[11px]">
          + {hiddenCount} alteração(ões) não exibidas (limite do preview).
        </p>
      )}
    </div>
  );
}

function DiffRow({ entry }: { entry: TokenDiffEntry }) {
  return (
    <div className="flex items-center gap-2 rounded-sm px-2 py-1 text-[11px] hover:bg-muted/40">
      <DiffBadge kind={entry.kind} />
      <code className="truncate font-mono">{entry.path}</code>
    </div>
  );
}

function DiffBadge({ kind }: { kind: TokenDiffEntry['kind'] }) {
  if (kind === 'added')
    return (
      <Badge variant="success" className="min-w-16 justify-center">
        <Plus className="size-3" /> added
      </Badge>
    );
  if (kind === 'removed')
    return (
      <Badge variant="destructive" className="min-w-16 justify-center">
        <Minus className="size-3" /> removed
      </Badge>
    );
  return (
    <Badge variant="info" className="min-w-16 justify-center">
      <Pencil className="size-3" /> modified
    </Badge>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
