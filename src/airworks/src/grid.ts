
export type Cell = { column: number; row: number };
export type GridSize = { columns: number; rows: number };
export type Shortcut = Cell & { id: string; kind: 'app'; label: string; appId: string; data?: Record<string, string> };
export type Folder = Cell & { id: string; kind: 'folder'; label: string; pages: Page[] };
export type GridItem = Shortcut | Folder;
export type Page = { id: string; items: GridItem[] };

export type Location = { grid: Page[]; page: number; item: GridItem; folder?: Folder };
export type DropTarget = { grid: Page[]; page: number; cell: Cell; size: GridSize; folder?: Folder };

export const ROOT_SIZE: GridSize = { columns: 5, rows: 3 };
export const FOLDER_SIZE: GridSize = { columns: 4, rows: 3 };

const id = () => crypto.randomUUID();
export const newPage = (): Page => ({ id: id(), items: [] });

export const itemAt = (page: Page | undefined, cell: Cell) =>
  page?.items.find((item) => item.column === cell.column && item.row === cell.row);

export function firstFree(page: Page, size: GridSize): Cell | undefined {
  for (let row = 0; row < size.rows; row++) for (let column = 0; column < size.columns; column++) {
    if (!itemAt(page, { column, row })) return { column, row };
  }
  return undefined;
}

export function locate(root: Page[], itemId: string): Location | undefined {
  for (const [index, page] of root.entries()) for (const item of page.items) {
    if (item.id === itemId) return { grid: root, page: index, item };
    if (item.kind !== 'folder') continue;
    for (const [childIndex, childPage] of item.pages.entries()) {
      const child = childPage.items.find((candidate) => candidate.id === itemId);
      if (child) return { grid: item.pages, page: childIndex, item: child, folder: item };
    }
  }
  return undefined;
}

export function place(grid: Page[], item: GridItem, size: GridSize, preferredPage = 0, maxPages = Infinity) {
  for (const index of grid.map((_, offset) => (offset + preferredPage) % grid.length)) {
    const cell = firstFree(grid[index], size);
    if (cell) { Object.assign(item, cell); grid[index].items.push(item); return index; }
  }
  if (grid.length >= maxPages) return -1;
  grid.push(newPage());
  Object.assign(item, { column: 0, row: 0 });
  grid[grid.length - 1].items.push(item);
  return grid.length - 1;
}

function detach(location: Location) {
  const page = location.grid[location.page];
  page.items = page.items.filter((candidate) => candidate !== location.item);
}

export function tidy(root: Page[]) {
  for (const page of root) {
    page.items = page.items.flatMap((item): GridItem[] => {
      if (item.kind !== 'folder') return [item];
      const children = item.pages.flatMap((child) => child.items);
      if (children.length < 2) return children.map((child) => Object.assign(child, { column: item.column, row: item.row }));
      while (item.pages.length > 1 && !item.pages[item.pages.length - 1].items.length) item.pages.pop();
      return [item];
    });
  }
}

export function drop(root: Page[], source: GridItem, target: DropTarget, folderLabel: string): boolean {
  const from = locate(root, source.id);
  const page = target.grid[target.page];
  if (!page || (target.folder && source.kind === 'folder')) return false;
  const occupant = itemAt(page, target.cell);
  if (occupant === source) return false;

  if (occupant && !target.folder && source.kind === 'app' && occupant.kind === 'folder') {
    if (from) detach(from);
    place(occupant.pages, source, FOLDER_SIZE);
  } else if (occupant && !target.folder && source.kind === 'app' && occupant.kind === 'app') {
    if (from) detach(from);
    const folder: Folder = { id: id(), kind: 'folder', label: folderLabel, ...target.cell, pages: [newPage()] };
    folder.pages[0].items.push({ ...occupant, column: 0, row: 0 }, Object.assign(source, { column: 1, row: 0 }));
    page.items = page.items.filter((item) => item !== occupant).concat(folder);
  } else if (occupant) {
    if (from?.grid === target.grid) {
      detach(from);
      Object.assign(occupant, { column: from.item.column, row: from.item.row });
      if (from.page !== target.page) {
        page.items = page.items.filter((item) => item !== occupant);
        target.grid[from.page].items.push(occupant);
      }
    } else {
      const free = firstFree(page, target.size);
      if (!free) return false;
      if (from) detach(from);
      Object.assign(occupant, free);
    }
    page.items.push(Object.assign(source, target.cell));
  } else {
    if (from) detach(from);
    page.items.push(Object.assign(source, target.cell));
  }
  tidy(root);
  return true;
}
