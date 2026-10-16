export const uid = () => crypto.randomUUID();

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);

/** The count or mark of an app on its tiles and task buttons, e.g. 3 unread items. */
export const badgeHtml = (value?: string) => value ? `<span class="aw-badge">${esc(value)}</span>` : '';

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : undefined;
  } catch { return undefined; }
}

export function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}
