import { getLocale, t, type MessageKey } from '../i18n';
import type { AppDefinition, AccessSnapshot } from '../types';
import { esc } from '../util';

export type TaskbarSide = 'top' | 'right' | 'bottom' | 'left';
import { effects, type Effect } from '../effects';
import type { WallpaperOption } from '../types';

export type { Effect };

export type Settings = {
  askBeforeClose: boolean;
  startMaximized: boolean;
  instantPreview: boolean;
  overwriteName: boolean;
  restoreWindows: boolean;
  hideTaskbar: boolean;
  taskbarPosition: TaskbarSide;
  wallpaper: string;
  customWallpaper?: string;
  effect: Effect;
  systemColor?: string;
  locale?: string;
};

export const defaultSettings: Settings = {
  askBeforeClose: false, startMaximized: false, instantPreview: true, overwriteName: false, restoreWindows: true,
  hideTaskbar: false, taskbarPosition: 'top', wallpaper: 'blue', effect: 'none',
};

export type Wallpaper = { id: string; title: string; background: (asset: (name: string) => string) => string; foreground: string };

export const wallpapers: Wallpaper[] = [
  { id: 'default', title: 'Blue gradient', background: () => 'linear-gradient(to left, #0f3663, #1f66b7)', foreground: '#ffffff' },
  { id: 'green-simple', title: 'Green gradient', background: () => 'linear-gradient(to left, #447d1c, #66bc29)', foreground: '#ffffff' },
  { id: 'dark', title: 'Dark', background: () => '#222222', foreground: '#ffffff' },
  { id: 'simple-light', title: 'Light gradient', background: () => 'linear-gradient(to left, #8e9eab, #eef2f3)', foreground: '#000000' },
  { id: 'gray', title: 'Gray', background: () => '#888888', foreground: '#ffffff' },
  { id: 'black', title: 'Black', background: () => '#000000', foreground: '#ffffff' },
  { id: 'white', title: 'White', background: () => '#ffffff', foreground: '#000000' },
  ...['blue', 'light', 'lightblue', 'lightgreen', 'green'].map((id): Wallpaper => ({
    id, title: id.replace('light', 'light ').replace(/^./, (char) => char.toUpperCase()),
    background: (asset) => `url('${asset(`wallpaper/${id}.jpg`)}') center / cover`, foreground: '#000000',
  })),
];

const systemColors = [['#35496b', 'Blue'], ['#447d1c', 'Green'], ['#8d4085', 'Violet'], ['#555b66', 'Graphite'], ['#a2273b', 'Red'], ['#00777a', 'Teal']];
const sides: Array<[TaskbarSide, MessageKey]> = [['top', 'top'], ['right', 'right'], ['bottom', 'bottom'], ['left', 'left']];

export const wallpaperOf = (option: WallpaperOption): Wallpaper => ({
  id: option.id,
  title: option.title,
  foreground: option.foreground ?? '#ffffff',
  background: (asset) => option.background ?? `url('${asset(option.image ?? '')}') center / cover`,
});

export type SettingsHost = {
  settings(): Settings;
  update(patch: Partial<Settings>): void;
  asset(name: string): string;
  access(): AccessSnapshot;
  brand(): { title: string; logo: string; description?: string; version?: string };
  wallpapers(): Wallpaper[];
  docsUrl(): string | undefined;
  openDocs(): void;
  version: string;
};

type Section = 'common' | 'user' | 'webtop' | 'taskbar' | 'colors' | 'about';

