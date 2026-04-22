import { enableMapSet, produce } from 'immer';
import { create, useStore } from 'zustand';
import { temporal, type TemporalState } from 'zundo';

import type { TokenTreeData } from '@/components/token-tree';
import { DESIGN_SYSTEM_TEMPLATES, getTemplateById } from '@/design-systems/registry';
import type { DisabledMap } from '@/lib/disabled-paths';
import { flattenLeaves } from '@/lib/token-diff';
import {
  addBranchAt,
  addLeafAt,
  existsAt,
  getAt,
  isLeafObject,
  lastSegment,
  parentPath as parentOf,
  removeAt,
  renameAt,
  setLeafValueAt,
} from '@/lib/token-mutations';

enableMapSet();

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type DesignSystemOrigin =
  | { kind: 'empty' }
  | { kind: 'template'; templateId: string }
  | { kind: 'import'; fileName: string };

export interface DesignSystemMeta {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  origin: DesignSystemOrigin;
}

export type PendingChange =
  | {
      id: string;
      kind: 'add';
      path: string;
      token: unknown;
      timestamp: number;
    }
  | {
      id: string;
      kind: 'remove';
      path: string;
      previous: unknown;
      timestamp: number;
    }
  | {
      id: string;
      kind: 'update';
      path: string;
      before: unknown;
      after: unknown;
      timestamp: number;
    }
  | {
      id: string;
      kind: 'rename';
      fromPath: string;
      toPath: string;
      timestamp: number;
    }
  | {
      id: string;
      /**
       * Soft-delete / soft-restore. Não altera o JSON do token — apenas marca o path
       * como desabilitado (view-only) no workspace.
       */
      kind: 'toggle-disabled';
      path: string;
      disabled: boolean;
      timestamp: number;
    };

export interface HistoryEntry {
  id: string;
  timestamp: number;
  label?: string;
  changes: PendingChange[];
  snapshotBefore: TokenTreeData;
  snapshotAfter: TokenTreeData;
  snapshotDisabledBefore: DisabledMap;
  snapshotDisabledAfter: DisabledMap;
}

export interface DesignSystemWorkspace {
  /** Versão em edição (working copy). */
  draft: TokenTreeData;
  /** Última versão "salva" — serve de baseline para diff e descarte. */
  baseline: TokenTreeData;
  /** Paths marcados como desabilitados na versão de edição. */
  draftDisabled: DisabledMap;
  /** Paths desabilitados na baseline (para descarte). */
  baselineDisabled: DisabledMap;
  /** Alterações acumuladas desde o último commit. */
  pendingChanges: PendingChange[];
  history: HistoryEntry[];
}

/**
 * Resultado sumário da aplicação de um import, usado para toasts/mensagens.
 */
export interface ApplyImportResult {
  added: number;
  removed: number;
  updated: number;
  /** Entry gerada no histórico (null se não houve nenhuma diferença). */
  entry: HistoryEntry | null;
}

export interface CreateDesignSystemInput {
  name: string;
  description?: string;
  origin: DesignSystemOrigin;
  /** Árvore inicial quando `origin.kind === 'import'` ou override para template. */
  seed?: TokenTreeData;
}

interface DesignSystemStoreState {
  activeDesignSystemId: string | null;
  designSystems: DesignSystemMeta[];
  workspaces: Record<string, DesignSystemWorkspace>;

  setActiveDesignSystemId: (id: string | null) => void;
  /**
   * Cria um design system novo com a origem escolhida.
   * - `empty`:        tree vazia `{}`
   * - `template`:     clona do template informado em `origin.templateId`
   * - `import`:       usa o `seed` como baseline (a partir de um zip, por exemplo)
   *
   * Retorna o id criado. A criação não gera commit — o baseline já é o estado inicial.
   */
  createDesignSystem: (input: CreateDesignSystemInput) => string;
  deleteDesignSystem: (id: string) => void;
  renameDesignSystem: (id: string, name: string, description?: string) => void;

