import { unzipSync, strFromU8 } from 'fflate';

import type { TokenTreeData } from '@/components/token-tree';
import { isLeafObject } from '@/lib/token-mutations';

export interface ImportedFile {
  /** Caminho dentro do ZIP (ex.: `global-tokens/breakpoints.json`). */
  path: string;
  /** JSON parseado. `null` se o arquivo não pôde ser interpretado. */
  data: unknown;
  /** Erro de parse, quando houver. */
  error?: string;
  /** Namespace computado para onde o conteúdo foi mesclado (ex.: `global.breakpoints`). */
  mergedInto?: string;
}

export interface ImportResult {
  /** Árvore final resultante do merge dos JSONs. */
  tree: TokenTreeData;
  /** Arquivos processados (inclui os que falharam). */
  files: ImportedFile[];
  /** Arquivos JSON válidos efetivamente mesclados. */
  mergedCount: number;
  /** Arquivos ignorados (não-JSON, pastas, macosx metadata). */
  skippedCount: number;
  /** Colisões de path detectadas durante o merge. */
  collisions: Collision[];
  /** Total de folhas na árvore final. */
  leafCount: number;
}

export interface Collision {
  path: string;
  firstFile: string;
  secondFile: string;
}

const IGNORE_PREFIXES = ['__MACOSX/', '.DS_Store'];
const IGNORE_SUFFIXES = ['/.DS_Store'];

/**
 * Nomes de pastas "envelope" que costumam empacotar o export mas não representam
 * namespace real. Ex.: ZIP com `dictionary/global-tokens/breakpoints.json` deve ser
 * tratado como se fosse `global-tokens/breakpoints.json`.
 *
 * A remoção acontece apenas se a pasta for a **primeira** do caminho — pastas com esse
 * mesmo nome mais fundo na árvore são preservadas (podem ser namespace intencional).
 */
const WRAPPER_FOLDERS = new Set(['dictionary']);

/**
 * Lê o conteúdo do ZIP em memória, filtra apenas `*.json` e faz deep-merge com
 * **namespace derivado da estrutura de pastas**.
 *
 * Para cada arquivo `folderA/folderB/fileName.json`:
 *   1. Calcula o namespace canônico: `[normalize(folderA), normalize(folderB), fileName]`.
 *      Normalização remove sufixos comuns de export (`-tokens`, `.tokens`).
 *   2. "Peela" quantos segmentos iniciais do conteúdo já representarem partes do
 *      namespace (ex.: Tokens Studio às vezes exporta com o path completo embutido).
 *   3. Mescla o conteúdo "limpo" no path canônico.
 *
 * Exemplos:
 *   - `global-tokens/breakpoints.json` com `{ sm: {...} }` → `global.breakpoints.sm`
 *   - `global.json` com `{ global: { breakpoints: {...} } }` → `global.breakpoints`
 *   - `brands/sicredi/colors.json` com `{ red: { value: ... } }` → `brands.sicredi.colors.red`
 */