export function createSettingsApp(host: SettingsHost): AppDefinition & { show(section: Section): void } {
  let section: Section = 'common';
  let current: HTMLElement | undefined;

  const checkbox = (key: keyof Settings, label: MessageKey) =>
    `<label><span>${t(label)}</span><input type="checkbox" data-setting="${key}" ${host.settings()[key] ? 'checked' : ''}/></label>`;

  const body = (): string => {
    const settings = host.settings();
    const access = host.access();
    switch (section) {
      case 'common': return `<h3>${t('general')}</h3>${checkbox('askBeforeClose', 'askBeforeClose')}${checkbox('startMaximized', 'startMaximized')}${checkbox('instantPreview', 'instantPreview')}${checkbox('overwriteName', 'overwriteName')}${checkbox('restoreWindows', 'restoreWindows')}
        <label><span>${t('language')}</span><select data-locale><option value="en" ${getLocale() === 'en' ? 'selected' : ''}>English</option><option value="de" ${getLocale() === 'de' ? 'selected' : ''}>Deutsch</option></select></label>`;
      case 'user': return `<h3>${t('user')}</h3>
        <label><span>${t('displayName')}</span><input value="${esc(access.identity?.displayName ?? t('guest'))}" disabled /></label>
        <label><span>${t('account')}</span><input value="${esc(access.identity?.id ?? '—')}" disabled /></label>
        <label><span>${t('email')}</span><input value="${esc(access.identity?.email ?? '')}" disabled /></label>
        <label><span>${t('roles')}</span><span class="settings-tags">${access.roles.map((role) => `<i>${esc(role)}</i>`).join('') || '—'}</span></label>
        <label><span>${t('permissions')}</span><span class="settings-tags">${access.permissions.map((permission) => `<i>${esc(permission)}</i>`).join('') || '—'}</span></label>`;
      case 'webtop': return `<h3>${t('webtop')}</h3><strong class="settings-label">${t('background')}</strong>
        <div class="wallpaper-selector">${host.wallpapers().map((wallpaper) => `<button data-wallpaper="${wallpaper.id}" class="wallpaper-option ${settings.wallpaper === wallpaper.id && !settings.customWallpaper ? 'selected' : ''}" style="background:${esc(wallpaper.background(host.asset))}"><span>${esc(wallpaper.title)}</span></button>`).join('')}
        <label class="wallpaper-upload ${settings.customWallpaper ? 'selected' : ''}"><input type="file" accept="image/*"/><span>${t('customImage')}</span></label></div>
        <strong class="settings-label">${t('effect')}</strong>
        <div class="effect-selector">${effects.map((id) => `<button data-effect="${id}" class="effect-option ${settings.effect === id ? 'selected' : ''}"><span>${t(`effect_${id}`)}</span></button>`).join('')}</div>`;
      case 'taskbar': return `<h3>${t('taskbar')}</h3><p class="settings-hint">${t('taskbarHint')}</p>
        <div class="taskbar-position-selector">${sides.map(([id, label]) => `<button data-taskbar-position="${id}" class="${settings.taskbarPosition === id ? 'selected' : ''}"><span class="taskbar-diagram ${id}"></span><strong>${t(label)}</strong></button>`).join('')}</div>
        ${checkbox('hideTaskbar', 'hideTaskbar')}${checkbox('instantPreview', 'instantPreview')}`;
      case 'colors': return `<h3>${t('colors')}</h3><strong class="settings-label">${t('appColors')}</strong>
        <div class="color-selector">${systemColors.map(([color, title]) => `<button data-system-color="${color}" class="${(settings.systemColor ?? '#35496b') === color ? 'selected' : ''}" style="background:${color}">${title}</button>`).join('')}
        <label class="custom-color ${systemColors.some(([color]) => color === (settings.systemColor ?? '#35496b')) ? '' : 'selected'}" style="background:${esc(settings.systemColor ?? '#35496b')}"><input type="color" value="${esc(settings.systemColor ?? '#35496b')}" /><span>${t('customColor')}</span></label></div>`;
      case 'about': {
        const brand = host.brand();
        const docs = host.docsUrl();
        return `<div class="help-content"><img src="${esc(brand.logo)}" alt=""/><h3>${esc(brand.title)}</h3><p>${esc(brand.description ?? t('aboutText'))}</p><p>${t('version', brand.version ?? host.version)}</p>${docs ? `<button class="docs-link" data-docs>${t('openDocs')}</button>` : ''}</div>`;
      }
    }
  };

  const render = (root: HTMLElement) => {
    const nav: Array<[Section, string, MessageKey]> = [['common', 'fn-preferences.png', 'general'], ['user', 'login-user.png', 'user'], ['webtop', 'icon-desktop.png', 'webtop'], ['taskbar', 'pilot2.png', 'taskbar'], ['colors', 'icon-palette.png', 'colors'], ['about', 'startmenu-about.png', 'about']];
    root.innerHTML = `<div class="settings settings-app"><nav>${nav.map(([id, icon, title]) => `<button data-section="${id}" class="${section === id ? 'selected' : ''}"><img src="${esc(host.asset(icon))}" alt=""/><span>${t(title)}</span></button>`).join('')}</nav><section>${body()}</section></div>`;
    const on = (selector: string, event: string, handler: (element: HTMLElement) => void) =>
      root.querySelectorAll<HTMLElement>(selector).forEach((element) => element.addEventListener(event, () => handler(element)));
    const apply = (patch: Partial<Settings>) => { host.update(patch); render(root); };
    on('[data-docs]', 'click', () => host.openDocs());
    on('[data-section]', 'click', (element) => { section = element.dataset.section as Section; render(root); });
    on('[data-setting]', 'change', (element) => apply({ [element.dataset.setting!]: (element as HTMLInputElement).checked }));
    on('[data-locale]', 'change', (element) => apply({ locale: (element as HTMLSelectElement).value }));
    on('[data-wallpaper]', 'click', (element) => apply({ wallpaper: element.dataset.wallpaper!, customWallpaper: undefined }));
    on('[data-effect]', 'click', (element) => apply({ effect: element.dataset.effect as Effect }));
    on('[data-taskbar-position]', 'click', (element) => apply({ taskbarPosition: element.dataset.taskbarPosition as TaskbarSide }));
    on('[data-system-color]', 'click', (element) => apply({ systemColor: element.dataset.systemColor }));
    on('.custom-color input', 'input', (element) => host.update({ systemColor: (element as HTMLInputElement).value }));
    on('.custom-color input', 'change', () => render(root));
    on('.wallpaper-upload input', 'change', (element) => {
      const file = (element as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => apply({ customWallpaper: String(reader.result) });
      reader.readAsDataURL(file);
    });
  };

  return {
    id: 'airworks.settings',
    title: t('settings'),
    icon: 'fn-preferences.png',
    width: 760,
    height: 470,
    hidden: true,
    render: ({ host: root, onClose }) => { current = root; onClose(() => { current = undefined; }); render(root); },
    show(next: Section) { section = next; if (current) render(current); },
  };
}
