import type { TokenTreeData } from '@/components/token-tree';

import defaultDictionary from '@/dictionary/dictionary-example.json';

/**
 * Templates são "sementes" opcionais usadas ao criar um design system novo.
 *
 * A escolha explícita de uma origem (vazio / template / import) é feita no momento
 * de criação — evitando que o JSON de exemplo apareça no histórico dos design systems
 * do usuário como um "commit inicial" confuso.
 */
export interface DesignSystemTemplate {
  id: string;
  name: string;
  description: string;
  data: TokenTreeData;
}

export const DESIGN_SYSTEM_TEMPLATES: DesignSystemTemplate[] = [
  {
    id: 'poc-sicredi',
    name: 'POC — Sicredi',
    description: 'Tokens utilizados no Colmeia DS (dictionary-example.json).',
    data: defaultDictionary as TokenTreeData,
  },
];

export function getTemplateById(id: string): DesignSystemTemplate | undefined {
  return DESIGN_SYSTEM_TEMPLATES.find((t) => t.id === id);
}
