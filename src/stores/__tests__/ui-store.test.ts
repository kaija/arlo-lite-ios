import { useUIStore } from '../ui-store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetStore() {
  useUIStore.setState({
    toastMessage: null,
    toastVisible: false,
    sidebarOpen: false,
    settingsVisible: false,
    providerDetailId: null,
    modelPickerVisible: false,
    renameSessionId: null,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ui-store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('should have null toastMessage', () => {
      expect(useUIStore.getState().toastMessage).toBeNull();
    });

    it('should have toastVisible false', () => {
      expect(useUIStore.getState().toastVisible).toBe(false);
    });

    it('should have sidebarOpen false', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    it('should have settingsVisible false', () => {
      expect(useUIStore.getState().settingsVisible).toBe(false);
    });

    it('should have null providerDetailId', () => {
      expect(useUIStore.getState().providerDetailId).toBeNull();
    });

    it('should have modelPickerVisible false', () => {
      expect(useUIStore.getState().modelPickerVisible).toBe(false);
    });

    it('should have null renameSessionId', () => {
      expect(useUIStore.getState().renameSessionId).toBeNull();
    });
  });

  describe('showToast', () => {
    it('should set toastMessage and toastVisible', () => {
      useUIStore.getState().showToast('Copied to clipboard');
      const state = useUIStore.getState();
      expect(state.toastMessage).toBe('Copied to clipboard');
      expect(state.toastVisible).toBe(true);
    });

    it('should replace an existing toast message', () => {
      useUIStore.getState().showToast('First');
      useUIStore.getState().showToast('Second');
      const state = useUIStore.getState();
      expect(state.toastMessage).toBe('Second');
      expect(state.toastVisible).toBe(true);
    });
  });

  describe('toggleSidebar', () => {
    it('should open the sidebar when closed', () => {
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('should close the sidebar when open', () => {
      useUIStore.setState({ sidebarOpen: true });
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);
    });
  });

  describe('openSettings / closeSettings', () => {
    it('should open settings and close sidebar', () => {
      useUIStore.setState({ sidebarOpen: true });
      useUIStore.getState().openSettings();
      const state = useUIStore.getState();
      expect(state.settingsVisible).toBe(true);
      expect(state.sidebarOpen).toBe(false);
    });

    it('should close settings and clear providerDetailId', () => {
      useUIStore.setState({ settingsVisible: true, providerDetailId: 'openai' });
      useUIStore.getState().closeSettings();
      const state = useUIStore.getState();
      expect(state.settingsVisible).toBe(false);
      expect(state.providerDetailId).toBeNull();
    });
  });

  describe('openModelPicker / closeModelPicker', () => {
    it('should open the model picker', () => {
      useUIStore.getState().openModelPicker();
      expect(useUIStore.getState().modelPickerVisible).toBe(true);
    });

    it('should close the model picker', () => {
      useUIStore.setState({ modelPickerVisible: true });
      useUIStore.getState().closeModelPicker();
      expect(useUIStore.getState().modelPickerVisible).toBe(false);
    });
  });

  describe('openRename / closeRename', () => {
    it('should open rename with session id', () => {
      useUIStore.getState().openRename('session-123');
      expect(useUIStore.getState().renameSessionId).toBe('session-123');
    });

    it('should close rename and clear session id', () => {
      useUIStore.setState({ renameSessionId: 'session-123' });
      useUIStore.getState().closeRename();
      expect(useUIStore.getState().renameSessionId).toBeNull();
    });
  });

  describe('openProviderDetail / closeProviderDetail', () => {
    it('should open provider detail with id', () => {
      useUIStore.getState().openProviderDetail('anthropic');
      expect(useUIStore.getState().providerDetailId).toBe('anthropic');
    });

    it('should close provider detail and clear id', () => {
      useUIStore.setState({ providerDetailId: 'anthropic' });
      useUIStore.getState().closeProviderDetail();
      expect(useUIStore.getState().providerDetailId).toBeNull();
    });
  });
});
