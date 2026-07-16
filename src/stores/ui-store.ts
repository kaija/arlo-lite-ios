import { create } from 'zustand';

/**
 * UI overlay and transition state.
 * Manages visibility of transient UI layers (sidebar, settings, model picker,
 * rename dialog, provider detail, toast) so that components can coordinate
 * open/close behavior through a single source of truth.
 */
export interface UIState {
  /** Current toast message text, or null when no toast is active */
  toastMessage: string | null;
  /** Whether the toast pill is currently visible */
  toastVisible: boolean;
  /** Whether the session sidebar is open */
  sidebarOpen: boolean;
  /** Whether the settings overlay is visible */
  settingsVisible: boolean;
  /** Provider ID for the detail screen, empty string for "add new", or null when closed */
  providerDetailId: string | null;
  /** Whether the model picker dropdown is visible */
  modelPickerVisible: boolean;
  /** Session ID currently being renamed, or null when closed */
  renameSessionId: string | null;
}

export interface UIActions {
  /** Show a toast message (replaces any existing toast and resets timer) */
  showToast: (msg: string) => void;
  /** Toggle sidebar open/closed */
  toggleSidebar: () => void;
  /** Open the settings overlay (closes sidebar if open) */
  openSettings: () => void;
  /** Close the settings overlay */
  closeSettings: () => void;
  /** Open the model picker dropdown */
  openModelPicker: () => void;
  /** Close the model picker dropdown */
  closeModelPicker: () => void;
  /** Open the rename dialog for a specific session */
  openRename: (sessionId: string) => void;
  /** Close the rename dialog */
  closeRename: () => void;
  /** Open the provider detail screen for a specific provider, or pass empty string to add new */
  openProviderDetail: (id: string) => void;
  /** Close the provider detail screen */
  closeProviderDetail: () => void;
}

export type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set) => ({
  // State
  toastMessage: null,
  toastVisible: false,
  sidebarOpen: false,
  settingsVisible: false,
  providerDetailId: null,
  modelPickerVisible: false,
  renameSessionId: null,

  // Actions
  showToast: (msg: string) => {
    set({ toastMessage: msg, toastVisible: true });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  openSettings: () => {
    set({ settingsVisible: true, sidebarOpen: false });
  },

  closeSettings: () => {
    set({ settingsVisible: false, providerDetailId: null });
  },

  openModelPicker: () => {
    set({ modelPickerVisible: true });
  },

  closeModelPicker: () => {
    set({ modelPickerVisible: false });
  },

  openRename: (sessionId: string) => {
    set({ renameSessionId: sessionId });
  },

  closeRename: () => {
    set({ renameSessionId: null });
  },

  openProviderDetail: (id: string) => {
    set({ providerDetailId: id });
  },

  closeProviderDetail: () => {
    set({ providerDetailId: null });
  },
}));
