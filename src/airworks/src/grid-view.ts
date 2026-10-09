import type { Cell, GridItem, GridSize, Page } from './grid';

export type GridLayout = { left: number; top: number; step: number; icon: number };
export type Padding = { left: number; right: number; top: number; bottom: number };

export function fitLayout(width: number, height: number, size: GridSize, padding: Padding, min = 54, max = 192): GridLayout {
  const availableWidth = Math.max(200, width - padding.left - padding.right);
  const availableHeight = Math.max(160, height - padding.top - padding.bottom);
  const step = Math.max(min, Math.min(max, Math.floor(Math.min(availableWidth / size.columns, availableHeight / size.rows))));
  const icon = Math.round(step * .88 / 2) * 2;
  return {
    step,
    icon,
    left: padding.left + (availableWidth - step * size.columns) / 2 + (step - icon) / 2,
    top: padding.top + (availableHeight - step * size.rows) / 2 + (step - icon) / 2,
  };
}

export class PagedGrid {
  readonly element = document.createElement('div');
  private readonly track = document.createElement('div');
  private readonly placeholder = document.createElement('div');
  private layoutCache?: GridLayout;
  current = 0;
  pageCount = 0;

  constructor(
    private readonly size: GridSize,
    private readonly layout: (width: number, height: number) => GridLayout,
    private readonly renderItem: (item: GridItem) => HTMLElement,
  ) {
    this.element.className = 'aw-grid';
    this.track.className = 'aw-grid-track';
    this.placeholder.className = 'grid-placeholder';
    this.element.append(this.track, this.placeholder);
  }

  get metrics() {
    return this.layoutCache ??= this.layout(this.element.clientWidth || innerWidth, this.element.clientHeight || innerHeight);
  }

  render(pages: Page[]) {
    this.layoutCache = undefined;
    const { icon } = this.metrics;
    this.pageCount = pages.length;
    this.track.replaceChildren(...pages.map((page, index) => {
      const element = document.createElement('div');
      element.className = 'aw-grid-page';
      element.style.left = `${index * 100}%`;
      for (const item of page.items) {
        const node = this.renderItem(item);
        const { left, top } = this.pixel(item);
        Object.assign(node.style, { left: `${left}px`, top: `${top}px`, width: `${icon}px`, height: `${icon}px`, fontSize: `${Math.max(10, icon / 10)}px` });
        element.append(node);
      }
      return element;
    }));
    this.show(Math.min(this.current, Math.max(0, pages.length - 1)), false);
  }

  show(index: number, animate = true) {
    this.current = index;
    this.track.classList.toggle('no-transition', !animate);
    this.track.style.transform = `translate3d(${-index * 100}%,0,0)`;
    if (!animate) void this.track.offsetWidth;
    this.track.classList.remove('no-transition');
  }

  pixel(cell: Cell) {
    const { left, top, step } = this.metrics;
    return { left: Math.round(left + cell.column * step), top: Math.round(top + cell.row * step) };
  }

  cellAt(x: number, y: number): Cell | undefined {
    const rect = this.element.getBoundingClientRect();
    const { left, top, step, icon } = this.metrics;
    const inset = (step - icon) / 2;
    const column = Math.floor((x - rect.left - left + inset) / step);
    const row = Math.floor((y - rect.top - top + inset) / step);
    return column >= 0 && column < this.size.columns && row >= 0 && row < this.size.rows ? { column, row } : undefined;
  }

  isCenter(x: number, y: number, cell: Cell) {
    const rect = this.element.getBoundingClientRect();
    const { left, top } = this.pixel(cell);
    const { icon } = this.metrics;
    const tile = icon * .75;
    const inset = tile * .2;
    const tileLeft = rect.left + left + icon * .125;
    const tileTop = rect.top + top + icon * .125;
    return x >= tileLeft + inset && x <= tileLeft + tile - inset && y >= tileTop + inset && y <= tileTop + tile - inset;
  }

  preview(page: Page | undefined, plan?: Map<GridItem, Cell>) {
    for (const item of page?.items ?? []) {
      const element = this.itemElement(item.id);
      if (!element) continue;
      const { left, top } = this.pixel(plan?.get(item) ?? item);
      Object.assign(element.style, { left: `${left}px`, top: `${top}px` });
    }
  }

  showPlaceholder(cell?: Cell) {
    this.placeholder.classList.toggle('visible', Boolean(cell));
    if (!cell) return;
    const { left, top } = this.pixel(cell);
    const { icon } = this.metrics;
    this.placeholder.style.cssText = `left:${left}px;top:${top}px;width:${icon}px;height:${icon}px`;
  }

  itemElement(id: string) {
    return this.track.children[this.current]?.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`) ?? undefined;
  }

  find(id: string) {
    return this.track.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`) ?? undefined;
  }
}
