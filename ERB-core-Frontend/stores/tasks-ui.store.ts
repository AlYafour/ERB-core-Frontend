import { create } from 'zustand';

type ViewMode = 'kanban' | 'list';
type SortDir = 'asc' | 'desc';

interface TasksUIState {
  // ── View ──────────────────────────────────────────────────────────────────
  view: ViewMode;
  setView: (v: ViewMode) => void;

  // ── Filters ───────────────────────────────────────────────────────────────
  scope: string;
  statusFilter: string;
  priorityFilter: string;
  taskTypeFilter: string;
  search: string;
  setScope: (s: string) => void;
  setStatusFilter: (s: string) => void;
  setPriorityFilter: (s: string) => void;
  setTaskTypeFilter: (s: string) => void;
  setSearch: (s: string) => void;
  clearFilters: () => void;

  // ── Sorting ───────────────────────────────────────────────────────────────
  sortBy: string;
  sortDir: SortDir;
  setSort: (field: string) => void;

  // ── Pagination ────────────────────────────────────────────────────────────
  page: number;
  setPage: (p: number) => void;
  resetPage: () => void;

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
  taskTypeFilter: '',
  search: '',
  setScope: (scope) => set({ scope, statusFilter: '', page: 1 }),
  setStatusFilter: (statusFilter) => set({ statusFilter, scope: '', page: 1 }),
  setPriorityFilter: (priorityFilter) => set({ priorityFilter, page: 1 }),
  setTaskTypeFilter: (taskTypeFilter) => set({ taskTypeFilter, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  clearFilters: () =>
    set({ scope: '', statusFilter: '', priorityFilter: '', taskTypeFilter: '', search: '', page: 1 }),

  sortBy: '',
  sortDir: 'asc',
  setSort: (field) =>
    set((s) => ({
      sortBy: field,
      sortDir: s.sortBy === field && s.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })),

  page: 1,
  setPage: (page) => set({ page }),
  resetPage: () => set({ page: 1 }),

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
