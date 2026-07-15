/**
 * Navigation type definitions for Arlo Lite.
 * Provides type-safe navigation throughout the app.
 */

export type RootStackParamList = {
  Main: undefined;
  Settings: undefined;
};

export type DrawerParamList = {
  Chat: { sessionId?: string } | undefined;
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  ProviderList: undefined;
  ProviderDetail: { providerId?: string } | undefined;
  ModelDetail: { providerId: string; modelId?: string };
  SystemPrompts: undefined;
  About: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
