import { memo } from 'react';

import { cn } from '@/lib/utils';

interface ColorPreviewProps {
  color: string | null;
  className?: string;
}

/**
 * Pequeno círculo de preview ao lado do nome de tokens de cor.
 * Quando o token é um alias/valor não-CSS, renderiza um padrão xadrez como fallback.
 */
export const ColorPreview = memo(function ColorPreview({ color, className }: ColorPreviewProps) {
  const hasPreview = !!color;
  return (
    <span
      aria-hidden
      className={cn(
        'ring-border/60 inline-block size-3 shrink-0 rounded-full ring-1',
        !hasPreview && 'bg-[conic-gradient(var(--muted)_0_25%,transparent_0_50%,var(--muted)_0_75%,transparent_0)] bg-[length:6px_6px]',
        className,
      )}
      style={hasPreview ? { backgroundColor: color as string } : undefined}
    />
  );
});
