import assert from 'node:assert/strict';
import { drop, locate, newPage, ROOT_SIZE, FOLDER_SIZE, type Page, type Shortcut, type Folder } from './grid.ts';

const app = (id: string, column: number, row = 0): Shortcut => ({ id, kind: 'app', label: id, appId: id, column, row });
const root: Page[] = [{ id: 'p0', items: [app('a', 0), app('b', 1)] }, newPage()];
const at = (page = 0, merge = false) => ({ grid: root, page, size: ROOT_SIZE, merge });
const cells = (...ids: string[]) => ids.map((id) => { const { item } = locate(root, id)!; return `${item.column},${item.row}`; });

assert.ok(drop(root, locate(root, 'a')!.item, { ...at(), cell: { column: 3, row: 2 } }, 'F'));
assert.deepEqual(cells('a'), ['3,2']);

assert.ok(drop(root, locate(root, 'a')!.item, { ...at(0, true), cell: { column: 1, row: 0 } }, 'F'));
const folder = root[0].items.find((item) => item.kind === 'folder') as Folder;
assert.equal(folder.column, 1);
assert.deepEqual(folder.pages[0].items.map((item) => item.id), ['b', 'a']);

assert.ok(drop(root, app('c', 0), { ...at(0, true), cell: { column: 1, row: 0 } }, 'F'));
assert.equal(locate(root, 'c')!.folder, folder);

const inFolder = { grid: folder.pages, page: 0, size: FOLDER_SIZE, folder };
assert.ok(drop(root, locate(root, 'c')!.item, { ...inFolder, cell: { column: 0, row: 0 } }, 'F'));
assert.deepEqual(cells('c', 'b', 'a'), ['0,0', '1,0', '2,0']);

assert.equal(drop(root, folder, { ...inFolder, cell: { column: 3, row: 2 } }, 'F'), false);

assert.ok(drop(root, locate(root, 'a')!.item, { ...at(1), cell: { column: 0, row: 1 } }, 'F'));
assert.ok(drop(root, locate(root, 'b')!.item, { ...at(1), cell: { column: 1, row: 1 } }, 'F'));
assert.equal(root[0].items.some((item) => item.kind === 'folder'), false);
assert.deepEqual([locate(root, 'c')!.page, ...cells('c')], [0, '1,0']);

root[0].items.push(app('d', 0), app('e', 2));
assert.ok(drop(root, app('n', 0), { ...at(), cell: { column: 1, row: 0 } }, 'F'));
assert.deepEqual(cells('d', 'n', 'c', 'e'), ['0,0', '1,0', '2,0', '3,0']);

assert.ok(drop(root, locate(root, 'e')!.item, { ...at(), cell: { column: 0, row: 0 } }, 'F'));
assert.deepEqual(cells('e', 'd', 'n', 'c'), ['0,0', '1,0', '2,0', '3,0']);

const full: Page[] = [{ id: 'full', items: Array.from({ length: 15 }, (_, index) => app(`f${index}`, index % 5, Math.floor(index / 5))) }];
assert.ok(drop(full, full[0].items[14], { grid: full, page: 0, size: ROOT_SIZE, cell: { column: 0, row: 0 } }, 'F'));
assert.deepEqual(full[0].items.map((item) => item.id).sort((x, y) => { const a = full[0].items.find((i) => i.id === x)!; const b = full[0].items.find((i) => i.id === y)!; return a.row * 5 + a.column - (b.row * 5 + b.column); }).slice(0, 3), ['f14', 'f0', 'f1']);

console.log('grid check passed');
