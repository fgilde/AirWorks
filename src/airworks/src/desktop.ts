import { createIdentityApp } from './apps/identity';
import { createWebLinkApp, editWebLink, WEB_LINK } from './apps/weblink';
import { createSettingsApp, defaultSettings, wallpapers, type Settings } from './apps/settings';
import { getLocale, setLocale, t } from './i18n';
import { LoginView } from './login';
import { localProfileStore, type Profile, type SavedWindow } from './profile';
import { runtime } from './runtime';
import type { Shortcut } from './grid';
import type { AppContext, AppDefinition, Intent } from './types';
import { esc, readJson, writeJson } from './util';
import { WindowManager, type MenuAction, type WindowState, type WorkArea } from './windows';
import { appearanceOf, MAX_WEBTOPS, Workspace } from './workspace';

export const VERSION = '0.4.0';
const DOCS = 'airworks.docs';
const TASKBAR_SIZE = 40;

export class AirDesktop extends HTMLElement {
  private windows!: WindowManager;
  private workspace!: Workspace;
  private settings: Settings = { ...defaultSettings };
  private settingsApp!: ReturnType<typeof createSettingsApp>;
  private pendingWindows: SavedWindow[] = [];
  private cleanups = new Map<number, Array<() => void>>();
  private contexts = new Map<number, AppContext>();
  private intents = new Map<number, Array<(intent: Intent) => void>>();
  private nextIntent?: Intent;
  private searchAbort?: AbortController;
  private startOpen = false;
  private pilotOpen = false;
  private standalone = false;
  private login!: LoginView;
  private profileIdentity: string | null | undefined = null;
  private profileKey = '';
  private loadingProfile = true;
  private saveTimer?: number;
  private standaloneWindow?: SavedWindow;

  private $<T extends HTMLElement = HTMLElement>(selector: string) { return this.querySelector<T>(selector)!; }

  connectedCallback() {
    queueMicrotask(() => this.isConnected && !this.windows && this.init());
  }

  private get storageKey() { return runtime.options.storageKey ?? 'airworks'; }

  private get loginRequired() { return runtime.access.providers.size > 0 && runtime.options.requireLogin !== false; }

  private init() {
    const locale = readJson<string>(`${this.storageKey}.locale`);
    if (locale) setLocale(locale);
    this.registerBuiltinApps();
    this.renderShell();

    const asset = (name: string) => runtime.asset(name);
    this.windows = new WindowManager(this.$('.window-layer'), this.$('.tasks'), this.$('.task-preview'), this.$('.snap-indicator'), {
      workArea: () => this.workArea(),
      asset,
      startMaximized: () => this.settings.startMaximized,
      previewDelay: () => this.settings.instantPreview ? 0 : 250,
      taskbarSide: () => this.settings.taskbarPosition,
      mount: (state, body) => void this.mount(state, body),
      unmount: (state) => { this.cleanups.get(state.id)?.forEach((cleanup) => cleanup()); this.cleanups.delete(state.id); this.contexts.delete(state.id); this.intents.delete(state.id); },
      menuAction: (state, action) => this.menuAction(state, action),
      changed: () => { this.saveProfile(); if (this.pilotOpen) this.renderPilot(); },
    });
    this.workspace = new Workspace(this.$('.desktop'), this.$('.folder-view'), {
      previous: this.$('.homescreen-arrow.previous'), next: this.$('.homescreen-arrow.next'), points: this.$('.navigation-points'),
    }, {
      workArea: () => this.workArea(),
      taskbarSide: () => this.settings.taskbarPosition,
      asset,
      app: (id) => runtime.apps.get(id),
      visible: (app) => runtime.canOpen(app),
      open: (app, linkId) => this.open(app, { linkId }),
      dragging: (active) => { this.windows.expose(active); if (active) { this.toggleStart(false); this.windows.hidePreview(); } },
      created: (shortcut) => { if (shortcut.appId === WEB_LINK && !shortcut.data?.url) void this.createWebLink(shortcut); },
      removed: (ids) => {
        this.windows.windows.filter((state) => state.linkId && ids.includes(state.linkId)).forEach((state) => { state.linkId = undefined; });
        this.windows.sync();
      },
      changed: () => this.saveProfile(),
    });
    this.login = new LoginView(this.$('.login-view'), {
      brand: () => this.brand(),
      guestAllowed: () => !this.loginRequired,
      target: () => this.$('.start-button'),
      closed: () => this.revealStartButton(),
    });

    this.bindShell();
    this.applySettings();
    this.renderStartMenu();

    runtime.addEventListener('apps', () => this.onAppsChanged());
    runtime.addEventListener('options', () => { this.applyBrand(); this.renderStartMenu(); });
    runtime.access.addEventListener('change', () => this.onAccessChanged());
    runtime.access.addEventListener('providers', () => { if (this.login.visible) this.login.render(); this.renderStartMenu(); });
    runtime.access.addEventListener('login', (event) => this.emit('airworks:login', (event as CustomEvent).detail));
    runtime.access.addEventListener('logout', () => this.emit('airworks:logout'));

    const standaloneApp = new URLSearchParams(location.search).get('app');
    if (standaloneApp) {
      this.standalone = true;
      this.classList.add('standalone-mode');
      this.standaloneWindow = { appId: standaloneApp, linkId: new URLSearchParams(location.search).get('link') ?? undefined, x: 0, y: 0, width: innerWidth, height: innerHeight, maximized: true };
    }
    const restored = runtime.access.restore().catch(() => undefined);
    if (this.loginRequired) {
      this.$('.start-button').classList.add('aw-start-hidden');
      this.login.show(true);
      void restored.then((session) => { if (session) this.login.close(); else this.login.show(); });
    } else void this.loadProfile();
  }

