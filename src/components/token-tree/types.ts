export type TokenTreeData = Record<string, unknown>;

export interface TokenLeafAttributes {
  category?: string;
  type?: string;
  [key: string]: unknown;
}

export interface TokenBranchNode {
  kind: 'branch';
  name: string;
  /** Caminho completo (ex.: `global.colors.color.grey.500`). */
  path: string;
  children: TokenNode[];
}

export interface TokenLeafNode {
  kind: 'leaf';
  name: string;
  path: string;
  value: unknown;
  /** Valor "stringificado" para exibição quando não for string. */
  displayValue: string;
  attributes?: TokenLeafAttributes;
  isColor: boolean;
  isAlias: boolean;
  /** CSS color string pronta para preview (`#rrggbb`, `rgb(...)` etc.) quando aplicável. */
  colorPreview: string | null;
}

export type TokenNode = TokenBranchNode | TokenLeafNode;

/**
 * Disparado ao clicar em uma folha da árvore.
 * O `node` é fornecido como terceiro argumento para casos onde o consumidor precisa
 * dos metadados (tipo, attributes, etc.) — ex.: renderizar um preview.
 */
export type TokenSelectHandler = (
  path: string,
  value: unknown,
  node: TokenLeafNode,
) => void;
