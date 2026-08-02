import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActiveInstituteState {
  /** id of the institute the console is currently scoped to. */
  instituteId: string | null;
  setInstituteId: (id: string | null) => void;
}

export const useActiveInstitute = create<ActiveInstituteState>()(
  persist(
    (set) => ({
      instituteId: null,
      setInstituteId: (instituteId) => set({ instituteId }),
    }),
    { name: 'institutes.active-institute' },
  ),
);
