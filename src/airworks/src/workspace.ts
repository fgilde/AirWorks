import { draggable, type DragHandlers, type DragSession } from './drag';
import { drop, FOLDER_SIZE, locate, newPage, place, ROOT_SIZE, tidy, type DropTarget, type Folder, type GridItem, type Page, type Shortcut } from './grid';
import { fitLayout, PagedGrid } from './grid-view';
import { t } from './i18n';
import type { AppDefinition } from './types';
import { clamp, esc, uid } from './util';
import type { WorkArea } from './windows';

export const MAX_WEBTOPS = 9;
const EDGE_SIZE = 64;
const FOLDER_EDGE_SIZE = 44;
const EDGE_DELAY = 650;
const FOLDER_OPEN_DELAY = 650;
const FOLDER_LEAVE_DELAY = 350;

export type WorkspaceHost = {
  workArea(): WorkArea;
  taskbarSide(): string;
  asset(name: string): string;
  app(id: string): AppDefinition | undefined;
  visible(app: AppDefinition): boolean;
  open(app: AppDefinition, linkId: string): void;
  dragging(active: boolean): void;
  removed(ids: string[]): void;
  created(shortcut: Shortcut): void;
  changed(): void;
};

export type WorkspaceState = { pages: Page[]; current: number };

export const appearanceOf = (shortcut: Shortcut, app: AppDefinition) => ({
  accent: shortcut.data?.accent ?? app.accent ?? 'var(--system)',
  icon: shortcut.data?.icon ?? app.icon,
});

export class Workspace {
  pages: Page[] = [newPage()];
  readonly root: PagedGrid;
  readonly folderGrid: PagedGrid;
  private openFolder?: Folder;
  private selectedId?: string;
  private readonly trash = document.createElement('div');
  private drag?: { source: GridItem; createdPages: Page[]; last: DragSession; armed: boolean; wasInFolder: boolean; deletable: boolean; overTrash?: boolean; target?: DropTarget; hoverFolder?: string };
  private edgeTimer?: number;
  private edgeDirection = 0;
  private folderTimer?: number;
  private leaveTimer?: number;

  constructor(
    private readonly desktop: HTMLElement,
    private readonly folderView: HTMLElement,
    private readonly navigation: { previous: HTMLElement; next: HTMLElement; points: HTMLElement },
    private readonly host: WorkspaceHost,
  ) {
    this.root = new PagedGrid(ROOT_SIZE, (width, height) => {
      const side = this.host.taskbarSide();
      return fitLayout(width, height, ROOT_SIZE, { left: side === 'right' ? width / 10 : Math.min(234, width / 5), right: side === 'right' ? Math.min(234, width / 5) : width / 10, top: height / 10, bottom: height / 10 });
    }, (item) => this.renderItem(item));
    this.root.element.classList.add('desktop-icons');
    this.folderGrid = new PagedGrid(FOLDER_SIZE, (width, height) => fitLayout(width, height, FOLDER_SIZE, { left: FOLDER_EDGE_SIZE, right: FOLDER_EDGE_SIZE, top: 4, bottom: 4 }, 60, 96), (item) => this.renderItem(item));
    this.folderGrid.element.classList.add('folder-icons');
    desktop.prepend(this.root.element);
    this.trash.className = 'aw-trash';
    desktop.append(this.trash);
    navigation.previous.addEventListener('click', () => this.goTo(this.root.current - 1));
    navigation.next.addEventListener('click', () => this.goTo(this.root.current + 1));
    this.renderFolderShell();
    window.addEventListener('keydown', (event) => {
      if ((event.target as Element).matches?.('input, textarea, select')) return;
      if (event.key === 'Escape' && this.openFolder) this.closeFolder();
      if (event.key === 'F2' && this.selectedId) { event.preventDefault(); this.rename(this.selectedId); }
    });
    document.addEventListener('pointerdown', (event) => {
      const target = event.target as Element;
      if (this.openFolder && !this.drag && !target.closest('.folder-view, .aw-drag-ghost')) this.closeFolder();
      if (!target.closest('.desktop-icon')) this.select(undefined);
    });
  }

  get current() { return this.root.current; }

  load(state?: WorkspaceState) {
    this.closeFolder();
    this.pages = state?.pages?.length ? state.pages.slice(0, MAX_WEBTOPS) : [newPage()];
    tidy(this.pages);
    this.root.current = clamp(state?.current ?? 0, 0, this.pages.length - 1);
    this.render();
  }

