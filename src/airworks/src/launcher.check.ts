import assert from 'node:assert/strict';
import { groupApps, matchApps, step } from './launcher.ts';

const apps = [{ title: 'Orders', group: 'Sales' }, { title: 'Files' }, { title: 'Invoices', group: 'Sales' }, { title: 'Users', group: 'Admin' }];
assert.deepEqual(matchApps(apps, ' ord ').map((app) => app.title), ['Orders']);
assert.deepEqual(matchApps(apps, 'sales').map((app) => app.title), ['Orders', 'Invoices']);
assert.equal(matchApps(apps, '').length, 4);
assert.deepEqual(groupApps(apps).map(([group, list]) => [group, list.length]), [['', 1], ['Sales', 2], ['Admin', 1]]);

// 3 tiles per row, 7 tiles: rows at top 0, 100, 200 (the last row holds one tile)
const boxes = Array.from({ length: 7 }, (_, index) => ({ left: (index % 3) * 100, top: Math.floor(index / 3) * 100, width: 90 }));
assert.equal(step(boxes, 1, 'ArrowDown'), 4);
assert.equal(step(boxes, 5, 'ArrowDown'), 6);
assert.equal(step(boxes, 6, 'ArrowDown'), 6);
assert.equal(step(boxes, 6, 'ArrowUp'), 3);
assert.equal(step(boxes, 2, 'ArrowUp'), -1);
assert.equal(step(boxes, 0, 'ArrowLeft'), 0);
assert.equal(step(boxes, 6, 'ArrowRight'), 6);
assert.equal(step(boxes, 3, 'End'), 6);

console.log('launcher check passed');
