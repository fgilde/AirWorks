import type { AccessSnapshot, AirWorksOptions, AuthProvider, IdentityStore, LoginField, PermissionDefinition, RoleDefinition, Session, UserRecord } from './types';
import { readJson, writeJson } from './util';

export const MANAGE_IDENTITY = 'airworks.identity.manage';

export class Access extends EventTarget {
  readonly permissions = new Map<string, PermissionDefinition>();
  readonly providers = new Map<string, AuthProvider>();
  session?: Session;
  snapshot: AccessSnapshot = { roles: [], permissions: [] };
  private providerId?: string;
  private refreshTimer?: number;

  constructor(private readonly options: () => AirWorksOptions) {
    super();
    this.registerPermission({ id: MANAGE_IDENTITY, title: 'Manage users and roles', group: 'AirWorks' });
  }

  registerPermission(permission: PermissionDefinition) {
    if (!permission?.id) throw new Error('A permission needs an id.');
    this.permissions.set(permission.id, permission);
  }

  registerProvider(provider: AuthProvider) {
    if (!provider?.id || typeof provider.login !== 'function') throw new Error('An auth provider needs an id and login().');
    this.providers.set(provider.id, provider);
    this.dispatchEvent(new Event('providers'));
  }

  can = (permission: string) => this.snapshot.permissions.includes(permission);
  canAll = (permissions: string[] = []) => permissions.every(this.can);

  async restore() {
    for (const provider of this.providers.values()) {
      const session = await provider.restore?.();
      if (session) { await this.setSession(session, provider.id); return session; }
    }
    return undefined;
  }

  async login(providerId: string, options?: unknown) {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown auth provider "${providerId}".`);
    const session = await provider.login(options);
    if (session) await this.setSession(session, provider.id);
    return session || undefined;
  }

  async logout() {
    const provider = this.providerId ? this.providers.get(this.providerId) : undefined;
    const session = this.session;
    await this.setSession(undefined);
    await provider?.logout?.(session);
  }

  async setSession(session: Session | undefined, providerId?: string) {
    this.session = session;
    this.providerId = session ? providerId : undefined;
    clearTimeout(this.refreshTimer);
    const provider = providerId ? this.providers.get(providerId) : undefined;
    if (session?.expiresAt && provider?.restore) {
      this.refreshTimer = window.setTimeout(async () => {
        const next = await provider.restore!();
        await this.setSession(next, next ? providerId : undefined);
      }, Math.max(5_000, session.expiresAt - Date.now() - 30_000));
    }
    await this.resolve();
    this.dispatchEvent(new CustomEvent(session ? 'login' : 'logout', { detail: session }));
  }

  async resolve() {
    const session = this.session;
    const { accessProvider, identityStore } = this.options();
    let roles = session?.roles ?? [];
    let permissions = session?.permissions ?? [];
    if (session && accessProvider) {
      const supplied = await accessProvider(session);
      roles = supplied.roles ?? roles;
      permissions = supplied.permissions ?? permissions;
    } else if (session && identityStore) {
      const [users, definitions] = await Promise.all([identityStore.listUsers(), identityStore.listRoles()]);
      const user = users.find((candidate) => candidate.id === session.identity?.id || candidate.userName === session.identity?.id);
      roles = [...roles, ...(user?.roles ?? [])];
      permissions = [...permissions, ...definitions.filter((role) => roles.includes(role.id)).flatMap((role) => role.permissions)];
    }
    this.snapshot = { identity: session?.identity, roles: [...new Set(roles)], permissions: [...new Set(permissions)] };
    this.dispatchEvent(new CustomEvent('change', { detail: this.snapshot }));
  }

  async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const options = this.options();
    if (options.request) return options.request<T>(path, init);
    const headers = new Headers(init.headers);
    if (this.session?.token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${this.session.token}`);
    if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${options.serverBaseUrl ?? ''}${path}`, { ...init, headers });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
    if (response.status === 204) return undefined as T;
    return ((response.headers.get('content-type') ?? '').includes('json') ? await response.json() : await response.text()) as T;
  }
}

type LocalIdentity = { users: UserRecord[]; roles: RoleDefinition[] };

export function localIdentityStore(seed: Partial<LocalIdentity> = {}, key = 'airworks.identity'): IdentityStore {
  const load = (): LocalIdentity => readJson<LocalIdentity>(key) ?? { users: seed.users ?? [], roles: seed.roles ?? [] };
  const update = (change: (data: LocalIdentity) => void) => { const data = load(); change(data); writeJson(key, data); return Promise.resolve(); };
  const upsert = <T extends { id: string }>(list: T[], value: T) => { const index = list.findIndex((item) => item.id === value.id); if (index < 0) list.push(value); else list[index] = value; };
  return {
    listUsers: async () => load().users,
    saveUser: (user) => update((data) => upsert(data.users, user)),
    deleteUser: (id) => update((data) => { data.users = data.users.filter((user) => user.id !== id); }),
    listRoles: async () => load().roles,
    saveRole: (role) => update((data) => upsert(data.roles, role)),
    deleteRole: (id) => update((data) => { data.roles = data.roles.filter((role) => role.id !== id); }),
    listPermissions: async () => [],
  };
}

export function httpIdentityStore(request: <T>(path: string, init?: RequestInit) => Promise<T>, base = '/identity'): IdentityStore {
  const put = (path: string, body: unknown) => request<void>(path, { method: 'PUT', body: JSON.stringify(body) });
  const remove = (path: string) => request<void>(path, { method: 'DELETE' });
  const item = (kind: string, id: string) => `${base}/${kind}/${encodeURIComponent(id)}`;
  return {
    listUsers: () => request<UserRecord[]>(`${base}/users`),
    saveUser: (user) => put(item('users', user.id), user),
    deleteUser: (id) => remove(item('users', id)),
    listRoles: () => request<RoleDefinition[]>(`${base}/roles`),
    saveRole: (role) => put(item('roles', role.id), role),
    deleteRole: (id) => remove(item('roles', id)),
    listPermissions: () => request<PermissionDefinition[]>(`${base}/permissions`),
  };
}

export function localAuthProvider(store: IdentityStore, options: { id?: string; title?: string } = {}): AuthProvider {
  const key = `airworks.local-session.${options.id ?? 'local'}`;
  const toSession = (user: UserRecord): Session => ({ identity: { id: user.id, displayName: user.displayName, email: user.email }, roles: user.roles });
  return {
    id: options.id ?? 'local',
    title: options.title ?? 'Local user',
    fields: [{ name: 'userName', label: 'userName' }] satisfies LoginField[],
    async login(values) {
      const userName = String((values as Record<string, unknown> | undefined)?.userName ?? '').trim().toLowerCase();
      const user = (await store.listUsers()).find((candidate) => candidate.userName.toLowerCase() === userName);
      if (!user) throw new Error(`Unknown user "${userName}"`);
      writeJson(key, user.id);
      return toSession(user);
    },
    logout: () => localStorage.removeItem(key),
    async restore() {
      const id = readJson<string>(key);
      const user = id ? (await store.listUsers()).find((candidate) => candidate.id === id) : undefined;
      return user ? toSession(user) : undefined;
    },
  };
}