export async function importTokensFromZip(buffer: ArrayBuffer): Promise<ImportResult> {
  const unzipped = unzipSync(new Uint8Array(buffer));

  const files: ImportedFile[] = [];
  const collisions: Collision[] = [];
  const tree: TokenTreeData = {};
  // Rastreia qual arquivo definiu cada folha, para relatar colisões.
  const leafOwner = new Map<string, string>();

  let mergedCount = 0;
  let skippedCount = 0;

  // Processa arquivos em ordem alfabética para resultado determinístico entre runs.
  const entries = Object.entries(unzipped).sort(([a], [b]) => a.localeCompare(b));

  for (const [path, bytes] of entries) {
    if (shouldIgnore(path)) {
      skippedCount += 1;
      continue;
    }
    if (path.endsWith('/')) {
      skippedCount += 1;
      continue;
    }
    if (!path.toLowerCase().endsWith('.json')) {
      skippedCount += 1;
      continue;
    }

    let text: string;
    try {
      text = strFromU8(bytes);
    } catch (err) {
      files.push({ path, data: null, error: describeError(err) });
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (err) {
      files.push({ path, data: null, error: describeError(err) });
      continue;
    }

    if (!isPlainObject(data)) {
      files.push({
        path,
        data: null,
        error: 'JSON raiz deve ser um objeto',
      });
      continue;
    }

    const namespace = extractNamespace(path);
    const { targetPath, content } = stripMatchingPrefix(namespace, data);
    const container = ensureContainer(tree, targetPath, path);
    deepMerge(container, content, targetPath.join('.'), path, leafOwner, collisions);

    files.push({ path, data, mergedInto: targetPath.join('.') || '(root)' });
    mergedCount += 1;
  }

  return {
    tree,
    files,
    mergedCount,
    skippedCount,
    collisions,
    leafCount: leafOwner.size,
  };
}

function shouldIgnore(path: string): boolean {
  for (const prefix of IGNORE_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  for (const suffix of IGNORE_SUFFIXES) {
    if (path.endsWith(suffix)) return true;
  }
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Converte o path do arquivo no ZIP em uma lista de segmentos de namespace.
 * `global-tokens/breakpoints.json`            → `['global', 'breakpoints']`
 * `brands/sicredi/colors.json`                → `['brands', 'sicredi', 'colors']`
 * `dictionary/global-tokens/breakpoints.json` → `['global', 'breakpoints']`
 */
function extractNamespace(filePath: string): string[] {
  const parts = filePath.split('/').filter(Boolean);
  const fileName = parts.pop() ?? '';
  const baseName = fileName.replace(/\.json$/i, '');
  // Remove a pasta "envelope" caso seja a primeira do caminho (ex.: `dictionary/...`).
  if (parts.length > 0 && WRAPPER_FOLDERS.has(parts[0].toLowerCase())) {
    parts.shift();
  }
  return [...parts.map(stripCommonSuffix), baseName].filter(Boolean);
}

/**
 * Remove sufixos convencionais de pastas de export (Tokens Studio / Style Dictionary
 * costumam usar `*-tokens/`). Se o usuário tem folder com outro sufixo, basta descrever
 * depois — para a POC, cobre os casos mais comuns.
 */
function stripCommonSuffix(segment: string): string {
  return segment.replace(/-tokens$/i, '').replace(/\.tokens$/i, '');
}

/**
 * Estratégia de "peeling": se o conteúdo começa com chaves que já fazem parte do
 * namespace canônico, entra nelas para evitar duplicação (ex.: conteúdo
 * `{ global: { breakpoints: {...} } }` em arquivo `global-tokens/breakpoints.json`
 * não deve virar `global.breakpoints.global.breakpoints.*`).
 *
 * O algoritmo tolera "gaps": se o conteúdo pula um segmento (ex.: file-name dentro
 * de folder-name, sem repetir o folder), detecta isso via `indexOf` restante.
 */
function stripMatchingPrefix(
  namespace: string[],
  content: Record<string, unknown>,
): { targetPath: string[]; content: Record<string, unknown> } {
  let cursor: Record<string, unknown> = content;
  let nextNsIndex = 0;

  while (
    isPlainObject(cursor) &&
    !isLeafObject(cursor) &&
    nextNsIndex <= namespace.length
  ) {
    const keys = Object.keys(cursor);
    if (keys.length !== 1) break;
    const [key] = keys;
    const childValue = cursor[key];
    if (!isPlainObject(childValue)) break;
    // O próximo segmento do namespace deve aparecer em algum ponto à frente.
    const ahead = namespace.indexOf(key, nextNsIndex);
    if (ahead === -1) break;
    cursor = childValue;
    nextNsIndex = ahead + 1;
  }

  return {
    targetPath: namespace,
    content: cursor,
  };
}

/**
 * Garante que cada segmento de `targetPath` existe no tree como objeto (branch).
 * Falha suave: se encontrar uma folha no caminho, deixa como está (a colisão é
 * reportada em `deepMerge`).
 */
function ensureContainer(
  tree: TokenTreeData,
  targetPath: string[],
  fileName: string,
): Record<string, unknown> {
  let cursor = tree as Record<string, unknown>;
  for (let i = 0; i < targetPath.length; i++) {
    const segment = targetPath[i];
    const next = cursor[segment];
    if (next === undefined) {
      cursor[segment] = {};
      cursor = cursor[segment] as Record<string, unknown>;
    } else if (!isPlainObject(next) || isLeafObject(next)) {
      // Não podemos descer — o slot já está ocupado por outra coisa.
      // Retornamos um objeto "descartável" para não quebrar o merge, a colisão será
      // reportada quando a folha for sobrescrita via deepMerge.
      void fileName;
      return {};
    } else {
      cursor = next as Record<string, unknown>;
    }
  }
  return cursor;
}

/**
 * Merge recursivo em `target` a partir de `source`. Respeita o contrato "folha = objeto
 * com `value`": ao encontrar uma folha, trata como unidade indivisível. Colisões são
 * registradas em folhas; branches são naturalmente mesclados.
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  basePath: string,
  fileName: string,
  leafOwner: Map<string, string>,
  collisions: Collision[],
): void {
  for (const [key, value] of Object.entries(source)) {
    const path = basePath ? `${basePath}.${key}` : key;
    const existing = target[key];

    if (isLeafObject(value)) {
      const previousOwner = leafOwner.get(path);
      if (previousOwner && previousOwner !== fileName) {
        collisions.push({
          path,
          firstFile: previousOwner,
          secondFile: fileName,
        });
      }
      target[key] = value;
      leafOwner.set(path, fileName);
      continue;
    }

    if (isPlainObject(value)) {
      if (existing === undefined) {
        target[key] = {};
      } else if (isLeafObject(existing)) {
        // Colisão estrutural: um arquivo anterior definiu uma folha onde agora vem um branch.
        collisions.push({
          path,
          firstFile: leafOwner.get(path) ?? '(desconhecido)',
          secondFile: fileName,
        });
        target[key] = {};
      } else if (!isPlainObject(existing)) {
        target[key] = {};
      }
      deepMerge(
        target[key] as Record<string, unknown>,
        value,
        path,
        fileName,
        leafOwner,
        collisions,
      );
      continue;
    }

    // Valor primitivo "solto" — raro em exports Style Dictionary, mas preservamos.
    target[key] = value;
  }
}
