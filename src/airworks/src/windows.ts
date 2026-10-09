import { t } from './i18n';
import type { AppDefinition, Appearance } from './types';
import { esc } from './util';

export type Rect = { x: number; y: number; width: number; height: number };
export type WorkArea = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type WindowState = Rect & {
  id: number;
  app: AppDefinition;
  title: string;
  accent: string;
  icon: string;
  minimized: boolean;
  maximized: boolean;
  snap?: Zone;
  restore?: Rect;
  linkId?: string;
};
export type MenuAction = 'update' | 'create' | 'duplicate' | 'browser' | `app:${string}`;

export type WindowHost = {
  workArea(): WorkArea;
  asset(name: string): string;
  startMaximized(): boolean;
  previewDelay(): number;
  taskbarSide(): 'top' | 'right' | 'bottom' | 'left';
  mount(state: WindowState, body: HTMLElement): void;
  unmount(state: WindowState): void;
  menuAction(state: WindowState, action: MenuAction): void;
  changed(): void;
};

const EDGE = 16;
const CORNER = 80;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;

export type Zone = 'top' | 'top-half' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type Direction = 'left' | 'right' | 'top' | 'bottom';

const KEY_SNAP: Record<Zone | 'none', Partial<Record<Direction, Zone | null | 'minimize'>>> = {
  none: { left: 'left', right: 'right', top: 'top', bottom: 'bottom' },
  left: { left: 'right', right: null, top: 'top-left', bottom: 'bottom-left' },
  right: { right: 'left', left: null, top: 'top-right', bottom: 'bottom-right' },
  'top-left': { top: 'top', right: 'top-right', left: 'left', bottom: 'bottom-left' },
  'top-right': { top: 'top', left: 'top-left', right: 'right', bottom: 'bottom-right' },
  'bottom-left': { top: 'top-left', right: 'bottom-right', left: 'left', bottom: 'bottom' },
  'bottom-right': { top: 'top-right', left: 'bottom-left', right: 'right', bottom: 'bottom' },
  top: { top: 'top-half', left: 'left', right: 'right', bottom: null },
  'top-half': { top: 'top', left: 'top-left', right: 'top-right', bottom: null },
  bottom: { left: 'bottom-left', right: 'bottom-right', bottom: 'minimize', top: null },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class WindowManager {
  windows: WindowState[] = [];
  private readonly elements = new Map<number, HTMLElement>();
  private nextId = 1;
  private previewTimer?: number;
  private exposed = false;

  constructor(
    private readonly layer: HTMLElement,
    private readonly tasks: HTMLElement,
    private readonly preview: HTMLElement,
    private readonly snapIndicator: HTMLElement,
    private readonly host: WindowHost,
  ) {
    window.addEventListener('keydown', (event) => this.onKey(event));
  }

  get active() { return [...this.windows].reverse().find((state) => !state.minimized); }

  find(id: number) { return this.windows.find((state) => state.id === id); }

  open(app: AppDefinition, options: { linkId?: string; forceNew?: boolean; appearance?: Appearance; geometry?: Partial<Rect> & { maximized?: boolean; snap?: Zone } } = {}) {
    const existing = !options.forceNew && this.windows.find((state) => state.app.id === app.id && (!app.multiple || (options.linkId && state.linkId === options.linkId)));
    if (existing) {
      if (options.linkId) existing.linkId = options.linkId;
      this.focus(existing.id);
      return existing;
    }
    const work = this.host.workArea();
    const width = Math.min(app.width ?? 800, work.width - 30);
    const height = Math.min(app.height ?? 560, work.height - 30);
    const offset = (this.windows.length % 6) * 34;
    const state: WindowState = {
      id: this.nextId++, app, width, height, minimized: false, linkId: options.linkId,
      title: options.appearance?.title ?? app.title, accent: options.appearance?.accent ?? app.accent ?? 'var(--system)', icon: options.appearance?.icon ?? app.icon,
      x: Math.max(work.left + 14, Math.round(work.left + (work.width - width) / 2) + offset - 70),
      y: Math.max(work.top + 14, Math.round(work.top + (work.height - height) / 2) + offset - 30),
      ...options.geometry,
      snap: undefined,
      maximized: false,
    } as WindowState;
    const geometry = options.geometry;
    const zone = geometry?.snap ?? (geometry?.maximized || (geometry?.maximized === undefined && this.host.startMaximized()) ? 'top' : undefined);
    if (zone) this.snap(state, zone);
    this.windows.push(state);
    this.layer.append(this.createElement(state));
    this.host.mount(state, this.elements.get(state.id)!.querySelector('.window-body')!);
    this.sync();
    return state;
  }

  focus(id: number) {
    const state = this.find(id);
    if (!state) return;
    state.minimized = false;
    this.windows = this.windows.filter((candidate) => candidate !== state).concat(state);
    this.sync();
  }

  close(id: number) {
    const state = this.find(id);
    if (!state) return;
    this.host.unmount(state);
    this.elements.get(id)?.remove();
    this.elements.delete(id);
    this.windows = this.windows.filter((candidate) => candidate !== state);
    this.hidePreview();
    this.sync();
  }

  closeAll() { [...this.windows].forEach((state) => this.close(state.id)); }

  minimize(id: number) {
    const state = this.find(id);
    if (state) state.minimized = true;
    this.sync();
  }

  toggleMaximize(id: number) {
    const state = this.find(id);
    if (state) { this.setMaximized(state, !state.maximized); this.sync(); }
  }

  setAppearance(id: number, appearance: Appearance) {
    const state = this.find(id);
    const element = this.elements.get(id);
    if (!state || !element) return;
    Object.assign(state, Object.fromEntries(Object.entries(appearance).filter(([, value]) => value)));
    element.style.setProperty('--accent', state.accent);
    element.querySelectorAll('h2, .window-menu-title span').forEach((node) => { node.textContent = state.title; });
    element.querySelectorAll<HTMLImageElement>('.window-icon, .window-menu-title img').forEach((image) => { image.src = this.host.asset(state.icon); });
    this.renderTasks();
  }

  toggleDesktop() {
    this.expose(false);
    const anyVisible = this.windows.some((state) => !state.minimized);
    this.windows.forEach((state) => { state.minimized = anyVisible; });
    this.sync();
  }

  expose(on: boolean) {
    if (on === this.exposed) return;
    this.exposed = on;
    this.layer.classList.toggle('exposed', on);
    const directions = ['right', 'bottom', 'left', 'top'];
    this.windows.forEach((state, index) => {
      const element = this.elements.get(state.id)!;
      element.classList.toggle('app-expose', on);
      const direction = directions[index % directions.length];
      element.style.left = `${on && direction === 'left' ? -state.width + 10 : on && direction !== 'bottom' ? innerWidth - 10 : state.x}px`;
      element.style.top = `${on && direction === 'bottom' ? innerHeight - 10 : state.y}px`;
    });
  }

  constrain() {
    const work = this.host.workArea();
    for (const state of this.windows) {
      if (state.snap) Object.assign(state, this.zoneRect(state.snap));
      else {
        state.x = Math.max(work.left - state.width + 120, Math.min(state.x, work.right - 120));
        state.y = Math.max(work.top, Math.min(state.y, work.bottom - 80));
      }
    }
    this.sync();
  }

  snapshot(id: number, width: number, height: number) {
    const frame = document.createElement('div');
    frame.className = 'aw-snapshot';
    const body = this.elements.get(id)?.querySelector<HTMLElement>('.window-body');
    if (!body) return frame;
    const copy = body.cloneNode(true) as HTMLElement;
    const originals = [body, ...body.querySelectorAll<HTMLElement>('*')];
    const clones = [copy, ...copy.querySelectorAll<HTMLElement>('*')];
    const scrolled = originals.flatMap((node, index) => node.scrollTop || node.scrollLeft ? [[clones[index], node.scrollTop, node.scrollLeft] as const] : []);
    originals.forEach((node, index) => {
      if (node instanceof HTMLCanvasElement) (clones[index] as HTMLCanvasElement).getContext('2d')?.drawImage(node, 0, 0);
    });
    clones.forEach((node) => {
      if (node.localName === 'script') node.remove();
      else if (node.localName === 'iframe') node.replaceWith(Object.assign(document.createElement('div'), { className: 'aw-snapshot-frame', textContent: node.title }));
      else if (node.localName.includes('-')) {
        const flat = document.createElement('div');
        flat.className = node.className;
        flat.replaceChildren(...node.childNodes);
        node.replaceWith(flat);
      }
    });
    const scale = Math.min(width / (body.clientWidth || width), height / (body.clientHeight || height));
    Object.assign(copy.style, { width: `${body.clientWidth}px`, height: `${body.clientHeight}px`, transform: `scale(${scale})` });
    Object.assign(frame.style, { width: `${width}px`, height: `${height}px` });
    frame.append(copy);
    requestAnimationFrame(() => scrolled.forEach(([node, top, left]) => { node.scrollTop = top; node.scrollLeft = left; }));
    return frame;
  }

  sync() {
    const top = this.active;
    this.windows.forEach((state, index) => {
      const element = this.elements.get(state.id)!;
      element.classList.toggle('active', state === top);
      element.classList.toggle('minimized', state.minimized);
      element.classList.toggle('maximized', state.maximized);
      Object.assign(element.style, { zIndex: String(10 + index), width: `${state.width}px`, height: `${state.height}px` });
      if (!this.exposed) Object.assign(element.style, { left: `${state.x}px`, top: `${state.y}px` });
      const maximize = element.querySelector<HTMLElement>('[data-action="maximize"]')!;
      maximize.title = maximize.ariaLabel = t(state.maximized ? 'restore' : 'maximize');
      maximize.querySelector('img')!.src = this.host.asset(state.maximized ? 'window-maximize-down.png' : 'window-maximize-up.png');
      element.querySelector<HTMLButtonElement>('[data-menu-action="update"]')!.disabled = !state.linkId;
    });
    this.renderTasks();
    this.host.changed();
  }

  private createElement(state: WindowState) {
    const asset = this.host.asset;
    const element = document.createElement('article');
    element.className = 'air-window';
    element.dataset.window = String(state.id);
    element.style.setProperty('--accent', state.accent);
    const icon = asset(state.icon);
    const actions: Array<[MenuAction, string, string]> = [
      ['update', t('updateLink'), 'action-updateDesktopLink.png'], ['create', t('createLink'), 'action-createDesktopLink.png'],
      ['duplicate', t('duplicate'), 'action-copy.png'], ['browser', t('openInBrowser'), 'fn-userweblink.png'],
      ...(state.app.menu ?? []).map((item): [MenuAction, string, string] => [`app:${item.id}`, item.title, item.icon]),
    ];
    element.innerHTML = `
      <header class="window-header">
        <button class="window-menu-trigger" aria-label="${t('appMenu')}" title="${t('appMenu')}"><img class="window-icon" src="${esc(icon)}" alt="" /></button>
        <h2>${esc(state.title)}</h2>
        <div class="window-tools">
          <button data-action="minimize" title="${t('minimize')}" aria-label="${t('minimize')}"><img src="${asset('window-minimize.png')}" alt="" /></button>
          <button data-action="maximize"><img alt="" /></button>
          <button data-action="close" title="${t('close')}" aria-label="${t('close')}"><img src="${asset('window-close.png')}" alt="" /></button>
        </div>
      </header>
      <aside class="window-menu" aria-hidden="true">
        <div class="window-menu-title"><img src="${esc(icon)}" alt=""/><span>${esc(state.title)}</span></div>
        <ul>${actions.map(([id, text, image], index) => `${index === 1 ? '<li class="window-menu-separator"></li>' : ''}<li><button data-menu-action="${id}"><img src="${asset(image)}" alt=""/><span>${text}</span></button></li>`).join('')}</ul>
      </aside>
      <div class="window-body"></div>
      ${['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((edge) => `<div class="resize-handle" data-edge="${edge}" aria-hidden="true"></div>`).join('')}`;
    this.elements.set(state.id, element);

    const menu = element.querySelector<HTMLElement>('.window-menu')!;
    const toggleMenu = (open = !menu.classList.contains('open')) => { menu.classList.toggle('open', open); menu.ariaHidden = String(!open); };
    element.addEventListener('pointerdown', (event) => {
      if (this.active !== state) this.focus(state.id);
      if (!(event.target as Element).closest('.window-menu, .window-menu-trigger')) toggleMenu(false);
    });
    element.querySelector('.window-menu-trigger')!.addEventListener('click', () => toggleMenu());
    element.querySelector('.window-menu-title')!.addEventListener('click', () => toggleMenu(false));
    element.querySelectorAll<HTMLElement>('[data-menu-action]').forEach((button) => button.addEventListener('click', () => {
      toggleMenu(false);
      this.host.menuAction(state, button.dataset.menuAction as MenuAction);
    }));
    element.querySelectorAll<HTMLElement>('[data-action]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      ({ close: () => this.close(state.id), minimize: () => this.minimize(state.id), maximize: () => this.toggleMaximize(state.id) })[button.dataset.action as 'close']();
    }));
    this.bindMove(element, state);
    this.bindResize(element, state);
    return element;
  }

  private bindMove(element: HTMLElement, state: WindowState) {
    const header = element.querySelector<HTMLElement>('.window-header')!;
    header.addEventListener('dblclick', (event) => { if (!(event.target as Element).closest('button')) this.toggleMaximize(state.id); });
    header.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || (event.target as Element).closest('button, .window-menu')) return;
      event.preventDefault();
      const origin = { x: event.clientX, y: event.clientY, left: state.x, top: state.y };
      let zone: Zone | undefined;
      let moved = false;
      let before: Rect | undefined;
      const move = (moveEvent: PointerEvent) => {
        if (!moved) {
          moved = true;
          element.classList.add('dragging');
          if (state.snap && state.restore) {
            const ratio = (origin.x - state.x) / Math.max(1, state.width);
            Object.assign(state, state.restore, { snap: undefined, maximized: false, restore: undefined });
            origin.left = origin.x - state.width * ratio;
            origin.top = this.host.workArea().top;
            this.sync();
          }
          before = { x: origin.left, y: origin.top, width: state.width, height: state.height };
        }
        state.x = origin.left + moveEvent.clientX - origin.x;
        state.y = Math.max(this.host.workArea().top, origin.top + moveEvent.clientY - origin.y);
        Object.assign(element.style, { left: `${state.x}px`, top: `${state.y}px` });
        zone = this.zoneAt(moveEvent.clientX, moveEvent.clientY);
        this.showSnap(zone);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        element.classList.remove('dragging');
        this.showSnap(undefined);
        if (zone && before) this.snap(Object.assign(state, before), zone);
        if (moved) this.sync();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  private bindResize(element: HTMLElement, state: WindowState) {
    element.querySelectorAll<HTMLElement>('[data-edge]').forEach((handle) => handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.snap === 'top') return;
      const edge = handle.dataset.edge!;
      const origin = { px: event.clientX, py: event.clientY, x: state.x, y: state.y, width: state.width, height: state.height };
      Object.assign(state, { snap: undefined, maximized: false, restore: undefined });
      element.classList.add('resizing');
      const move = (moveEvent: PointerEvent) => {
        const work = this.host.workArea();
        const dx = moveEvent.clientX - origin.px;
        const dy = moveEvent.clientY - origin.py;
        if (edge.includes('e')) state.width = clamp(origin.width + dx, MIN_WIDTH, work.right - origin.x);
        if (edge.includes('s')) state.height = clamp(origin.height + dy, MIN_HEIGHT, work.bottom - origin.y);
        if (edge.includes('w')) {
          state.width = clamp(origin.width - dx, MIN_WIDTH, origin.x + origin.width - work.left);
          state.x = origin.x + origin.width - state.width;
        }
        if (edge.includes('n')) {
          state.height = clamp(origin.height - dy, MIN_HEIGHT, origin.y + origin.height - work.top);
          state.y = origin.y + origin.height - state.height;
        }
        Object.assign(element.style, { left: `${state.x}px`, top: `${state.y}px`, width: `${state.width}px`, height: `${state.height}px` });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        element.classList.remove('resizing');
        this.sync();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }));
  }

  private setMaximized(state: WindowState, maximized: boolean) {
    if (maximized) this.snap(state, 'top');
    else this.unsnap(state);
  }

  private zoneAt(x: number, y: number): Zone | undefined {
    const work = this.host.workArea();
    const left = x <= work.left + EDGE;
    const right = x >= work.right - EDGE;
    const top = y <= work.top + EDGE;
    const bottom = y >= work.bottom - EDGE;
    if (left && y <= work.top + CORNER) return 'top-left';
    if (right && y <= work.top + CORNER) return 'top-right';
    if (left && y >= work.bottom - CORNER) return 'bottom-left';
    if (right && y >= work.bottom - CORNER) return 'bottom-right';
    return top ? 'top' : bottom ? 'bottom' : left ? 'left' : right ? 'right' : undefined;
  }

  private zoneRect(zone: Zone): Rect {
    const work = this.host.workArea();
    const width = Math.floor(work.width / 2);
    const height = Math.floor(work.height / 2);
    const right = work.left + work.width - width;
    const lower = work.top + work.height - height;
    const rects: Record<Zone, Rect> = {
      top: { x: work.left, y: work.top, width: work.width, height: work.height },
      'top-half': { x: work.left, y: work.top, width: work.width, height },
      bottom: { x: work.left, y: lower, width: work.width, height },
      left: { x: work.left, y: work.top, width, height: work.height },
      right: { x: right, y: work.top, width, height: work.height },
      'top-left': { x: work.left, y: work.top, width, height },
      'top-right': { x: right, y: work.top, width, height },
      'bottom-left': { x: work.left, y: lower, width, height },
      'bottom-right': { x: right, y: lower, width, height },
    };
    return rects[zone];
  }

  private showSnap(zone?: Zone) {
    this.snapIndicator.classList.toggle('visible', Boolean(zone));
    if (!zone) return;
    const rect = this.zoneRect(zone);
    Object.assign(this.snapIndicator.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  }

  private snap(state: WindowState, zone: Zone) {
    if (!state.snap) state.restore = { x: state.x, y: state.y, width: state.width, height: state.height };
    Object.assign(state, this.zoneRect(zone), { snap: zone, maximized: zone === 'top' });
  }

  private unsnap(state: WindowState) {
    if (state.restore) Object.assign(state, state.restore);
    Object.assign(state, { snap: undefined, maximized: false, restore: undefined });
  }

  private onKey(event: KeyboardEvent) {
    const direction = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom' } as const)[event.key as 'ArrowLeft'];
    if (!event.ctrlKey || !direction || (event.target as Element).matches?.('input, textarea, select, [contenteditable]')) return;
    const state = this.active;
    if (!state) return;
    event.preventDefault();
    const next = KEY_SNAP[state.snap ?? 'none'][direction];
    if (next === 'minimize') state.minimized = true;
    else if (next === null) this.unsnap(state);
    else if (next) this.snap(state, next);
    this.sync();
  }

  private renderTasks() {
    const side = this.host.taskbarSide();
    const vertical = side === 'left' || side === 'right';
    const width = vertical ? 34 : Math.max(66, Math.min(165, this.tasks.clientWidth / Math.max(1, this.windows.length) - 10));
    const top = this.active;
    const ordered = [...this.windows].sort((a, b) => a.id - b.id);
    this.tasks.innerHTML = ordered.map((state) => `<button class="task ${state === top ? 'active' : ''}" data-window="${state.id}" style="--accent:${esc(state.accent)};width:${width}px" title="${esc(state.title)}"><span class="task-border"></span><span class="task-icon"><img src="${esc(this.host.asset(state.icon))}" alt="" /></span><span class="task-caption">${esc(state.title)}</span><i class="task-close" title="${t('close')}"></i></button>`).join('');
    this.tasks.querySelectorAll<HTMLElement>('.task').forEach((task) => {
      const id = Number(task.dataset.window);
      task.addEventListener('click', (event) => {
        if ((event.target as Element).closest('.task-close')) { this.close(id); return; }
        const state = this.find(id)!;
        if (state === this.active) this.minimize(id); else this.focus(id);
      });
      task.addEventListener('pointerenter', () => {
        clearTimeout(this.previewTimer);
        this.previewTimer = window.setTimeout(() => this.showPreview(task, id), this.host.previewDelay());
      });
      task.addEventListener('pointerleave', () => {
        clearTimeout(this.previewTimer);
        setTimeout(() => { if (!this.preview.matches(':hover')) this.hidePreview(); }, 80);
      });
    });
  }

  private showPreview(task: HTMLElement, id: number) {
    const state = this.find(id);
    if (!state) return;
    const side = this.host.taskbarSide();
    this.preview.innerHTML = `<header style="--accent:${esc(state.accent)}"><span class="preview-icon"><img src="${esc(this.host.asset(state.icon))}" alt=""/></span><span>${esc(state.title)}</span><button title="${t('close')}">×</button></header><div class="preview-content"></div>`;
    this.preview.querySelector('.preview-content')!.append(this.snapshot(id, 220, 150));
    const rect = task.getBoundingClientRect();
    this.preview.className = `task-preview preview-${side} visible`;
    if (side === 'top' || side === 'bottom') {
      this.preview.style.left = `${Math.max(0, Math.min(innerWidth - 260, rect.left + rect.width / 2 - 130))}px`;
      this.preview.style.top = side === 'top' ? '50px' : `${innerHeight - 215}px`;
    } else {
      this.preview.style.left = side === 'left' ? '50px' : `${innerWidth - 270}px`;
      this.preview.style.top = `${Math.max(0, Math.min(innerHeight - 205, rect.top + rect.height / 2 - 102))}px`;
    }
    this.preview.ariaHidden = 'false';
    this.preview.querySelector('button')!.onclick = (event) => { event.stopPropagation(); this.close(id); };
    this.preview.onclick = () => { this.focus(id); this.hidePreview(); };
    this.preview.onpointerleave = () => this.hidePreview();
  }

  hidePreview() {
    this.preview.classList.remove('visible');
    this.preview.ariaHidden = 'true';
  }
}
