import assert from 'node:assert/strict';
import { drop, locate, newPage, ROOT_SIZE, FOLDER_SIZE, type Page, type Shortcut, type Folder } from './grid.ts';

const app = (id: string, column: number, row = 0): Shortcut => ({ id, kind: 'app', label: id, appId: id, column, row });
const root: Page[] = [{ id: 'p0', items: [app('a', 0), app('b', 1)] }, newPage()];
const at = (page = 0) => ({ grid: root, page, size: ROOT_SIZE });

assert.ok(drop(root, locate(root, 'a')!.item, { ...at(), cell: { column: 3, row: 2 } }, 'F'));
assert.deepEqual([locate(root, 'a')!.item.column, locate(root, 'a')!.item.row], [3, 2]);

assert.ok(drop(root, locate(root, 'a')!.item, { ...at(), cell: { column: 1, row: 0 } }, 'F'));
const folder = root[0].items.find((item) => item.kind === 'folder') as Folder;
assert.equal(folder.column, 1);
assert.deepEqual(folder.pages[0].items.map((item) => item.id), ['b', 'a']);

assert.ok(drop(root, app('c', 0), { ...at(), cell: { column: 1, row: 0 } }, 'F'));
assert.equal(locate(root, 'c')!.folder, folder);

const inFolder = { grid: folder.pages, page: 0, size: FOLDER_SIZE, folder };
assert.ok(drop(root, locate(root, 'c')!.item, { ...inFolder, cell: { column: 0, row: 0 } }, 'F'));
assert.deepEqual([locate(root, 'b')!.item.column, locate(root, 'c')!.item.column], [2, 0]);

assert.equal(drop(root, folder, { ...inFolder, cell: { column: 3, row: 2 } }, 'F'), false);

assert.ok(drop(root, locate(root, 'a')!.item, { ...at(1), cell: { column: 0, row: 1 } }, 'F'));
assert.equal(locate(root, 'c')!.folder, folder);
assert.ok(drop(root, locate(root, 'b')!.item, { ...at(1), cell: { column: 1, row: 1 } }, 'F'));
assert.equal(root[0].items.some((item) => item.kind === 'folder'), false);
assert.deepEqual([locate(root, 'c')!.page, locate(root, 'c')!.item.column, locate(root, 'c')!.item.row], [0, 1, 0]);

root[0].items.push({ id: 'd', kind: 'folder', label: 'd', column: 4, row: 2, pages: [{ id: 'x', items: [app('e', 0), app('f', 1)] }] });
assert.ok(drop(root, locate(root, 'd')!.item, { ...at(1), cell: { column: 0, row: 1 } }, 'F'));
assert.equal(locate(root, 'a')!.page, 0);
assert.equal(locate(root, 'd')!.page, 1);

console.log('grid check passed');