  toJSON(): WorkspaceState { return { pages: this.pages, current: this.root.current }; }

  render() {
    this.root.render(this.pages);
    if (this.openFolder) this.folderGrid.render(this.openFolder.pages);
    this.renderNavigation();
    this.renderFolderPager();
  }

  goTo(index: number, animate = true) {
    if (index < 0 || index >= this.pages.length || index === this.root.current) return;
    this.closeFolder();
    this.root.show(index, animate);
    this.renderNavigation();
    this.host.changed();
  }

  addPage() {
    if (this.pages.length >= MAX_WEBTOPS) return;
    this.pages.push(newPage());
    this.render();
    this.goTo(this.pages.length - 1, false);
  }

  removePage(index: number) {
    if (this.pages.length <= 1) return;
    this.pages.splice(index, 1);
    this.root.current = Math.min(this.root.current, this.pages.length - 1);
    this.render();
    this.host.changed();
  }

  addShortcut(app: AppDefinition, label = app.title, data?: Shortcut['data']): Shortcut | undefined {
    const shortcut: Shortcut = { id: uid(), kind: 'app', label, appId: app.id, column: 0, row: 0, ...(data && { data }) };
    const index = place(this.pages, shortcut, ROOT_SIZE, this.root.current, MAX_WEBTOPS);
    if (index < 0) return undefined;
    this.render();
    this.goTo(index);
    this.host.changed();
    return shortcut;
  }

  find(id: string) { return locate(this.pages, id); }

  shortcut(id?: string) {
    const item = id ? this.find(id)?.item : undefined;
    return item?.kind === 'app' ? item : undefined;
  }

  update(id: string, change: Partial<Pick<Shortcut, 'label' | 'data'>>) {
    const shortcut = this.shortcut(id);
    if (!shortcut) return;
    Object.assign(shortcut, change);
    this.render();
    this.host.changed();
  }

  remove(id: string) {
    if (!this.delete(id)) return;
    this.render();
    this.host.changed();
  }

  private delete(id: string) {
    const location = this.find(id);
    if (!location) return false;
    const { item } = location;
    location.grid[location.page].items = location.grid[location.page].items.filter((candidate) => candidate !== item);
    tidy(this.pages);
    this.host.removed([item.id, ...(item.kind === 'folder' ? item.pages.flatMap((page) => page.items.map((child) => child.id)) : [])]);
    return true;
  }

  element(id: string) { return this.root.find(id) ?? (this.openFolder ? this.folderGrid.find(id) : undefined); }

  dragNew(element: HTMLElement, app: AppDefinition, onStart?: () => void) {
    draggable(element, (session) => {
      onStart?.();
      return this.beginDrag(session, { id: uid(), kind: 'app', label: app.title, appId: app.id, column: 0, row: 0 });
    });
  }

