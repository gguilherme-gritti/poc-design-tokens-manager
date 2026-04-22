import type { TokenLeafAttributes, TokenNode, TokenTreeData } from './types';

/**
 * Um objeto é considerado "folha" (token final) quando possui a chave `value`.
 * Caso contrário, é tratado como "branch" (pasta).
 */
function isLeaf(raw: unknown): raw is { value: unknown; attributes?: TokenLeafAttributes } {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    Object.prototype.hasOwnProperty.call(raw, 'value')
  );
}

const COLOR_CATEGORIES = new Set(['colors', 'color', 'colors-rgb']);
const COLOR_TYPES = new Set(['color', 'colors', 'fill', 'background', 'stroke']);
const ALIAS_REGEX = /^\s*\{[^{}]+\}\s*$/;
const HEX_REGEX = /^#[0-9a-f]{3,8}$/i;
const RGB_TRIPLET_REGEX = /^\s*\d{1,3}[\s,]+\d{1,3}[\s,]+\d{1,3}(\s*\/\s*[\d.]+)?\s*$/;

/**
 * Detecta se o nó representa um token de cor usando (nessa ordem):
 * 1. `attributes.category` / `attributes.type`
 * 2. heurística no caminho (inclui "color", "colors" ou "colors-rgb")
 */
function detectColor(path: string, attrs?: TokenLeafAttributes): boolean {
  if (attrs?.category && COLOR_CATEGORIES.has(attrs.category)) return true;
  if (attrs?.type && COLOR_TYPES.has(attrs.type)) return true;
  return /(^|\.)(colors?(-rgb)?)\./.test(path);
}

/**
 * Aliases são valores que consistem integralmente numa referência do tipo `{path.to.token}`.
 * Strings que apenas contêm referências embutidas (ex.: "rgb({color.x} / ...)") não são aliases "puros".
 */
function detectAlias(value: unknown): boolean {
  return typeof value === 'string' && ALIAS_REGEX.test(value);
}

/**
 * Retorna uma string CSS válida para preview de cor, quando possível.
 * Prioriza hex, rgb e tripletos RGB (formato "130 138 130" ou "130, 138, 130").
 */
function extractColorPreview(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (HEX_REGEX.test(trimmed)) return trimmed;
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i.test(trimmed)) return trimmed;
  if (RGB_TRIPLET_REGEX.test(trimmed)) {
    const [rgb] = trimmed.split('/');
    const parts = rgb
      .trim()
      .split(/[\s,]+/)
      .slice(0, 3)
      .join(', ');
    return `rgb(${parts})`;
  }
  return null;
}

function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Cria uma folha normalizada a partir de `path + value + attributes` (sem passar por
 * `buildTokenTree`). Útil para preview em tempo real, onde queremos simular como a
 * árvore enxergaria um valor "rascunho" antes de commitar na store.
 *
 * Aplica as mesmas heurísticas de `buildTokenTree` (detectColor, detectAlias,
 * extractColorPreview, summarizeValue) para manter o comportamento consistente.
 */
export function buildLeafNode(
  path: string,
  value: unknown,
  attributes?: TokenLeafAttributes,
): Extract<TokenNode, { kind: 'leaf' }> {
  const name = path.split('.').pop() ?? path;
  const isColor = detectColor(path, attributes);
  const isAlias = detectAlias(value);
  return {
    kind: 'leaf',
    name,
    path,
    value,
    displayValue: summarizeValue(value),
    attributes,
    isColor,
    isAlias,
    colorPreview: isColor ? extractColorPreview(value) : null,
  };
}

/**
 * Converte o JSON bruto em uma árvore normalizada.
 * Executado uma única vez (via useMemo) para a raiz, para evitar recomputação em re-renders.
 */
export function buildTokenTree(raw: TokenTreeData, parentPath = ''): TokenNode[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const entries = Object.entries(raw);
  const nodes: TokenNode[] = new Array(entries.length);

  for (let i = 0; i < entries.length; i++) {
    const [name, child] = entries[i];
    const path = parentPath ? `${parentPath}.${name}` : name;

    if (isLeaf(child)) {
      const attrs = child.attributes;
      const isColor = detectColor(path, attrs);
      const isAlias = detectAlias(child.value);
      nodes[i] = {
        kind: 'leaf',
        name,
        path,
        value: child.value,
        displayValue: summarizeValue(child.value),
        attributes: attrs,
        isColor,
        isAlias,
        colorPreview: isColor ? extractColorPreview(child.value) : null,
      };
      continue;
    }

    nodes[i] = {
      kind: 'branch',
      name,
      path,
      children: buildTokenTree(child as TokenTreeData, path),
    };
  }

  return nodes;
}
