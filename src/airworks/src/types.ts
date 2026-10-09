export type Identity = {
  id: string;
  displayName: string;
  email?: string;
};

export type Session = {
  token?: string;
  identity?: Identity;
  roles?: string[];
  permissions?: string[];
  expiresAt?: number;
  [key: string]: unknown;
};

export type AccessSnapshot = {
  identity?: Identity;
  roles: string[];
  permissions: string[];
};

export type PermissionDefinition = {
  id: string;
  title: string;
  description?: string;
  group?: string;
};

export type RoleDefinition = {
  id: string;
  title: string;
  permissions: string[];
};

export type UserRecord = {
  id: string;
  userName: string;
  displayName: string;
  email?: string;
  roles: string[];
};

export interface IdentityStore {
  listUsers(): Promise<UserRecord[]>;
  saveUser(user: UserRecord): Promise<void>;
  deleteUser(id: string): Promise<void>;
  listRoles(): Promise<RoleDefinition[]>;
  saveRole(role: RoleDefinition): Promise<void>;
  deleteRole(id: string): Promise<void>;
  listPermissions(): Promise<PermissionDefinition[]>;
}

export interface ProfileStore {
  load(key: string): Promise<unknown>;
  save(key: string, profile: unknown): Promise<void>;
}

export type LoginField = { name: string; label: string; type?: string };

export type AuthProvider = {
  id: string;
  title: string;
  icon?: string;
  fields?: LoginField[];
  login: (options?: unknown) => Promise<Session | void>;
  logout?: (session?: Session) => Promise<void> | void;
  restore?: () => Promise<Session | undefined> | Session | undefined;
};

export type Intent = Record<string, string>;

export type SearchHit = { title: string; description?: string; icon?: string; intent?: Intent };

export type SearchResult = SearchHit & { appId: string };

export type SearchContext = {
  request: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  access: AccessSnapshot;
  signal: AbortSignal;
};

export type SearchProvider = {
  id: string;
  search: (query: string, context: SearchContext) => Promise<SearchResult[]> | SearchResult[];
};

export type LinkInfo = { id: string; label: string; data: Record<string, string> };

export type Appearance = { title?: string; accent?: string; icon?: string };

export type WindowMenuItem = { id: string; title: string; icon: string; run: (context: AppContext) => void };

export type AppContext = {
  host: HTMLElement;
  appId: string;
  windowId: number;
  session?: Session;
  access: AccessSnapshot;
  can: (permission: string) => boolean;
  request: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  onClose: (callback: () => void) => void;
  setTitle: (title: string) => void;
  setAppearance: (appearance: Appearance) => void;
  link?: LinkInfo;
  intent?: Intent;
  onIntent: (callback: (intent: Intent) => void) => void;
  setState: (state: Intent, title?: string) => void;
};

export type AppDefinition = {
  id: string;
  title: string;
  icon: string;
  accent?: string;
  width?: number;
  height?: number;
  requiredPermissions?: string[];
  hidden?: boolean;
  multiple?: boolean;
  search?: (query: string, context: SearchContext) => Promise<SearchHit[]> | SearchHit[];
  menu?: WindowMenuItem[];
  render?: (context: AppContext) => string | Node | void | Promise<string | Node | void>;
  url?: string;
  entry?: string;
  exportName?: string;
};

export type RemoteManifest = {
  apps?: AppDefinition[];
  modules?: string[];
  permissions?: PermissionDefinition[];
};

export type AirWorksOptions = {
  assetBase?: string;
  locale?: 'en' | 'de' | string;
  serverBaseUrl?: string;
  request?: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  requireLogin?: boolean;
  identityStore?: IdentityStore;
  accessProvider?: (session?: Session) => Promise<Partial<AccessSnapshot>> | Partial<AccessSnapshot>;
  brand?: { title?: string; logo?: string; startIcon?: string };
  docsUrl?: string;
  webLinks?: boolean;
  storageKey?: string;
  profileStore?: ProfileStore;
  initialApps?: string[];
  initialShortcuts?: string[];
};
