export type Launcher = 'menu' | 'overlay';

type Listed = { title: string; group?: string };
type Box = { left: number; top: number; width: number };

export function matchApps<T extends Listed>(apps: T[], query: string): T[] {
  const text = query.trim().toLowerCase();
  return text ? apps.filter((app) => app.title.toLowerCase().includes(text) || app.group?.toLowerCase().includes(text)) : apps;
}

/** Apps by group in first-seen order; apps without a group come first under no heading (''). */
export function groupApps<T extends Listed>(apps: T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  apps.forEach((app) => groups.set(app.group ?? '', [...groups.get(app.group ?? '') ?? [], app]));
  return [...groups].sort(([a], [b]) => Number(Boolean(a)) - Number(Boolean(b)));
}

/** Index the arrow key moves to in a wrapped grid of tiles; -1 means above the first row (the search box). */
export function step(boxes: Box[], from: number, key: string): number {
  if (key === 'ArrowLeft') return Math.max(0, from - 1);
  if (key === 'ArrowRight') return Math.min(boxes.length - 1, from + 1);
  if (key === 'Home') return 0;
  if (key === 'End') return boxes.length - 1;
  const current = boxes[from];
  const down = key === 'ArrowDown';
  const rows = boxes.map((box) => box.top).filter((top) => down ? top > current.top + 1 : top < current.top - 1);
  if (!rows.length) return down ? from : -1;
  const row = down ? Math.min(...rows) : Math.max(...rows);
  const center = (box: Box) => box.left + box.width / 2;
  let best = from;
  let distance = Infinity;
  boxes.forEach((box, index) => {
    const gap = Math.abs(center(box) - center(current));
    if (Math.abs(box.top - row) <= 1 && gap < distance) { best = index; distance = gap; }
  });
  return best;
}
