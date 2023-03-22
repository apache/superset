import { create } from 'zustand';
import { shallow } from 'zustand/shallow'

export const useAppStore = create((set) => ({
    legendHidden: [],
    updateLegendHiddenAll: (hidden) => set({ legendHidden: hidden }),
    updateLegendHiddenIndex: (index, hidden) => set((state) => {
        let newHidden = [...state.legendHidden];
        newHidden[index] = hidden;
        return { legendHidden: newHidden };
    })
}));