  launch(appId: string, options: { linkId?: string; forceNew?: boolean; intent?: Intent } = {}) {
    const app = runtime.apps.get(appId);
    return app ? Boolean(this.open(app, options)) : false;
  }

  showLogin(visible = true) {
    this.toggleStart(false);
    if (visible) this.login.show(); else this.login.hide();
  }

  get workspaceModel() { return this.workspace; }
  get windowManager() { return this.windows; }

  private renderShell() {
    const asset = (name: string) => runtime.asset(name);
    const iconButton = (icon: string, label: string, className: string) =>
      `<button class="icon-button ${className}" aria-label="${esc(label)}" title="${esc(label)}"><img src="${esc(asset(icon))}" alt="" /></button>`;
    this.innerHTML = `
      <main class="air-shell">
        <div class="wallpaper"></div>
        <div class="wallpaper-effect" aria-hidden="true"></div>
        <section class="desktop">
          <button class="homescreen-arrow previous" aria-label="${t('previousWebtop')}"><img src="${asset('icon-arrow-left.png')}" alt="" /></button>
          <button class="homescreen-arrow next" aria-label="${t('nextWebtop')}"><img src="${asset('icon-arrow-right.png')}" alt="" /></button>
          <div class="navigation-points"></div>
          <div class="window-layer"></div>
          <section class="folder-view" aria-hidden="true"></section>
          <img class="company-image" alt="" />
        </section>
        <aside class="start-menu" aria-hidden="true">
          <div class="start-user"></div>
          <div class="start-apps"></div>
          <div class="start-bottom">
            ${iconButton('startmenu-about.png', t('about'), 'about-button')}
            ${iconButton('fn-help.png', t('docs'), 'docs-button')}
            ${iconButton('startmenu-settings.png', t('settings'), 'settings-button')}
            ${iconButton('startmenu-logout.png', t('logout'), 'logout')}
          </div>
        </aside>
        <div class="search-panel" aria-hidden="true">
          <img src="${asset('icon-search.png')}" alt="" />
          <input type="search" placeholder="${t('searchPlaceholder')}" aria-label="${t('search')}" />
          <div class="search-results"></div>
        </div>
        <section class="pilot-view" aria-hidden="true"><div class="pilot-windows"></div><div class="pilot-homescreens"></div></section>
        <section class="login-view" aria-hidden="true"></section>
        <div class="snap-indicator"></div>
        <div class="task-preview" aria-hidden="true"></div>
        <nav class="taskbar taskbar-shadow" aria-label="${t('taskbar')}">
          <button class="start-button" aria-label="${t('startMenu')}" title="${t('startMenu')}"><img alt="" /></button>
          <div class="tasks"></div>
          <div class="task-tools">
            ${iconButton('icon-search.png', t('search'), 'search-button')}
            ${iconButton('pilot.png', t('pilot'), 'pilot-button')}
            ${iconButton('pilot2.png', t('showDesktop'), 'desktop-button')}
            ${iconButton('startmenu-logout.png', t('logout'), 'logout')}
          </div>
        </nav>
      </main>`;
    const cssImages: Record<string, string> = { 'close-cross': 'taskbar-close-cross.png', folder: 'icon-folder.png', 'window-close': 'window-close.png', trash: 'garbage-closed.png', 'trash-open': 'garbage-open.png' };
    Object.entries(cssImages).forEach(([name, file]) => this.style.setProperty(`--aw-image-${name}`, `url("${asset(file)}")`));
    this.applyBrand();
  }

