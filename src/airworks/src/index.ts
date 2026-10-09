import './styles.css';
import { AirDesktop, VERSION } from './desktop';
import { runtime } from './runtime';
import type { AccessSnapshot, AirWorksOptions, AppDefinition, AuthProvider, Intent, PermissionDefinition, RemoteManifest, SearchProvider, Session } from './types';

export type * from './types';
export { createOidcProvider, type OidcOptions, type TokenSet } from './oidc';
export { httpIdentityStore, localAuthProvider, localIdentityStore, MANAGE_IDENTITY } from './access';
export { addMessages, setLocale, type MessageKey } from './i18n';
export { httpProfileStore, localProfileStore } from './profile';
export { AirDesktop, VERSION };

if (!customElements.get('air-desktop')) customElements.define('air-desktop', AirDesktop);

const desktop = () => document.querySelector<AirDesktop>('air-desktop') ?? undefined;

export type AirWorksEvent = 'login' | 'logout' | 'access-changed' | 'app-opened' | 'access-denied';

export const AirWorks = {
  version: VERSION,
  configure: (options: AirWorksOptions) => runtime.configure(options),
  registerApp: (app: AppDefinition) => runtime.registerApp(app),
  registerApps: (apps: AppDefinition[]) => apps.forEach((app) => runtime.registerApp(app)),
  unregisterApp: (id: string) => runtime.unregisterApp(id),
  loadRemote: (manifest: RemoteManifest | string) => runtime.loadRemote(manifest),
  registerPermission: (permission: PermissionDefinition) => runtime.access.registerPermission(permission),
  registerPermissions: (permissions: PermissionDefinition[]) => permissions.forEach((permission) => runtime.access.registerPermission(permission)),
  registerAuthProvider: (provider: AuthProvider) => runtime.access.registerProvider(provider),
  login: (providerId: string, options?: unknown) => runtime.access.login(providerId, options),
  logout: () => runtime.access.logout(),
  setSession: (session: Session | undefined) => runtime.access.setSession(session),
  refreshAccess: () => runtime.access.resolve(),
  get session(): Session | undefined { return runtime.access.session; },
  get access(): AccessSnapshot { return runtime.access.snapshot; },
  can: (permission: string) => runtime.access.can(permission),
  request: <T = unknown>(path: string, init?: RequestInit) => runtime.access.request<T>(path, init),
  openApp: (appId: string, intent?: Intent) => desktop()?.launch(appId, { intent }) ?? false,
  registerSearchProvider: (provider: SearchProvider) => runtime.registerSearchProvider(provider),
  search: (query: string) => runtime.search(query),
  showLogin: () => desktop()?.showLogin(true),
  on(event: AirWorksEvent, handler: (detail: unknown) => void) {
    const listener = (e: Event) => handler((e as CustomEvent).detail);
    const access = { login: 'login', logout: 'logout', 'access-changed': 'change' }[event as string];
    const target: EventTarget = access ? runtime.access : document;
    const type = access ?? `airworks:${event}`;
    target.addEventListener(type, listener);
    return () => target.removeEventListener(type, listener);
  },
};

declare global {
  interface Window { AirWorks: typeof AirWorks }
  interface HTMLElementTagNameMap { 'air-desktop': AirDesktop }
}

window.AirWorks ??= AirWorks;
