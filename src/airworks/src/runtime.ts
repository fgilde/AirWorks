import { Access } from './access';
import { setLocale } from './i18n';
import type { AirWorksOptions, AppDefinition, RemoteManifest, SearchProvider, SearchResult } from './types';

const iconFolder = 'icons/';

export class Runtime extends EventTarget {
  options: AirWorksOptions = {};
  readonly apps = new Map<string, AppDefinition>();
  readonly access = new Access(() => this.options);
  readonly searchProviders = new Map<string, SearchProvider>();
  private defaultAssetBase = new URL(iconFolder, import.meta.url).href;

  configure(options: AirWorksOptions) {
    this.options = { ...this.options, ...options, brand: { ...this.options.brand, ...options.brand } };
    if (options.locale) setLocale(options.locale);
    this.dispatchEvent(new Event('options'));
    if ('identityStore' in options || 'accessProvider' in options) void this.access.resolve();
  }

  asset(name: string) {
    if (/^([a-z]+:|\/|\.)/i.test(name)) return name;
    const base = this.options.assetBase ?? this.defaultAssetBase;
    return `${base}${base.endsWith('/') ? '' : '/'}${name}`;
  }

  registerApp(app: AppDefinition) {
    if (!app?.id || !app.title || !app.icon) throw new Error('An app needs id, title and icon.');
    if (!app.render && !app.url && !app.entry) throw new Error(`App "${app.id}" needs render(), url or entry.`);
    if (this.apps.has(app.id)) throw new Error(`App "${app.id}" is already registered.`);
    this.apps.set(app.id, app);
    this.dispatchEvent(new Event('apps'));
  }

  unregisterApp(id: string) {
    if (this.apps.delete(id)) this.dispatchEvent(new Event('apps'));
  }

  registerSearchProvider(provider: SearchProvider) {
    if (!provider?.id || typeof provider.search !== 'function') throw new Error('A search provider needs an id and search().');
    this.searchProviders.set(provider.id, provider);
  }

  async search(query: string, signal = new AbortController().signal): Promise<SearchResult[]> {
    const context = { request: this.access.request.bind(this.access), access: this.access.snapshot, signal };
    const appSearches = this.visibleApps().filter((app) => app.search).map(async (app) =>
      (await app.search!(query, context)).map((hit): SearchResult => ({ icon: app.icon, ...hit, appId: app.id })));
    const providers = [...this.searchProviders.values()].map(async (provider) => provider.search(query, context));
    const settled = await Promise.allSettled([...appSearches, ...providers]);
    return settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
      .filter((hit) => { const app = this.apps.get(hit.appId); return app && this.canOpen(app); });
  }

  canOpen(app: AppDefinition) { return this.access.canAll(app.requiredPermissions); }

  visibleApps() { return [...this.apps.values()].filter((app) => !app.hidden && this.canOpen(app)); }

  async loadRemote(manifestOrUrl: RemoteManifest | string) {
    const baseUrl = typeof manifestOrUrl === 'string' ? new URL(manifestOrUrl, location.href).href : location.href;
    const manifest = typeof manifestOrUrl === 'string'
      ? await fetch(baseUrl).then((response) => {
        if (!response.ok) throw new Error(`Remote manifest failed: ${response.status}`);
        return response.json() as Promise<RemoteManifest>;
      })
      : manifestOrUrl;
    const resolve = (value?: string) => value && /^(\.|[^:/]+\/)/.test(value) ? new URL(value, baseUrl).href : value;
    manifest.permissions?.forEach((permission) => this.access.registerPermission(permission));
    for (const app of manifest.apps ?? []) {
      this.registerApp({ ...app, entry: resolve(app.entry), url: resolve(app.url), icon: /\//.test(app.icon) ? resolve(app.icon)! : app.icon });
    }
    for (const entry of manifest.modules ?? []) await import(/* @vite-ignore */ resolve(entry)!);
  }

  async resolveApp(app: AppDefinition): Promise<AppDefinition> {
    if (app.render || app.url || !app.entry) return app;
    const module = await import(/* @vite-ignore */ app.entry) as Record<string, unknown>;
    const exported = module[app.exportName ?? 'default'];
    const resolved: AppDefinition = typeof exported === 'function'
      ? { ...app, render: exported as AppDefinition['render'] }
      : { ...app, ...(exported as Partial<AppDefinition>), id: app.id };
    this.apps.set(app.id, resolved);
    return resolved;
  }
}

export const runtime = new Runtime();