  private applyBrand() {
    const brand = this.brand();
    this.$<HTMLImageElement>('.company-image').src = brand.logo;
    this.$<HTMLImageElement>('.start-button img').src = runtime.options.brand?.startIcon ? runtime.asset(runtime.options.brand.startIcon) : brand.logo;
    this.$('.air-shell').ariaLabel = brand.title;
    this.$('.docs-button').hidden = !runtime.options.docsUrl;
  }

  private brand() {
    const brand = runtime.options.brand;
    return { title: brand?.title ?? 'AirWorks', logo: runtime.asset(brand?.logo ?? 'logo-air.png') };
  }

  private bindShell() {
    this.$('.start-button').addEventListener('click', (event) => { event.stopPropagation(); this.toggleStart(); });
    document.addEventListener('pointerdown', (event) => {
      if (this.startOpen && !(event.target as Element).closest('.start-menu, .start-button')) this.toggleStart(false);
    });
    this.$('.search-button').addEventListener('click', () => this.toggleSearch());
    this.$('.pilot-button').addEventListener('click', () => this.togglePilot());
    this.$('.desktop-button').addEventListener('click', () => this.windows.toggleDesktop());
    this.$('.settings-button').addEventListener('click', () => { this.settingsApp.show('common'); this.launch(this.settingsApp.id); });
    this.$('.about-button').addEventListener('click', () => { this.settingsApp.show('about'); this.launch(this.settingsApp.id); });
    this.$('.docs-button').addEventListener('click', () => this.launch(DOCS));
    this.querySelectorAll('.logout').forEach((button) => button.addEventListener('click', () => {
      if (runtime.access.session) void this.logout(); else this.showLogin(true);
    }));
    const desktopButton = this.$('.desktop-button');
    let peekTimer: number | undefined;
    desktopButton.addEventListener('pointerenter', () => { peekTimer = window.setTimeout(() => this.windows.expose(true), 500); });
    desktopButton.addEventListener('pointerleave', () => { clearTimeout(peekTimer); this.windows.expose(false); });

    const input = this.$<HTMLInputElement>('.search-panel input');
    input.addEventListener('input', () => this.renderSearch(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.toggleSearch(false);
      if (event.key === 'Enter') this.querySelector<HTMLElement>('.search-result')?.click();
    });
    window.addEventListener('resize', () => { this.windows.constrain(); this.workspace.render(); });
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && this.pilotOpen) this.togglePilot(false); });
    this.$('.pilot-view').addEventListener('click', (event) => {
      if ((event.target as Element).matches('.pilot-view, .pilot-windows, .pilot-homescreens')) this.togglePilot(false);
    });
    window.addEventListener('beforeunload', (event) => { if (this.settings.askBeforeClose && !this.standalone) event.preventDefault(); });
  }

  private workArea(): WorkArea {
    if (this.standalone) return { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
    const side = this.settings.taskbarPosition;
    const left = side === 'left' ? TASKBAR_SIZE : 0;
    const top = side === 'top' ? TASKBAR_SIZE : 0;
    const right = innerWidth - (side === 'right' ? TASKBAR_SIZE : 0);
    const bottom = innerHeight - (side === 'bottom' ? TASKBAR_SIZE : 0);
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  private updateSettings(patch: Partial<Settings>) {
    if (patch.locale && patch.locale !== getLocale()) {
      writeJson(`${this.storageKey}.locale`, patch.locale);
      void this.flushProfile().finally(() => location.reload());
      return;
    }
    this.settings = { ...this.settings, ...patch };
    this.saveProfile();
    this.applySettings();
  }

  private applySettings() {
    const settings = this.settings;
    const wallpaper = wallpapers.find((candidate) => candidate.id === settings.wallpaper) ?? wallpapers[0];
    const asset = (name: string) => runtime.asset(name);
    this.$('.wallpaper').style.background = settings.customWallpaper ? `#15294a url('${settings.customWallpaper}') center / cover no-repeat` : wallpaper.background(asset);
    this.style.setProperty('--desktop-foreground', settings.customWallpaper ? '#ffffff' : wallpaper.foreground);
    this.style.setProperty('--system', settings.systemColor ?? '#35496b');
    this.renderEffect();

    const taskbar = this.$('.taskbar');
    const shell = this.$('.air-shell');
    const side = settings.taskbarPosition;
    taskbar.className = `taskbar taskbar-shadow position-${side}${settings.hideTaskbar ? ' auto-hide collapsed' : ''}`;
    shell.dataset.taskbarPosition = side;
    shell.onpointermove = settings.hideTaskbar ? (event) => {
      const away = side === 'top' ? event.clientY > TASKBAR_SIZE : side === 'bottom' ? event.clientY < innerHeight - TASKBAR_SIZE
        : side === 'left' ? event.clientX > TASKBAR_SIZE : event.clientX < innerWidth - TASKBAR_SIZE;
      taskbar.classList.toggle('collapsed', away);
    } : null;
    this.windows.constrain();
    this.workspace.render();
  }

  private renderEffect() {
    const layer = this.$('.wallpaper-effect');
    const effect = this.settings.effect;
    layer.className = `wallpaper-effect effect-${effect}`;
    if (effect === 'bubble') layer.innerHTML = Array.from({ length: 8 }, (_, index) => `<i class="bubble" style="left:${(index * 29 + 7) % 92}%;animation-delay:-${index * 2.1}s;animation-duration:${13 + index * 1.7}s"><img src="${esc(this.brand().logo)}" alt=""/></i>`).join('');
    else if (effect === 'snow') layer.innerHTML = Array.from({ length: 300 }, (_, index) => `<i class="flake" style="left:${(index * 37) % 100}%;top:${(index * 61) % 100}%;font-size:${6 + (index % 12)}px;animation-delay:-${(index % 40) / 3}s;animation-duration:${8 + (index % 9)}s">•</i>`).join('');
    else if (effect === 'starfield') layer.innerHTML = Array.from({ length: 200 }, (_, index) => `<i class="star" style="left:${(index * 43) % 100}%;top:${(index * 67) % 100}%;width:${1 + (index % 3)}px;height:${1 + (index % 3)}px;animation-delay:-${index % 5}s"></i>`).join('');
    else layer.innerHTML = '';
  }

  private toggleStart(force?: boolean) {
    this.startOpen = force ?? !this.startOpen;
    const menu = this.$('.start-menu');
    menu.classList.toggle('open', this.startOpen);
    menu.ariaHidden = String(!this.startOpen);
    this.$('.start-button').classList.toggle('open', this.startOpen);
  }

  private renderStartMenu() {
    const container = this.$('.start-apps');
    container.replaceChildren(...runtime.visibleApps().map((app) => {
      const button = document.createElement('button');
      button.className = 'app-icon';
      button.dataset.app = app.id;
      button.title = app.title;
      button.style.setProperty('--accent', app.accent ?? 'var(--system)');
      button.innerHTML = `<span class="icon-tile"><img src="${esc(runtime.asset(app.icon))}" alt="" /></span><span class="icon-label">${esc(app.title)}</span>`;
      button.addEventListener('click', () => this.open(app));
      this.workspace.dragNew(button, app, () => this.toggleStart(false));
      return button;
    }));
    const identity = runtime.access.snapshot.identity;
    this.$('.start-user').innerHTML = identity ? `<img src="${esc(runtime.asset('login-user.png'))}" alt=""/><span>${esc(identity.displayName)}</span>` : '';
    const signedIn = Boolean(runtime.access.session);
    const canLogin = runtime.access.providers.size > 0;
    this.querySelectorAll<HTMLElement>('.logout').forEach((button) => {
      button.hidden = !signedIn && !canLogin;
      button.title = button.ariaLabel = t(signedIn ? 'logout' : 'login');
      button.classList.toggle('login', !signedIn);
      button.querySelector('img')!.src = runtime.asset(signedIn ? 'startmenu-logout.png' : 'login-user.png');
    });
  }

  private toggleSearch(force?: boolean) {
    const panel = this.$('.search-panel');
    const visible = force ?? !panel.classList.contains('visible');
    panel.classList.toggle('visible', visible);
    panel.ariaHidden = String(!visible);
    if (!visible) return;
    const input = panel.querySelector('input')!;
    input.value = '';
    this.renderSearch('');
    setTimeout(() => input.focus(), 20);
  }

  private renderSearch(query: string) {
    const text = query.trim().toLowerCase();
    const apps = runtime.visibleApps().filter((app) => app.title.toLowerCase().includes(text));
    const results = this.$('.search-results');
    const item = (appId: string, title: string, icon: string, description?: string, intent?: Intent) => {
      const app = runtime.apps.get(appId);
      const button = document.createElement('button');
      button.className = 'search-result';
      button.style.setProperty('--accent', app?.accent ?? 'var(--system)');
      button.innerHTML = `<span class="search-icon"><img src="${esc(runtime.asset(icon))}" alt=""/></span><span class="search-text"><strong>${esc(title)}</strong>${description ? `<small>${esc(description)}</small>` : ''}</span>`;
      button.addEventListener('click', () => this.launch(appId, { intent }));
      return button;
    };
    const section = (title: string) => Object.assign(document.createElement('h4'), { textContent: title });
    results.replaceChildren(...(apps.length ? [section(t('apps')), ...apps.map((app) => item(app.id, app.title, app.icon))] : []));
    this.searchAbort?.abort();
    if (text.length < 2) return;
    const abort = this.searchAbort = new AbortController();
    const pending = section(t('searching'));
    results.append(pending);
    setTimeout(async () => {
      if (abort.signal.aborted) return;
      const hits = await runtime.search(text, abort.signal).catch(() => []);
      if (abort.signal.aborted) return;
      pending.textContent = t('content');
      if (!hits.length) pending.remove();
      results.append(...hits.slice(0, 30).map((hit) => item(hit.appId, hit.title, hit.icon ?? runtime.apps.get(hit.appId)!.icon, hit.description, hit.intent)));
    }, 200);
  }

  private open(app: AppDefinition, options: { linkId?: string; forceNew?: boolean; intent?: Intent; geometry?: Partial<SavedWindow> } = {}) {
    if (!runtime.canOpen(app)) {
      this.emit('airworks:access-denied', { appId: app.id, requiredPermissions: app.requiredPermissions ?? [] });
      return undefined;
    }
    this.toggleStart(false);
    this.toggleSearch(false);
    if (app.id === WEB_LINK && !options.linkId) {
      void this.createWebLink();
      return undefined;
    }
    const shortcut = this.workspace.shortcut(options.linkId);
    const appearance = shortcut?.data ? { title: shortcut.label, ...appearanceOf(shortcut, app) } : undefined;
    this.nextIntent = options.intent;
    const state = this.windows.open(app, { ...options, appearance });
    if (this.nextIntent) this.intents.get(state.id)?.forEach((callback) => callback(this.nextIntent!));
    this.nextIntent = undefined;
    this.emit('airworks:app-opened', { appId: app.id, windowId: state.id });
    return state;
  }

  private async mount(state: WindowState, body: HTMLElement) {
    const cleanups: Array<() => void> = [];
    this.cleanups.set(state.id, cleanups);
    const access = runtime.access;
    const workspace = this.workspace;
    const intent = this.nextIntent;
    this.nextIntent = undefined;
    const listeners: Array<(intent: Intent) => void> = [];
    this.intents.set(state.id, listeners);
    const context: AppContext = {
      intent,
      onIntent: (callback) => listeners.push(callback),
      host: body, appId: state.app.id, windowId: state.id,
      get session() { return access.session; },
      get access() { return access.snapshot; },
      can: access.can,
      request: (path, init) => access.request(path, init),
      onClose: (callback) => cleanups.push(callback),
      setTitle: (title) => this.windows.setAppearance(state.id, { title }),
      setAppearance: (appearance) => this.windows.setAppearance(state.id, appearance),
      get link() {
        const shortcut = workspace.shortcut(state.linkId);
        return shortcut && { id: shortcut.id, label: shortcut.label, data: shortcut.data ?? {} };
      },
    };
    this.contexts.set(state.id, context);
    try {
      const app = await runtime.resolveApp(state.app);
      if (app.url) {
        body.classList.add('frame');
        body.innerHTML = `<iframe class="app-frame" src="${esc(app.url)}" title="${esc(app.title)}"></iframe>`;
        return;
      }
      const result = await app.render?.(context);
      if (typeof result === 'string') body.innerHTML = result;
      else if (result instanceof Node) body.replaceChildren(result);
    } catch (error) {
      body.innerHTML = `<p class="app-error">${esc(t('appLoadFailed', error instanceof Error ? error.message : error))}</p>`;
    }
  }

  private menuAction(state: WindowState, action: MenuAction) {
    const context = this.contexts.get(state.id);
    if (action.startsWith('app:')) {
      const item = state.app.menu?.find((candidate) => `app:${candidate.id}` === action);
      if (item && context) item.run(context);
      return;
    }
    if (action === 'duplicate') { this.open(state.app, { linkId: state.linkId, forceNew: true }); return; }
    if (action === 'browser' && context?.link?.data.url) { window.open(context.link.data.url, '_blank', 'noopener'); return; }
    if (action === 'browser') {
      const url = new URL(location.href);
      url.search = '';
      url.searchParams.set('app', state.app.id);
      if (state.linkId) url.searchParams.set('link', state.linkId);
      window.open(url, `airworks-${state.id}`, `popup=yes,width=${Math.max(720, state.width)},height=${Math.max(520, state.height)}`);
      return;
    }
    if (action === 'update' && state.linkId) {
      const link = this.workspace.find(state.linkId)?.item;
      if (link && this.settings.overwriteName) link.label = state.title;
      this.workspace.render();
      this.workspace.flash(state.linkId);
      return;
    }
    if (action !== 'create') return;
    const shortcut = this.workspace.addShortcut(state.app, state.title, this.workspace.shortcut(state.linkId)?.data);
    if (!shortcut) return;
    state.linkId = shortcut.id;
    this.windows.sync();
    this.windows.expose(true);
    setTimeout(() => {
      this.workspace.flash(shortcut.id, true);
      this.workspace.rename(shortcut.id, (saved) => {
        if (!saved) { this.workspace.remove(shortcut.id); state.linkId = undefined; this.windows.sync(); }
        this.windows.expose(false);
      });
    }, 450);
  }

  private registerBuiltinApps() {
    if (!runtime.apps.has('airworks.identity')) runtime.registerApp(createIdentityApp(() => runtime.options.identityStore, runtime.access));
    if (runtime.options.webLinks !== false && !runtime.apps.has(WEB_LINK)) runtime.registerApp(createWebLinkApp((context) => void this.editWebLink(context)));
    if (!runtime.apps.has(DOCS)) runtime.registerApp({
      id: DOCS, title: t('docs'), icon: 'fn-help.png', accent: '#35496b', hidden: true,
      width: Math.round(innerWidth * .75), height: Math.round(innerHeight * .8),
      render: ({ host }) => {
        host.classList.add('frame');
        host.innerHTML = `<iframe class="app-frame" src="${esc(runtime.options.docsUrl ?? 'about:blank')}" title="${esc(t('docs'))}"></iframe>`;
      },
    });
    const existing = runtime.apps.get('airworks.settings');
    if (existing) { this.settingsApp = existing as typeof this.settingsApp; return; }
    this.settingsApp = createSettingsApp({
      settings: () => this.settings,
      update: (patch) => this.updateSettings(patch),
      asset: (name) => runtime.asset(name),
      access: () => runtime.access.snapshot,
      brand: () => this.brand(),
      docsUrl: () => runtime.options.docsUrl,
      openDocs: () => this.launch(DOCS),
      version: VERSION,
    });
    runtime.registerApp(this.settingsApp);
  }

  private async createWebLink(existing?: Shortcut) {
    const app = runtime.apps.get(WEB_LINK);
    const link = app && await editWebLink(this.$('.air-shell'), {}, (name) => runtime.asset(name));
    if (!app || !link) {
      if (existing) this.workspace.remove(existing.id);
      return;
    }
    const data = { url: link.url, accent: link.accent, icon: link.icon };
    if (existing) this.workspace.update(existing.id, { label: link.label, data });
    const shortcut = existing ?? this.workspace.addShortcut(app, link.label, data);
    if (!shortcut) return;
    this.workspace.flash(shortcut.id, true);
    this.open(app, { linkId: shortcut.id });
  }

  private async editWebLink(context: AppContext) {
    const shortcut = this.workspace.shortcut(context.link?.id);
    if (!shortcut) return;
    const link = await editWebLink(this.$('.air-shell'), { label: shortcut.label, ...shortcut.data }, (name) => runtime.asset(name));
    if (!link) return;
    this.workspace.update(shortcut.id, { label: link.label, data: { url: link.url, accent: link.accent, icon: link.icon } });
    this.workspace.flash(shortcut.id);
    this.windows.windows.filter((state) => state.linkId === shortcut.id).forEach((state) => {
      this.windows.setAppearance(state.id, { title: link.label, accent: link.accent, icon: link.icon });
      const frame = this.contexts.get(state.id)?.host.querySelector('iframe');
      if (frame) frame.src = link.url;
    });
  }

  private onAppsChanged() {
    this.renderStartMenu();
    this.workspace.render();
    this.openPending();
  }

  private onAccessChanged() {
    this.emit('airworks:access-changed', runtime.access.snapshot);
    if (runtime.access.session?.identity?.id !== this.profileIdentity) { void this.loadProfile(); return; }
    this.windows.windows.filter((state) => !runtime.canOpen(state.app)).forEach((state) => this.windows.close(state.id));
    this.onAppsChanged();
  }

  private async loadProfile() {
    await this.flushProfile();
    const identity = runtime.access.session?.identity?.id;
    const key = identity ? `${this.storageKey}.${identity}` : this.storageKey;
    this.loadingProfile = true;
    this.profileIdentity = identity;
    this.profileKey = key;
    this.pendingWindows = [];
    this.windows.closeAll();
    const locked = this.loginRequired && !identity;
    const profile = locked ? {} : await this.profileStore().load(key).catch(() => undefined) as Profile ?? {};
    if (this.profileKey !== key) return;
    this.settings = { ...defaultSettings, ...profile.settings };
    this.workspace.load(profile.workspace);
    if (!profile.workspace && !locked) (runtime.options.initialShortcuts ?? []).forEach((id) => {
      const app = runtime.apps.get(id);
      if (app) this.workspace.addShortcut(app);
    });
    const initial = (runtime.options.initialApps ?? []).map((appId) => ({ appId }) as SavedWindow);
    this.pendingWindows = locked ? [] : this.standaloneWindow ? [this.standaloneWindow]
      : profile.workspace ? (this.settings.restoreWindows ? profile.windows ?? [] : []) : initial;
    this.loadingProfile = locked;
    this.applySettings();
    this.renderStartMenu();
    this.openPending();
    if (locked) this.login.show();
  }

  private profileStore() { return runtime.options.profileStore ?? localProfileStore(); }

  private profile(): Profile {
    const windows = this.windows.windows.map((state): SavedWindow => ({ appId: state.app.id, x: state.x, y: state.y, width: state.width, height: state.height, maximized: state.maximized, snap: state.snap, linkId: state.linkId }));
    return { settings: this.settings, workspace: this.workspace.toJSON(), windows: [...windows, ...this.pendingWindows] };
  }

  private saveProfile() {
    if (this.loadingProfile || this.standalone) return;
    clearTimeout(this.saveTimer);
    const key = this.profileKey;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = undefined;
      if (key === this.profileKey) void this.profileStore().save(key, this.profile()).catch(() => undefined);
    }, 400);
  }

  private async flushProfile() {
    if (this.saveTimer === undefined) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    await this.profileStore().save(this.profileKey, this.profile()).catch(() => undefined);
  }

  private revealStartButton() {
    const button = this.$('.start-button');
    button.classList.remove('aw-start-hidden');
    button.classList.add('aw-start-reveal');
    setTimeout(() => button.classList.remove('aw-start-reveal'), 400);
  }

  private openPending() {
    this.pendingWindows = this.pendingWindows.filter((saved) => {
      const app = runtime.apps.get(saved.appId);
      if (!app || !runtime.canOpen(app)) return true;
      const geometry = saved.width ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height, maximized: saved.maximized, snap: saved.snap } : undefined;
      this.open(app, { linkId: saved.linkId, forceNew: true, geometry });
      return false;
    });
  }

  private async logout() {
    this.$('.air-shell').classList.add('logging-out');
    this.toggleStart(false);
    await this.flushProfile();
    await runtime.access.logout();
    setTimeout(() => this.$('.air-shell').classList.remove('logging-out'), 650);
  }

  private togglePilot(force?: boolean) {
    this.windows.expose(false);
    this.workspace.closeFolder();
    this.pilotOpen = force ?? !this.pilotOpen;
    this.classList.toggle('pilot-mode', this.pilotOpen);
    const pilot = this.$('.pilot-view');
    pilot.classList.toggle('visible', this.pilotOpen);
    pilot.ariaHidden = String(!this.pilotOpen);
    if (this.pilotOpen) this.renderPilot();
  }

  private renderPilot() {
    const windowContainer = this.$('.pilot-windows');
    windowContainer.replaceChildren(...this.windows.windows.map((state) => {
      const card = document.createElement('div');
      card.className = 'pilot-card';
      card.tabIndex = 0;
      card.role = 'button';
      card.style.setProperty('--accent', state.accent);
      card.innerHTML = `<span class="pilot-title"><img src="${esc(runtime.asset(state.icon))}" alt=""/>${esc(state.title)}</span><span class="pilot-content"></span>`;
      const activate = () => { this.togglePilot(false); this.windows.focus(state.id); };
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') activate(); });
      return card;
    }));
    windowContainer.querySelectorAll<HTMLElement>('.pilot-content').forEach((content, index) => {
      content.append(this.windows.snapshot(this.windows.windows[index].id, content.clientWidth, content.clientHeight));
    });
    const pages = this.workspace.pages;
    const homes = this.$('.pilot-homescreens');
    homes.innerHTML = pages.map((page, index) => `<div class="pilot-home ${index === this.workspace.current ? 'active' : ''}" role="button" tabindex="0" data-page="${index}"><div class="pilot-home-icons">${page.items.map((item) => {
      const app = item.kind === 'app' ? runtime.apps.get(item.appId) : undefined;
      const cell = `grid-column:${item.column + 1};grid-row:${item.row + 1}`;
      if (item.kind === 'folder') return `<span class="mini-folder" style="${cell}"></span>`;
      if (!app || !runtime.canOpen(app)) return '';
      const { accent, icon } = appearanceOf(item as Shortcut, app);
      return `<span style="${cell};--accent:${esc(accent)}"><img src="${esc(runtime.asset(icon))}" alt=""/></span>`;
    }).join('')}</div><small>${t('webtop')} ${index + 1}</small>${pages.length > 1 ? `<button class="delete-home" aria-label="${t('deleteWebtop')}"></button>` : ''}</div>`).join('')
      + (pages.length < MAX_WEBTOPS ? `<button class="pilot-add" aria-label="${t('addWebtop')}">+</button>` : '');
    homes.querySelectorAll<HTMLElement>('.pilot-home').forEach((home) => home.addEventListener('click', (event) => {
      const index = Number(home.dataset.page);
      if ((event.target as Element).closest('.delete-home')) { this.workspace.removePage(index); this.renderPilot(); return; }
      this.togglePilot(false);
      this.workspace.goTo(index, false);
    }));
    homes.querySelector('.pilot-add')?.addEventListener('click', () => { this.workspace.addPage(); this.renderPilot(); });
  }

  private emit(type: string, detail?: unknown) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true })); }
}