  rename(id: string, onDone?: (saved: boolean) => void) {
    const location = this.find(id);
    const host = this.openFolder?.id === id
      ? this.folderView.querySelector<HTMLElement>('.folder-title')
      : this.element(id)?.querySelector<HTMLElement>('.icon-label');
    if (!location || !host || host.querySelector('input')) return;
    const item = location.item;
    const input = document.createElement('input');
    input.className = 'inline-label-editor';
    input.value = item.label;
    input.ariaLabel = t('rename');
    host.replaceChildren(input);
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      if (save && value) item.label = value;
      this.render();
      this.renderFolderShell();
      this.host.changed();
      onDone?.(save && Boolean(value));
    };
    input.addEventListener('pointerdown', (event) => event.stopPropagation());
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') finish(true);
      if (event.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  flash(id: string, created = false) {
    const element = this.element(id);
    if (!element) return;
    element.classList.remove('save-glow', 'link-created');
    void element.offsetWidth;
    element.classList.add('save-glow', ...(created ? ['link-created'] : []));
    setTimeout(() => element.classList.remove('save-glow', 'link-created'), 1100);
  }

  openFolderById(id: string) {
    const location = this.find(id);
    if (location?.item.kind !== 'folder') return;
    if (this.openFolder === location.item) return;
    this.openFolder = location.item;
    this.folderGrid.current = 0;
    this.renderFolderShell();
    this.folderGrid.render(location.item.pages);
    this.renderFolderPager();
    this.folderView.classList.remove('closing');
    this.folderView.ariaHidden = 'false';
    requestAnimationFrame(() => this.folderView.classList.add('visible'));
  }

  closeFolder() {
    const folder = this.openFolder;
    if (!folder) return;
    this.openFolder = undefined;
    const tile = this.root.find(folder.id)?.querySelector('.icon-tile');
    if (tile) {
      const from = this.folderView.getBoundingClientRect();
      const to = tile.getBoundingClientRect();
      this.folderView.style.setProperty('--folder-close-x', `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
      this.folderView.style.setProperty('--folder-close-y', `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
    }
    this.folderView.classList.add('closing');
    this.folderView.classList.remove('visible');
    this.folderView.ariaHidden = 'true';
    setTimeout(() => { if (!this.openFolder) this.folderView.classList.remove('closing'); }, 220);
  }

  private select(id?: string) {
    this.selectedId = id;
    this.desktop.querySelectorAll('.desktop-icon.selected').forEach((element) => element.classList.remove('selected'));
    if (id) this.element(id)?.classList.add('selected');
  }

  private renderItem(item: GridItem) {
    const element = document.createElement('button');
    element.dataset.item = item.id;
    element.title = item.label;
    element.className = `desktop-icon${item.kind === 'folder' ? ' folder' : ''}${item.id === this.selectedId ? ' selected' : ''}${item.id === this.drag?.source.id ? ' aw-drag-source' : ''}`;
    const app = item.kind === 'app' ? this.host.app(item.appId) : undefined;
    if (item.kind === 'app' && (!app || !this.host.visible(app))) {
      element.hidden = true;
      return element;
    }
    if (item.kind === 'folder') {
      const preview = item.pages.flatMap((page) => page.items).flatMap((child) => {
        const childApp = child.kind === 'app' ? this.host.app(child.appId) : undefined;
        return child.kind === 'app' && childApp && this.host.visible(childApp) ? [appearanceOf(child, childApp)] : [];
      }).slice(0, 4);
      element.innerHTML = `<span class="icon-tile folder-tile">${preview.map(({ accent, icon }) => `<span style="--accent:${esc(accent)}"><img src="${esc(this.host.asset(icon))}" alt="" /></span>`).join('')}</span><span class="icon-label">${esc(item.label)}</span>`;
    } else {
      const { accent, icon } = appearanceOf(item, app!);
      element.style.setProperty('--accent', accent);
      element.innerHTML = `<span class="icon-tile"><img src="${esc(this.host.asset(icon))}" alt="" /></span><span class="icon-label">${esc(item.label)}</span>`;
    }
    element.querySelectorAll('img').forEach((image) => image.addEventListener('error', () => { image.src = this.host.asset(app?.icon ?? 'icon-folder.png'); }, { once: true }));
    element.addEventListener('click', (event) => {
      this.select(item.id);
      if (!(event.target as Element).closest('.icon-tile')) return;
      if (item.kind === 'folder') this.openFolderById(item.id);
      else if (app) { this.host.open(app, item.id); this.closeFolder(); }
    });
    element.querySelector('.icon-label')!.addEventListener('dblclick', (event) => { event.stopPropagation(); this.rename(item.id); });
    draggable(element, (session) => this.beginDrag(session, item));
    return element;
  }

  private renderNavigation() {
    const { previous, next, points } = this.navigation;
    previous.classList.toggle('visible', this.root.current > 0);
    next.classList.toggle('visible', this.root.current < this.pages.length - 1);
    points.innerHTML = this.pages.map((_, index) => `<button class="${index === this.root.current ? 'active' : ''}" data-page="${index}" aria-label="${t('webtop')} ${index + 1}"></button>`).join('');
    points.querySelectorAll<HTMLElement>('button').forEach((button) => button.addEventListener('click', () => this.goTo(Number(button.dataset.page))));
  }

  private renderFolderShell() {
    const folder = this.openFolder;
    this.folderView.innerHTML = `<header><img src="${esc(this.host.asset('icon-folder.png'))}" alt=""/><span class="folder-title">${esc(folder?.label ?? '')}</span><button class="folder-close" aria-label="${t('closeFolder')}">×</button></header>
      <button class="folder-page-edge previous" aria-label="${t('page')} −">‹</button><button class="folder-page-edge next" aria-label="${t('page')} +">›</button>
      <nav class="folder-pager"></nav>`;
    this.folderView.querySelector('header')!.after(this.folderGrid.element);
    this.folderView.querySelector('.folder-close')!.addEventListener('click', () => this.closeFolder());
    this.folderView.querySelector('.folder-title')!.addEventListener('dblclick', () => folder && this.rename(folder.id));
    this.folderView.querySelector('.folder-page-edge.previous')!.addEventListener('click', () => this.showFolderPage(this.folderGrid.current - 1));
    this.folderView.querySelector('.folder-page-edge.next')!.addEventListener('click', () => this.showFolderPage(this.folderGrid.current + 1));
  }

  private renderFolderPager() {
    const pager = this.folderView.querySelector<HTMLElement>('.folder-pager');
    if (!pager) return;
    const count = this.folderGrid.pageCount;
    pager.innerHTML = count > 1 ? Array.from({ length: count }, (_, index) => `<button class="${index === this.folderGrid.current ? 'active' : ''}" data-page="${index}" aria-label="${t('page')} ${index + 1}"></button>`).join('') : '';
    pager.querySelectorAll<HTMLElement>('button').forEach((button) => button.addEventListener('click', () => this.showFolderPage(Number(button.dataset.page))));
    this.folderView.classList.toggle('has-previous', this.folderGrid.current > 0);
    this.folderView.classList.toggle('has-next', this.folderGrid.current < count - 1);
  }

  private showFolderPage(index: number) {
    if (index < 0 || index >= this.folderGrid.pageCount) return;
    this.folderGrid.show(index);
    this.renderFolderPager();
  }

  private beginDrag(session: DragSession, source: GridItem): DragHandlers {
    const deletable = Boolean(this.find(source.id));
    this.drag = { source, createdPages: [], last: session, armed: false, wasInFolder: false, deletable };
    this.trash.classList.toggle('visible', deletable);
    this.select(undefined);
    this.host.dragging(true);
    this.desktop.classList.add('aw-dragging');
    return {
      move: (current) => this.dragMove(current),
      drop: () => this.endDrag(true),
      cancel: () => this.endDrag(false),
    };
  }

  private dragMove(session: DragSession) {
    const drag = this.drag!;
    const { x, y } = drag.last = session;
    if (this.dragOverTrash(drag, x, y)) return;
    const inFolder = Boolean(this.openFolder) && this.contains(this.folderView, x, y);
    drag.wasInFolder ||= inFolder;
    if (this.openFolder && !inFolder && drag.wasInFolder) {
      this.leaveTimer ??= window.setTimeout(() => { this.leaveTimer = undefined; this.closeFolder(); }, FOLDER_LEAVE_DELAY);
    } else { clearTimeout(this.leaveTimer); this.leaveTimer = undefined; }

    const grid = inFolder ? this.folderGrid : this.root;
    const folder = inFolder ? this.openFolder : undefined;
    const pages = folder ? folder.pages : this.pages;
    const direction = inFolder ? this.edgeOf(this.folderView.getBoundingClientRect(), x, FOLDER_EDGE_SIZE) : this.rootEdge(x);
    drag.armed ||= direction === 0;
    this.edge(drag.armed ? direction : 0, x, y);

    const cell = grid.cellAt(x, y);
    drag.target = cell ? { grid: pages, page: grid.current, cell, size: folder ? FOLDER_SIZE : ROOT_SIZE, folder } : undefined;
    const occupant = cell ? pages[grid.current]?.items.find((item) => item.column === cell.column && item.row === cell.row && item !== drag.source) : undefined;
    const merge = Boolean(occupant && !folder && drag.source.kind === 'app');
    this.desktop.querySelectorAll('.drop-target').forEach((element) => element.classList.remove('drop-target'));
    if (merge) grid.itemElement(occupant!.id)?.classList.add('drop-target');
    grid.showPlaceholder(merge ? undefined : cell);
    (inFolder ? this.root : this.folderGrid).showPlaceholder(undefined);

    const hoverFolder = merge && occupant!.kind === 'folder' ? occupant!.id : undefined;
    if (hoverFolder !== drag.hoverFolder) {
      clearTimeout(this.folderTimer);
      drag.hoverFolder = hoverFolder;
      if (hoverFolder) this.folderTimer = window.setTimeout(() => { drag.wasInFolder = false; this.openFolderById(hoverFolder); this.retarget(); }, FOLDER_OPEN_DELAY);
    }
  }

  private dragOverTrash(drag: NonNullable<Workspace['drag']>, x: number, y: number) {
    drag.overTrash = drag.deletable && this.contains(this.trash, x, y);
    this.trash.classList.toggle('open', drag.overTrash);
    drag.last.ghost.classList.toggle('aw-over-trash', drag.overTrash);
    if (!drag.overTrash) return false;
    drag.target = undefined;
    drag.hoverFolder = undefined;
    clearTimeout(this.folderTimer);
    this.edge(0, x, y);
    this.root.showPlaceholder(undefined);
    this.folderGrid.showPlaceholder(undefined);
    this.desktop.querySelectorAll('.drop-target').forEach((element) => element.classList.remove('drop-target'));
    return true;
  }

  private rootEdge(x: number) {
    const work = this.host.workArea();
    return x <= work.left + EDGE_SIZE ? -1 : x >= work.right - EDGE_SIZE ? 1 : 0;
  }

  private edgeOf(rect: DOMRect, x: number, size: number) {
    return x <= rect.left + size ? -1 : x >= rect.right - size ? 1 : 0;
  }

  private edge(direction: number, x: number, y: number) {
    const inFolder = Boolean(this.openFolder) && this.contains(this.folderView, x, y);
    this.desktop.classList.toggle('drag-edge-left', !inFolder && direction < 0);
    this.desktop.classList.toggle('drag-edge-right', !inFolder && direction > 0);
    this.folderView.classList.toggle('drag-edge-left', inFolder && direction < 0);
    this.folderView.classList.toggle('drag-edge-right', inFolder && direction > 0);
    const key = direction * (inFolder ? 2 : 1);
    if (key === this.edgeDirection) return;
    this.edgeDirection = key;
    clearInterval(this.edgeTimer);
    if (!direction) return;
    this.edgeTimer = window.setInterval(() => this.switchDuringDrag(direction, inFolder), EDGE_DELAY);
  }

  private switchDuringDrag(direction: number, inFolder: boolean) {
    const folder = inFolder ? this.openFolder : undefined;
    const grid = folder ? this.folderGrid : this.root;
    const pages = folder ? folder.pages : this.pages;
    const target = grid.current + direction;
    if (target < 0) return;
    if (target >= pages.length) {
      if (!folder && pages.length >= MAX_WEBTOPS) return;
      if (pages[pages.length - 1].items.every((item) => item === this.drag?.source)) return;
      const page = newPage();
      pages.push(page);
      this.drag!.createdPages.push(page);
      grid.render(pages);
    }
    if (folder) { grid.show(target); this.renderFolderPager(); }
    else { this.root.show(target); this.renderNavigation(); }
    this.retarget();
  }

  private retarget() {
    if (this.drag) requestAnimationFrame(() => this.drag && this.dragMove(this.drag.last));
  }

  private endDrag(commit: boolean) {
    const drag = this.drag!;
    clearInterval(this.edgeTimer);
    clearTimeout(this.folderTimer);
    clearTimeout(this.leaveTimer);
    this.leaveTimer = undefined;
    this.edgeDirection = 0;
    this.desktop.classList.remove('aw-dragging', 'drag-edge-left', 'drag-edge-right');
    this.folderView.classList.remove('drag-edge-left', 'drag-edge-right');
    this.desktop.querySelectorAll('.drop-target').forEach((element) => element.classList.remove('drop-target'));
    this.root.showPlaceholder(undefined);
    this.folderGrid.showPlaceholder(undefined);
    this.trash.classList.remove('visible', 'open');

    let changed = false;
    if (commit && drag.overTrash) changed = this.delete(drag.source.id);
    else if (commit && drag.target) changed = drop(this.pages, drag.source, drag.target, `${t('newFolder')}`);
    else if (commit && !this.find(drag.source.id) && !this.openFolder) changed = place(this.pages, drag.source, ROOT_SIZE, this.root.current, MAX_WEBTOPS) >= 0;
    this.drag = undefined;

    for (const page of drag.createdPages) {
      if (page.items.length) continue;
      const owner = this.pages.includes(page) ? this.pages : this.openFolder?.pages;
      owner?.splice(owner.indexOf(page), 1);
    }
    tidy(this.pages);
    if (this.openFolder && !this.find(this.openFolder.id)) this.closeFolder();
    this.root.current = clamp(this.root.current, 0, this.pages.length - 1);
    this.folderGrid.current = clamp(this.folderGrid.current, 0, Math.max(0, (this.openFolder?.pages.length ?? 1) - 1));
    this.render();
    this.host.dragging(false);
    if (!changed) return;
    if (!drag.overTrash) this.select(drag.source.id);
    this.host.changed();
    if (!drag.deletable && drag.source.kind === 'app') this.host.created(drag.source);
  }

  private contains(element: HTMLElement, x: number, y: number) {
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
}
