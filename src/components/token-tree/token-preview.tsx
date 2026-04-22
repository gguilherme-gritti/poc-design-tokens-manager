import { memo, useCallback, useMemo, useState } from 'react';
import { CornerDownRight, Eye, PlayCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { resolveValue, type TokenIndex } from './token-index';
import type { TokenLeafNode } from './types';

/* -------------------------------------------------------------------------- */
/*                            Type discovery / utils                           */
/* -------------------------------------------------------------------------- */

type PreviewKind =
  | 'color'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'borderRadius'
  | 'borderWidth'
  | 'spacing'
  | 'shadow'
  | 'opacity'
  | 'duration'
  | 'curve'
  | 'breakpoint'
  | 'object'
  | 'none';

function inferKind(node: TokenLeafNode): PreviewKind {
  if (node.isColor) return 'color';
  const type = node.attributes?.type;
  switch (type) {
    case 'font-family':
      return 'fontFamily';
    case 'font-size':
      return 'fontSize';
    case 'font-weight':
      return 'fontWeight';
    case 'line-height':
      return 'lineHeight';
    case 'border-radius':
      return 'borderRadius';
    case 'border-width':
      return 'borderWidth';
    case 'spacing':
    case 'size':
      return 'spacing';
    case 'shadows':
      return 'shadow';
    case 'opacity':
      return 'opacity';
    case 'duration':
      return 'duration';
    case 'curves':
      return 'curve';
    case 'breakpoints':
      return 'breakpoint';
  }
  if (typeof node.value === 'object' && node.value !== null) return 'object';
  return 'none';
}

interface ResolvedPreview {
  kind: PreviewKind;
  /** Valor CSS "pronto para uso" (aliases e refs `{}` já substituídos). */
  cssValue: string;
  /** Nó destino, quando diferente do selecionado (aliases). */
  resolvedFrom?: TokenLeafNode;
}

function getResolvedPreview(node: TokenLeafNode, index: TokenIndex): ResolvedPreview {
  let target: TokenLeafNode = node;
  if (node.isAlias) {
    const resolved = index
      ? (() => {
          const match = /^\s*\{([^{}]+)\}\s*$/.exec(node.displayValue);
          return match ? index.get(match[1].trim()) ?? null : null;
        })()
      : null;
    if (resolved) target = resolved;
  }
  const kind = inferKind(target);
  const raw = target.value;
  const cssValue =
    typeof raw === 'string' ? (resolveValue(raw, index) as string) : target.displayValue;
  return {
    kind,
    cssValue,
    resolvedFrom: target !== node ? target : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Preview component                              */
/* -------------------------------------------------------------------------- */

interface TokenPreviewProps {
  node: TokenLeafNode;
  index: TokenIndex;
  /**
   * Quando `true`, renderiza apenas o conteúdo interno (sem `Card`/`CardHeader`),
   * para ser embutido em outro card (ex.: dentro do card de edição).
   */
  embedded?: boolean;
}

export const TokenPreview = memo(function TokenPreview({
  node,
  index,
  embedded = false,
}: TokenPreviewProps) {
  const preview = useMemo(() => getResolvedPreview(node, index), [node, index]);
  const typeLabel = preview.resolvedFrom?.attributes?.type ?? node.attributes?.type ?? preview.kind;

  const body = (
    <>
      {preview.resolvedFrom && (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <CornerDownRight className="size-3.5" />
          <span>Alias resolvido para</span>
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">
            {preview.resolvedFrom.path}
          </code>
        </div>
      )}

      <PreviewSurface kind={preview.kind} cssValue={preview.cssValue} node={node} />
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Eye className="size-4" />
          Preview
          <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide">
            {typeLabel}
          </span>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="size-4" />
          Preview
          <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide">
            {typeLabel}
          </span>
        </CardTitle>
        <CardDescription>
          Representação visual do token aplicado em um elemento.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{body}</CardContent>
    </Card>
  );
});

/* -------------------------------------------------------------------------- */
/*                              Preview renderers                              */
/* -------------------------------------------------------------------------- */

interface SurfaceProps {
  kind: PreviewKind;
  cssValue: string;
  node: TokenLeafNode;
}

function PreviewSurface({ kind, cssValue, node }: SurfaceProps) {
  switch (kind) {
    case 'color':
      return <ColorSurface value={cssValue} />;
    case 'fontFamily':
      return <FontFamilySurface value={cssValue} />;
    case 'fontSize':
      return <FontSizeSurface value={cssValue} />;
    case 'fontWeight':
      return <FontWeightSurface value={cssValue} />;
    case 'lineHeight':
      return <LineHeightSurface value={cssValue} />;
    case 'borderRadius':
      return <BorderRadiusSurface value={cssValue} />;
    case 'borderWidth':
      return <BorderWidthSurface value={cssValue} />;
    case 'spacing':
      return <SpacingSurface value={cssValue} />;
    case 'shadow':
      return <ShadowSurface value={cssValue} />;
    case 'opacity':
      return <OpacitySurface value={cssValue} />;
    case 'duration':
      return <DurationSurface value={cssValue} />;
    case 'curve':
      return <CurveSurface value={cssValue} />;
    case 'breakpoint':
      return <BreakpointSurface value={cssValue} />;
    case 'object':
      return <ObjectSurface value={node.value} />;
    default:
      return <NoPreview />;
  }
}

/* -------------------------------------------------------------------------- */

function PreviewFrame({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-muted/30 flex min-h-40 flex-col items-center justify-center gap-3 rounded-md border p-6',
        className,
      )}
    >
      {children}
      {label && (
        <span className="text-muted-foreground font-mono text-[11px]">{label}</span>
      )}
    </div>
  );
}

/* ------------------------------ Color ------------------------------------- */

function ColorSurface({ value }: { value: string }) {
  // Converte triplet "130 138 130" em "rgb(130, 138, 130)" para funcionar como bg CSS.
  const cssColor = /^\s*\d{1,3}[\s,]+\d{1,3}[\s,]+\d{1,3}/.test(value)
    ? `rgb(${value.trim().split(/[\s,]+/).slice(0, 3).join(', ')})`
    : value;
  return (
    <PreviewFrame label={value}>
      <div
        className="border-border/60 ring-background/50 size-28 rounded-lg border shadow-sm ring-4"
        style={{ backgroundColor: cssColor }}
      />
    </PreviewFrame>
  );
}

/* ----------------------------- Typography --------------------------------- */

function FontFamilySurface({ value }: { value: string }) {
  return (
    <PreviewFrame label={value}>
      <span className="text-5xl font-semibold tracking-tight" style={{ fontFamily: value }}>
        Aa Bb Cc 0123
      </span>
      <span className="text-muted-foreground text-sm" style={{ fontFamily: value }}>
        The quick brown fox jumps over the lazy dog.
      </span>
    </PreviewFrame>
  );
}

function FontSizeSurface({ value }: { value: string }) {
  return (
    <PreviewFrame label={value} className="items-start">
      <p className="text-foreground" style={{ fontSize: value, lineHeight: 1.2 }}>
        The quick brown fox jumps over the lazy dog.
      </p>
    </PreviewFrame>
  );
}

function FontWeightSurface({ value }: { value: string }) {
  const numeric = Number(value);
  return (
    <PreviewFrame label={value}>
      <p
        className="text-3xl"
        style={{ fontWeight: Number.isFinite(numeric) ? numeric : (value as string) }}
      >
        Design Tokens
      </p>
    </PreviewFrame>
  );
}

function LineHeightSurface({ value }: { value: string }) {
  return (
    <PreviewFrame label={value} className="items-start">
      <p className="text-sm" style={{ lineHeight: value }}>
        Tokens são a fonte única da verdade no design system. Eles garantem consistência
        entre plataformas (web, iOS, Android) e simplificam mudanças de tema, pois valores
        compartilhados mudam em um único lugar e se propagam para toda a UI.
      </p>
    </PreviewFrame>
  );
}

/* ------------------------------- Shape ------------------------------------ */

function BorderRadiusSurface({ value }: { value: string }) {
  return (
    <PreviewFrame label={value}>
      <div
        className="bg-primary/80 size-28"
        style={{ borderRadius: value }}
      />
    </PreviewFrame>
  );
}

function BorderWidthSurface({ value }: { value: string }) {
  return (
    <PreviewFrame label={value}>
      <div
        className="border-primary bg-background size-28 rounded-md"
        style={{ borderWidth: value, borderStyle: 'solid' }}
      />
    </PreviewFrame>
  );
}

function SpacingSurface({ value }: { value: string }) {
  return (
    <PreviewFrame label={value}>
      <div className="bg-muted flex items-center overflow-hidden rounded-md p-2">
        <div className="bg-primary h-10 w-10 rounded-sm" />
        <div style={{ width: value }} className="bg-primary/30 h-10" />
        <div className="bg-primary h-10 w-10 rounded-sm" />
      </div>
      <div
        className="bg-primary/20 border-primary/40 rounded-md border border-dashed"
        style={{ width: value, height: value, minWidth: 4, minHeight: 4 }}
      />
    </PreviewFrame>
  );
}

function ShadowSurface({ value }: { value: string }) {
  return (
    <PreviewFrame label={value} className="bg-background min-h-52">
      <div
        className="bg-card size-32 rounded-xl"
        style={{ boxShadow: value }}
      />
    </PreviewFrame>
  );
}

function OpacitySurface({ value }: { value: string }) {
  const n = Number(value);
  const opacity = Number.isFinite(n) ? n : value;
  return (
    <PreviewFrame label={value}>
      <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-md [background-image:conic-gradient(var(--muted)_0_25%,transparent_0_50%,var(--muted)_0_75%,transparent_0)] [background-size:12px_12px]">
        <div
          className="bg-primary size-20 rounded-md"
          style={{ opacity: opacity as number }}
        />
      </div>
    </PreviewFrame>
  );
}

/* ------------------------------- Motion ----------------------------------- */

function DurationSurface({ value }: { value: string }) {
  const [playing, setPlaying] = useState(false);
  const play = useCallback(() => {
    setPlaying(false);
    requestAnimationFrame(() => setPlaying(true));
  }, []);

  return (
    <PreviewFrame label={value}>
      <div className="bg-muted relative h-8 w-full overflow-hidden rounded-md">
        <div
          key={String(playing)}
          className="bg-primary absolute inset-y-0 left-0"
          style={{
            width: playing ? '100%' : '0%',
            transitionProperty: 'width',
            transitionDuration: value,
            transitionTimingFunction: 'ease-in-out',
          }}
        />
      </div>
      <Button size="sm" variant="outline" onClick={play}>
        <PlayCircle className="size-4" />
        Reproduzir ({value})
      </Button>
    </PreviewFrame>
  );
}

function CurveSurface({ value }: { value: string }) {
  const [pos, setPos] = useState(0);
  const toggle = useCallback(() => setPos((p) => (p === 0 ? 1 : 0)), []);
  return (
    <PreviewFrame label={value}>
      <div className="bg-muted relative h-14 w-full rounded-md">
        <div
          className="bg-primary absolute top-1/2 size-8 -translate-y-1/2 rounded-md"
          style={{
            left: pos ? 'calc(100% - 2rem)' : '0%',
            transitionProperty: 'left',
            transitionDuration: '700ms',
            transitionTimingFunction: value,
          }}
        />
      </div>
      <Button size="sm" variant="outline" onClick={toggle}>
        <PlayCircle className="size-4" />
        Alternar posição
      </Button>
    </PreviewFrame>
  );
}

/* ---------------------------- Breakpoints --------------------------------- */

function BreakpointSurface({ value }: { value: string }) {
  return (
    <PreviewFrame label={value} className="items-stretch">
      <div className="bg-muted relative h-8 w-full overflow-hidden rounded-md">
        <div
          className="bg-primary/70 absolute inset-y-0 left-0 flex items-center justify-end pr-2 text-[10px] font-medium text-white"
          style={{ width: `min(100%, ${value})`, maxWidth: '100%' }}
        >
          {value}
        </div>
      </div>
      <Separator />
      <p className="text-muted-foreground text-center text-xs">
        Largura mínima do viewport para esse breakpoint.
      </p>
    </PreviewFrame>
  );
}

/* ------------------------------- Object ----------------------------------- */

function ObjectSurface({ value }: { value: unknown }) {
  return (
    <div className="bg-muted/40 rounded-md border">
      <div className="text-muted-foreground border-b px-3 py-2 text-xs">
        Valor composto — preview direto indisponível.
      </div>
      <pre className="overflow-auto p-3 text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/* -------------------------------- None ------------------------------------ */

function NoPreview() {
  return (
    <div className="text-muted-foreground flex min-h-40 items-center justify-center rounded-md border border-dashed text-xs">
      Este token não possui um preview visual associado.
    </div>
  );
}