  updateLeafValue: (id: string, path: string, newValue: unknown) => void;
  removeNode: (id: string, path: string) => void;
  /** Marca (ou desmarca) um path como desabilitado. Soft-delete sem remover o nó. */
  toggleNodeDisabled: (id: string, path: string) => void;
  addLeaf: (
    id: string,
    parentPath: string,
    name: string,
    value: unknown,
    attributes?: Record<string, unknown>,
  ) => void;
  addBranch: (id: string, parentPath: string, name: string) => void;
  renameNode: (id: string, path: string, newName: string) => string | null;

  undoLastPendingChange: (id: string) => void;

  commit: (id: string, label?: string) => HistoryEntry | null;
  discard: (id: string) => void;
  /** Cria um novo commit que reverte o estado para o snapshot daquela entrada. */
  restoreHistoryEntry: (id: string, historyEntryId: string) => void;

  /**
   * Aplica um import "em bloco" — substitui o draft pela árvore importada e gera um
   * commit único contendo as PendingChanges derivadas do diff. Executado numa única
   * passada de `produce()` para evitar N re-renders / structural sharings.
   */
  applyImport: (
    id: string,
    importedTree: TokenTreeData,
    options?: { label?: string },
  ) => ApplyImportResult;
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): number {
  return Date.now();
}

function recordChange(
  workspace: DesignSystemWorkspace,
  change: PendingChange,
): void {
  workspace.pendingChanges.push(change);
}

function blankWorkspace(data: TokenTreeData): DesignSystemWorkspace {
  return {
    draft: deepClone(data),
    baseline: deepClone(data),
    draftDisabled: {},
    baselineDisabled: {},
    pendingChanges: [],
    history: [],
  };
}

/**
 * Seed padrão exibido na tela inicial para facilitar a exploração da POC. Apenas o
 * primeiro template é seedado; o usuário ainda pode criar novos DS do zero ou via zip.
 */
function buildDefaultDesignSystems(): {
  metas: DesignSystemMeta[];
  workspaces: Record<string, DesignSystemWorkspace>;
} {
  const metas: DesignSystemMeta[] = [];
  const workspaces: Record<string, DesignSystemWorkspace> = {};
  const [firstTemplate] = DESIGN_SYSTEM_TEMPLATES;
  if (firstTemplate) {
    const id = `seed-${firstTemplate.id}`;
    metas.push({
      id,
      name: firstTemplate.name,
      description: firstTemplate.description,
      createdAt: now(),
      origin: { kind: 'template', templateId: firstTemplate.id },
    });
    workspaces[id] = blankWorkspace(firstTemplate.data);
  }
  return { metas, workspaces };
}

/* -------------------------------------------------------------------------- */
/*                                   Store                                    */
/* -------------------------------------------------------------------------- */

/**
 * Store com `temporal` middleware (zundo). O histórico temporal (undo/redo da sessão)
 * rastreia APENAS o campo `workspaces` para evitar que mudar o design system ativo
 * polua o undo stack com algo que não é uma edição "real".
 */
