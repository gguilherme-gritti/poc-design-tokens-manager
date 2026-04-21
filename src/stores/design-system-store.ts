import { create } from 'zustand';

interface DesignSystemStore {
  activeDesignSystemId: string | null;
  setActiveDesignSystemId: (id: string | null) => void;
}

export const useDesignSystemStore = create<DesignSystemStore>((set) => ({
  activeDesignSystemId: null,
  setActiveDesignSystemId: (id) => set({ activeDesignSystemId: id }),
}));
