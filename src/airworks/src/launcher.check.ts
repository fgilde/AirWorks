import assert from 'node:assert/strict';
import { groupApps, matchApps, menuStep, step, trapTab } from './launcher.ts';

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

// groups keep the order of the first app per group, the ungrouped apps lead; search also matches the group
assert.deepEqual(groupApps([{ title: 'A', group: 'People' }, { title: 'B', group: 'Administration' }, { title: 'C', group: 'People' }, { title: 'D' }]).map(([group, list]) => [group, list.map((app) => app.title).join('')]),
  [['', 'D'], ['People', 'AC'], ['Administration', 'B']]);
assert.deepEqual(groupApps(matchApps(apps, 'admin')).map(([group]) => group), ['Admin']);

// focus trap: Tab wraps at the edges, enters from outside, stays out of the way in between
assert.equal(trapTab(4, 3, false), 0);
assert.equal(trapTab(4, 0, true), 3);
assert.equal(trapTab(4, 1, false), undefined);
assert.equal(trapTab(4, -1, false), 0);
assert.equal(trapTab(4, -1, true), 3);
assert.equal(trapTab(0, -1, false), undefined);

// icon context menu: arrows wrap, other keys are left alone
assert.equal(menuStep(2, 1, 'ArrowDown'), 0);
assert.equal(menuStep(2, 0, 'ArrowUp'), 1);
assert.equal(menuStep(2, 0, 'End'), 1);
assert.equal(menuStep(2, 1, 'Enter'), undefined);

console.log('launcher check passed');