export const useDesignSystemStore = create<DesignSystemStoreState>()(
  temporal(
    (set, get) => {
      const initial = buildDefaultDesignSystems();
      return {
        activeDesignSystemId: null,
        designSystems: initial.metas,
        workspaces: initial.workspaces,

        setActiveDesignSystemId: (id) => set({ activeDesignSystemId: id }),

        createDesignSystem: ({ name, description, origin, seed }) => {
          const id = makeId();
          let data: TokenTreeData = {};
          if (origin.kind === 'template') {
            const template = getTemplateById(origin.templateId);
            if (template) data = template.data;
          } else if (origin.kind === 'import') {
            data = seed ?? {};
          } else if (seed) {
            data = seed;
          }
          const meta: DesignSystemMeta = {
            id,
            name: name.trim() || 'Design system sem nome',
            description: description?.trim() ?? '',
            createdAt: now(),
            origin,
          };
          const state = get();
          set({
            designSystems: [...state.designSystems, meta],
            workspaces: {
              ...state.workspaces,
              [id]: blankWorkspace(data),
            },
          });
          return id;
        },

        deleteDesignSystem: (id) => {
          const state = get();
          const nextWorkspaces = { ...state.workspaces };
          delete nextWorkspaces[id];
          set({
            designSystems: state.designSystems.filter((d) => d.id !== id),
            workspaces: nextWorkspaces,
            activeDesignSystemId:
              state.activeDesignSystemId === id ? null : state.activeDesignSystemId,
          });
        },

        renameDesignSystem: (id, name, description) => {
          const state = get();
          set({
            designSystems: state.designSystems.map((d) =>
              d.id === id
                ? {
                    ...d,
                    name: name.trim() || d.name,
                    description: description?.trim() ?? d.description,
                  }
                : d,
            ),
          });
        },

        updateLeafValue: (id, path, newValue) => {
          const current = get().workspaces[id];
          if (!current) return;
          const node = getAt(current.draft, path);
          if (!isLeafObject(node)) return;
          const before = deepClone(node.value);
          const nextWorkspace = produce(current, (wip) => {
            setLeafValueAt(wip.draft, path, newValue);
            recordChange(wip, {
              id: makeId(),
              kind: 'update',
              path,
              before,
              after: deepClone(newValue),
              timestamp: now(),
            });
          });
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
        },

        removeNode: (id, path) => {
          const current = get().workspaces[id];
          if (!current) return;
          const previous = getAt(current.draft, path);
          if (previous === undefined) return;
          const snapshot = deepClone(previous);
          const nextWorkspace = produce(current, (wip) => {
            removeAt(wip.draft, path);
            recordChange(wip, {
              id: makeId(),
              kind: 'remove',
              path,
              previous: snapshot,
              timestamp: now(),
            });
          });
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
        },

        /**
         * Soft-delete: alterna a flag "disabled" de um path. O token permanece na árvore
         * e pode ser reativado. Não modifica o JSON do token.
         */
        toggleNodeDisabled: (id, path) => {
          const current = get().workspaces[id];
          if (!current) return;
          if (getAt(current.draft, path) === undefined) return;
          const wasDisabled = current.draftDisabled[path] === true;
          const nextWorkspace = produce(current, (wip) => {
            if (wasDisabled) {
              delete wip.draftDisabled[path];
            } else {
              wip.draftDisabled[path] = true;
            }
            recordChange(wip, {
              id: makeId(),
              kind: 'toggle-disabled',
              path,
              disabled: !wasDisabled,
              timestamp: now(),
            });
          });
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
        },

        addLeaf: (id, parentPath, name, value, attributes) => {
          const current = get().workspaces[id];
          if (!current) return;
          const fullPath = parentPath ? `${parentPath}.${name}` : name;
          if (existsAt(current.draft, fullPath)) {
            throw new Error(`Já existe um token em "${fullPath}".`);
          }
          const nextWorkspace = produce(current, (wip) => {
            addLeafAt(wip.draft, fullPath, value, attributes);
            const inserted = getAt(wip.draft, fullPath);
            recordChange(wip, {
              id: makeId(),
              kind: 'add',
              path: fullPath,
              token: deepClone(inserted),
              timestamp: now(),
            });
          });
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
        },

        addBranch: (id, parentPath, name) => {
          const current = get().workspaces[id];
          if (!current) return;
          const fullPath = parentPath ? `${parentPath}.${name}` : name;
          if (existsAt(current.draft, fullPath)) {
            throw new Error(`Já existe um grupo em "${fullPath}".`);
          }
          const nextWorkspace = produce(current, (wip) => {
            addBranchAt(wip.draft, fullPath);
            recordChange(wip, {
              id: makeId(),
              kind: 'add',
              path: fullPath,
              token: {},
              timestamp: now(),
            });
          });
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
        },

        renameNode: (id, path, newName) => {
          const current = get().workspaces[id];
          if (!current) return null;
          if (lastSegment(path) === newName) return path;
          const parent = parentOf(path);
          let renamedTo: string | null = null;
          const nextWorkspace = produce(current, (wip) => {
            renamedTo = renameAt(wip.draft, path, newName);
            recordChange(wip, {
              id: makeId(),
              kind: 'rename',
              fromPath: path,
              toPath: parent ? `${parent}.${newName}` : newName,
              timestamp: now(),
            });
          });
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
          return renamedTo;
        },

        /**
         * Desfaz a última mudança pendente re-aplicando o estado prévio armazenado no
         * `PendingChange`. Serve de "Undo" para o toast, complementar ao `zundo` (sessão).
         */
        undoLastPendingChange: (id) => {
          const current = get().workspaces[id];
          if (!current || current.pendingChanges.length === 0) return;
          const last = current.pendingChanges[current.pendingChanges.length - 1];
          const nextWorkspace = produce(current, (wip) => {
            applyInverse(wip, last);
            wip.pendingChanges.pop();
          });
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
        },

        commit: (id, label) => {
          const current = get().workspaces[id];
          if (!current || current.pendingChanges.length === 0) return null;
          const entry: HistoryEntry = {
            id: makeId(),
            timestamp: now(),
            label,
            changes: current.pendingChanges,
            snapshotBefore: deepClone(current.baseline),
            snapshotAfter: deepClone(current.draft),
            snapshotDisabledBefore: deepClone(current.baselineDisabled),
            snapshotDisabledAfter: deepClone(current.draftDisabled),
          };
          const nextWorkspace: DesignSystemWorkspace = {
            ...current,
            baseline: deepClone(current.draft),
            baselineDisabled: deepClone(current.draftDisabled),
            pendingChanges: [],
            history: [entry, ...current.history],
          };
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
          return entry;
        },

        discard: (id) => {
          const current = get().workspaces[id];
          if (!current) return;
          const nextWorkspace: DesignSystemWorkspace = {
            ...current,
            draft: deepClone(current.baseline),
            draftDisabled: deepClone(current.baselineDisabled),
            pendingChanges: [],
          };
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
        },

        restoreHistoryEntry: (id, historyEntryId) => {
          const current = get().workspaces[id];
          if (!current) return;
          const entry = current.history.find((h) => h.id === historyEntryId);
          if (!entry) return;
          const newCommit: HistoryEntry = {
            id: makeId(),
            timestamp: now(),
            label: `Revert para "${entry.label ?? entry.id.slice(0, 6)}"`,
            changes: [],
            snapshotBefore: deepClone(current.baseline),
            snapshotAfter: deepClone(entry.snapshotAfter),
            snapshotDisabledBefore: deepClone(current.baselineDisabled),
            snapshotDisabledAfter: deepClone(entry.snapshotDisabledAfter),
          };
          const nextWorkspace: DesignSystemWorkspace = {
            ...current,
            draft: deepClone(entry.snapshotAfter),
            baseline: deepClone(entry.snapshotAfter),
            draftDisabled: deepClone(entry.snapshotDisabledAfter),
            baselineDisabled: deepClone(entry.snapshotDisabledAfter),
            pendingChanges: [],
            history: [newCommit, ...current.history],
          };
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
        },

        applyImport: (id, importedTree, options) => {
          const current = get().workspaces[id];
          if (!current) {
            return { added: 0, removed: 0, updated: 0, entry: null };
          }

          // Diffing por folhas — o único lugar onde `value` é fonte da verdade.
          const leftLeaves = flattenLeaves(current.draft);
          const rightLeaves = flattenLeaves(importedTree);

          const changes: PendingChange[] = [];
          let added = 0;
          let removed = 0;
          let updated = 0;
          const ts = now();

          for (const [path, before] of leftLeaves) {
            if (!rightLeaves.has(path)) {
              changes.push({
                id: makeId(),
                kind: 'remove',
                path,
                previous: deepClone(before),
                timestamp: ts,
              });
              removed += 1;
              continue;
            }
            const after = rightLeaves.get(path);
            if (!deepEqual(before, after)) {
              changes.push({
                id: makeId(),
                kind: 'update',
                path,
                before: deepClone((before as { value: unknown }).value),
                after: deepClone((after as { value: unknown }).value),
                timestamp: ts,
              });
              updated += 1;
            }
          }
          for (const [path, after] of rightLeaves) {
            if (leftLeaves.has(path)) continue;
            changes.push({
              id: makeId(),
              kind: 'add',
              path,
              token: deepClone(after),
              timestamp: ts,
            });
            added += 1;
          }

          if (changes.length === 0) {
            return { added: 0, removed: 0, updated: 0, entry: null };
          }

          // Import é uma substituição completa: draft = importedTree. Também descartamos
          // o `draftDisabled` — paths antigos não fazem sentido se a árvore mudou.
          const nextDraft = deepClone(importedTree);
          const nextDisabled: DisabledMap = {};
          // Preservar o estado "disabled" de paths que sobreviveram ao import.
          for (const [path, flag] of Object.entries(current.draftDisabled)) {
            if (flag && rightLeaves.has(path)) {
              nextDisabled[path] = true;
            }
          }

          const entry: HistoryEntry = {
            id: makeId(),
            timestamp: ts,
            label: options?.label,
            changes,
            snapshotBefore: deepClone(current.baseline),
            snapshotAfter: deepClone(nextDraft),
            snapshotDisabledBefore: deepClone(current.baselineDisabled),
            snapshotDisabledAfter: deepClone(nextDisabled),
          };

          const nextWorkspace: DesignSystemWorkspace = {
            draft: nextDraft,
            baseline: deepClone(nextDraft),
            draftDisabled: nextDisabled,
            baselineDisabled: deepClone(nextDisabled),
            pendingChanges: [],
            history: [entry, ...current.history],
          };
          set({ workspaces: { ...get().workspaces, [id]: nextWorkspace } });
          return { added, removed, updated, entry };
        },
      };
    },
    {
      // zundo rastreia apenas as árvores dos workspaces — não o id ativo, nem o histórico
      // (histórico já é persistente por definição; undo/redo é para a sessão de edição).
      partialize: (state) => {
        const snapshot: Record<string, unknown> = {};
        for (const [id, ws] of Object.entries(state.workspaces)) {
          snapshot[id] = {
            draft: ws.draft,
            draftDisabled: ws.draftDisabled,
            pendingChanges: ws.pendingChanges,
          };
        }
        return { workspaces: snapshot } as unknown as DesignSystemStoreState;
      },
      limit: 50,
      equality: (past, current) => past === current,
    },
  ),
);

