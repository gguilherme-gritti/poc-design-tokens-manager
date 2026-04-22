import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  AlertCircle,
  FileJson,
  FolderPlus,
  Layers,
  Loader2,
  Sparkles,
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
import { Textarea } from '@/components/ui/textarea';
import { DESIGN_SYSTEM_TEMPLATES } from '@/design-systems/registry';
import {
  importTokensFromZip,
  type ImportResult,
} from '@/lib/style-dictionary-import';
import { cn } from '@/lib/utils';
import type {
  CreateDesignSystemInput,
  DesignSystemOrigin,
} from '@/stores/design-system-store';

type OriginKind = 'empty' | 'template' | 'import';

interface CreateDesignSystemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: CreateDesignSystemInput) => void;
}

interface ZipPreview {
  file: File;
  result: ImportResult;
}

/**
 * Wizard de criação de design system com três origens possíveis (Caminho C):
 *   1. vazio        — começa sem nenhum token, ideal para quem vai construir manualmente.
 *   2. template     — copia um dos templates disponíveis (seed opcional para POC).
 *   3. import ZIP   — faz upload de um .zip Style Dictionary e usa como baseline.
 *
 * A origem escolhida se torna a **baseline** do workspace — não gera commit inicial.
 * Assim, o histórico só começa a existir a partir das próximas edições/importações,
 * mantendo-o limpo de ruído "virou do exemplo para o meu DS".
 */
export function CreateDesignSystemDialog({
  open,
  onOpenChange,
  onConfirm,
}: CreateDesignSystemDialogProps) {
  const [kind, setKind] = useState<OriginKind>('template');
  const [templateId, setTemplateId] = useState<string>(
    DESIGN_SYSTEM_TEMPLATES[0]?.id ?? '',
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [zipPreview, setZipPreview] = useState<ZipPreview | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipProcessing, setZipProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setKind('template');
    setTemplateId(DESIGN_SYSTEM_TEMPLATES[0]?.id ?? '');
    setName('');
    setDescription('');
    setZipPreview(null);
    setZipError(null);
    setZipProcessing(false);
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Preenche o nome automaticamente com base na origem escolhida (o usuário pode trocar).
  useEffect(() => {
    if (name.trim()) return;
    if (kind === 'template') {
      const tpl = DESIGN_SYSTEM_TEMPLATES.find((t) => t.id === templateId);
      if (tpl) setName(tpl.name);
    } else if (kind === 'empty') {
      setName('Novo design system');
    } else if (kind === 'import' && zipPreview) {
      setName(zipPreview.file.name.replace(/\.zip$/i, ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, templateId, zipPreview]);

  const handleFile = useCallback(async (file: File) => {
    setZipProcessing(true);
    setZipError(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = await importTokensFromZip(buffer);
      if (result.mergedCount === 0) {
        setZipError(
          'Nenhum arquivo JSON válido foi encontrado no ZIP.',
        );
        return;
      }
      setZipPreview({ file, result });
    } catch (err) {
      setZipError(
        err instanceof Error
          ? `Falha ao ler o ZIP: ${err.message}`
          : 'Falha desconhecida ao ler o ZIP.',
      );
    } finally {
      setZipProcessing(false);
    }
  }, []);

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

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (kind === 'template') return !!templateId;
    if (kind === 'import') return !!zipPreview;
    return true;
  }, [kind, templateId, zipPreview, name]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    let origin: DesignSystemOrigin;
    let seed: TokenTreeData | undefined;
    if (kind === 'empty') {
      origin = { kind: 'empty' };
    } else if (kind === 'template') {
      origin = { kind: 'template', templateId };
    } else {
      origin = { kind: 'import', fileName: zipPreview!.file.name };
      seed = zipPreview!.result.tree;
    }
    onConfirm({ name, description, origin, seed });
    onOpenChange(false);
  }, [canSubmit, kind, templateId, zipPreview, name, description, onConfirm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar novo design system</DialogTitle>
          <DialogDescription>
            Escolha a origem dos tokens. A seleção define a baseline inicial — nenhum
            commit é gerado automaticamente, o histórico só começa nas próximas edições.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3">
          <OriginCard
            selected={kind === 'empty'}
            onClick={() => setKind('empty')}
            icon={<FolderPlus className="size-4" />}
            title="Vazio"
            description="Comece sem nenhum token."
          />
          <OriginCard
            selected={kind === 'template'}
            onClick={() => setKind('template')}
            icon={<Sparkles className="size-4" />}
            title="Template"
            description="Copiar a partir de um seed."
          />
          <OriginCard
            selected={kind === 'import'}
            onClick={() => setKind('import')}
            icon={<Upload className="size-4" />}
            title="Importar ZIP"
            description="Subir árvore Style Dictionary."
          />
        </div>

        {kind === 'template' && (
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Template</Label>
            <div className="grid gap-2">
              {DESIGN_SYSTEM_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  className={cn(
                    'hover:bg-accent flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                    templateId === tpl.id && 'border-primary/40 bg-accent',
                  )}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Layers className="size-3.5" />
                    {tpl.name}
                  </div>
                  <span className="text-muted-foreground">{tpl.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === 'import' && (
          <div className="flex flex-col gap-2">
            {zipPreview ? (
              <ZipPreviewCard
                preview={zipPreview}
                onReplace={() => {
                  setZipPreview(null);
                  setZipError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'flex min-h-32 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-center transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/30 bg-muted/20',
                )}
              >
                {zipProcessing ? (
                  <>
                    <Loader2 className="text-muted-foreground size-5 animate-spin" />
                    <p className="text-muted-foreground text-xs">Lendo o ZIP…</p>
                  </>
                ) : (
                  <>
                    <Upload className="text-muted-foreground size-5" />
                    <p className="text-xs">
                      Arraste um{' '}
                      <code className="bg-muted rounded px-1 font-mono text-[10px]">
                        .zip
                      </code>{' '}
                      aqui
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Selecionar arquivo
                    </Button>
                  </>
                )}
              </div>
            )}
            {zipError && (
              <div className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border border-destructive/30 px-3 py-2 text-xs">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{zipError}</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds-name" className="text-xs">
              Nome do design system
            </Label>
            <Input
              id="ds-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm"
              placeholder="Ex.: App X — v1"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds-desc" className="text-xs">
              Descrição (opcional)
            </Label>
            <Textarea
              id="ds-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[38px] text-sm"
              rows={1}
              placeholder="Para aparecer no card do DS."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            Criar design system
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OriginCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:bg-accent flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
        selected && 'border-primary/50 bg-accent shadow-sm',
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <span className="text-muted-foreground text-[11px] leading-tight">
        {description}
      </span>
    </button>
  );
}

function ZipPreviewCard({
  preview,
  onReplace,
}: {
  preview: ZipPreview;
  onReplace: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <FileJson className="text-muted-foreground size-4" />
        <span className="font-medium">{preview.file.name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="info">{preview.result.mergedCount} arquivo(s)</Badge>
        <Badge variant="secondary">{preview.result.leafCount} folha(s)</Badge>
        {preview.result.collisions.length > 0 && (
          <Badge variant="warning">
            {preview.result.collisions.length} colisão(ões)
          </Badge>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[11px]"
          onClick={onReplace}
        >
          Trocar
        </Button>
      </div>
    </div>
  );
}
