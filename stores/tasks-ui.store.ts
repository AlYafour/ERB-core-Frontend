import { create } from 'zustand';

type ViewMode = 'kanban' | 'list';

interface TasksUIState {
  // ── View ──────────────────────────────────────────────────────────────────
  view: ViewMode;
  setView: (v: ViewMode) => void;

  // ── Filters ───────────────────────────────────────────────────────────────
  scope: string;
  statusFilter: string;
  priorityFilter: string;
  search: string;
  setScope: (s: string) => void;
  setStatusFilter: (s: string) => void;
  setPriorityFilter: (s: string) => void;
  setSearch: (s: string) => void;
  clearFilters: () => void;

  // ── Drawers / Panels ──────────────────────────────────────────────────────
  selectedTaskId: number | null;
  isCreateOpen: boolean;
  isTodoOpen: boolean;
  openTask: (id: number) => void;
  closeTask: () => void;
  openCreate: () => void;
  closeCreate: () => void;
  toggleTodo: () => void;
  closeTodo: () => void;
}

export const useTasksUIStore = create<TasksUIState>((set) => ({
  view: 'kanban',
  setView: (view) => set({ view }),

  scope: '',
  statusFilter: '',
  priorityFilter: '',
  search: '',
  setScope: (scope) => set({ scope, statusFilter: '' }),
  setStatusFilter: (statusFilter) => set({ statusFilter, scope: '' }),
  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setSearch: (search) => set({ search }),
  clearFilters: () => set({ scope: '', statusFilter: '', priorityFilter: '', search: '' }),

  selectedTaskId: null,
  isCreateOpen: false,
  isTodoOpen: false,
  openTask: (id) => set({ selectedTaskId: id }),
  closeTask: () => set({ selectedTaskId: null }),
  openCreate: () => set({ isCreateOpen: true }),
  closeCreate: () => set({ isCreateOpen: false }),
  toggleTodo: () => set((s) => ({ isTodoOpen: !s.isTodoOpen })),
  closeTodo: () => set({ isTodoOpen: false }),
}));