type TemporalDesignSystemState = TemporalState<Partial<DesignSystemStoreState>>;

/**
 * Hook para consumir o store "temporal" (pastStates, futureStates, undo, redo).
 * Uso: `const past = useTemporalDesignSystemStore((s) => s.pastStates.length);`
 */
export function useTemporalDesignSystemStore<T>(
  selector: (state: TemporalDesignSystemState) => T,
): T {
  return useStore(useDesignSystemStore.temporal, selector);
}

/** Acesso síncrono ao estado temporal (undo/redo imperativos). */
export function getTemporalDesignSystemState(): TemporalDesignSystemState {
  return useDesignSystemStore.temporal.getState() as TemporalDesignSystemState;
}

/**
 * Aplica o "inverso" de uma mudança, usado em `undoLastPendingChange`.
 * Opera diretamente sobre o workspace (draft + draftDisabled).
 */
function applyInverse(
  workspace: DesignSystemWorkspace,
  change: PendingChange,
): void {
  const { draft } = workspace;
  switch (change.kind) {
    case 'add':
      removeAt(draft, change.path);
      return;
    case 'remove': {
      const parentSegments = change.path.split('.');
      const key = parentSegments.pop() ?? '';
      const parentPathStr = parentSegments.join('.');
      const parent = parentPathStr
        ? (getAt(draft, parentPathStr) as Record<string, unknown> | undefined)
        : (draft as Record<string, unknown>);
      if (!parent || typeof parent !== 'object') return;
      (parent as Record<string, unknown>)[key] = change.previous;
      return;
    }
    case 'update': {
      const node = getAt(draft, change.path);
      if (!isLeafObject(node)) return;
      (node as { value: unknown }).value = change.before;
      return;
    }
    case 'rename':
      renameAt(draft, change.toPath, lastSegment(change.fromPath));
      return;
    case 'toggle-disabled':
      // Inverte: se a mudança foi "desabilitou", agora reabilita (e vice-versa).
      if (change.disabled) {
        delete workspace.draftDisabled[change.path];
      } else {
        workspace.draftDisabled[change.path] = true;
      }
      return;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const entriesA = Object.entries(a as Record<string, unknown>);
  const entriesB = Object.entries(b as Record<string, unknown>);
  if (entriesA.length !== entriesB.length) return false;
  const bMap = new Map(entriesB);
  for (const [key, value] of entriesA) {
    if (!bMap.has(key)) return false;
    if (!deepEqual(value, bMap.get(key))) return false;
  }
  return true;
}
