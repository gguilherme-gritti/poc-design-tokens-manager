import type { TokenTreeData } from '@/components/token-tree';

import defaultDictionary from '@/dictionary/dictionary-example.json';

export interface DesignSystemDefinition {
  id: string;
  name: string;
  description: string;
  /** Design system padrão da POC (`dictionary-example.json`). */
  isDefault: boolean;
  data: TokenTreeData;
}

export const DESIGN_SYSTEMS: DesignSystemDefinition[] = [
  {
    id: 'poc-default',
    name: 'POC — Sicredi',
    description: 'Tokens utilizados no Colmeia DS',
    isDefault: true,
    data: defaultDictionary as TokenTreeData,
  },
];

export function getDesignSystemById(
  id: string,
): DesignSystemDefinition | undefined {
  return DESIGN_SYSTEMS.find((ds) => ds.id === id);
}

export function designSystemsByDefaultFirst(): DesignSystemDefinition[] {
  return [...DESIGN_SYSTEMS].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault),
  );
}
