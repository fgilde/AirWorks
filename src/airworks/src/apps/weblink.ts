import { t } from '../i18n';
import type { AppContext, AppDefinition } from '../types';
import { esc } from '../util';

export const WEB_LINK = 'airworks.weblink';

export type WebLink = { label: string; url: string; accent: string; icon: string };

const palette = ['#35496b', '#00a4a6', '#537b35', '#8d4085', '#d15c27', '#a2273b', '#00777a', '#555b66'];

const normalize = (value: string) => {
  const text = value.trim();
  if (!text) return undefined;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url : undefined;
  } catch { return undefined; }
};

export const faviconOf = (url: string) => new URL('/favicon.ico', url).href;

export function createWebLinkApp(edit: (context: AppContext) => void): AppDefinition {
  return {
    id: WEB_LINK,
    title: t('webLink'),
    icon: 'fn-userweblink.png',
    accent: '#00777a',
    width: Math.round(innerWidth * .7),
    height: Math.round(innerHeight * .7),
    menu: [{ id: 'edit', title: t('editWebLink'), icon: 'icon-edit.png', run: edit }],
    render: ({ host, link }) => {
      const url = link?.data.url;
      if (!url) {
        host.innerHTML = `<p class="app-error">${t('webLinkMissing')}</p>`;
        return;
      }
      host.classList.add('frame', 'web-link');
      host.innerHTML = `<iframe class="app-frame" src="${esc(url)}" title="${esc(link.label)}" referrerpolicy="no-referrer"></iframe>
        <p class="web-link-hint">${t('embedHint')} <a href="${esc(url)}" target="_blank" rel="noopener">${t('openInBrowser')}</a></p>`;
    },
  };
}

export function editWebLink(root: HTMLElement, initial: Partial<WebLink>, asset: (name: string) => string): Promise<WebLink | undefined> {
  return new Promise((resolve) => {
    let accent = initial.accent ?? palette[0];
    let icon = initial.icon && !initial.icon.endsWith('/favicon.ico') ? initial.icon : undefined;
    const dialog = document.createElement('div');
    dialog.className = 'aw-dialog';
    dialog.innerHTML = `<form class="aw-dialog-card web-link-editor">
      <h2>${t(initial.url ? 'editWebLink' : 'webLink')}</h2>
      <label><span>${t('name')}</span><input name="label" value="${esc(initial.label ?? '')}" placeholder="${t('automatic')}" /></label>
      <label><span>${t('webAddress')}</span><input name="url" value="${esc(initial.url ?? '')}" placeholder="https://" required /></label>
      <div class="web-link-row"><span>${t('color')}</span><div class="web-link-palette">${palette.map((color) => `<button type="button" data-color="${color}" style="background:${color}"></button>`).join('')}<input type="color" aria-label="${t('color')}" /></div></div>
      <div class="web-link-row"><span>${t('icon')}</span><div class="web-link-icon"><span class="icon-tile"><img alt="" /></span><label class="web-link-upload">${t('chooseImage')}<input type="file" accept="image/*" /></label><button type="button" class="web-link-reset">${t('automatic')}</button></div></div>
      <footer><button type="button" data-cancel>${t('cancel')}</button><button type="submit">${t('ok')}</button></footer>
    </form>`;
    const form = dialog.querySelector('form')!;
    const urlInput = form.querySelector<HTMLInputElement>('[name=url]')!;
    const preview = form.querySelector<HTMLImageElement>('.web-link-icon img')!;
    const submit = form.querySelector<HTMLButtonElement>('[type=submit]')!;

    const update = () => {
      const url = normalize(urlInput.value);
      submit.disabled = !url;
      form.style.setProperty('--accent', accent);
      form.querySelector<HTMLInputElement>('[type=color]')!.value = accent;
      form.querySelectorAll<HTMLElement>('[data-color]').forEach((button) => button.classList.toggle('selected', button.dataset.color === accent));
      preview.src = icon ?? (url ? faviconOf(url.href) : asset('fn-userweblink.png'));
    };
    const close = (result?: WebLink) => {
      dialog.remove();
      window.removeEventListener('keydown', onKey, true);
      resolve(result);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
    };

    preview.addEventListener('error', () => { preview.src = asset('fn-userweblink.png'); });
    urlInput.addEventListener('input', update);
    form.querySelectorAll<HTMLElement>('[data-color]').forEach((button) => button.addEventListener('click', () => { accent = button.dataset.color!; update(); }));
    form.querySelector<HTMLInputElement>('[type=color]')!.addEventListener('input', (event) => { accent = (event.target as HTMLInputElement).value; update(); });
    form.querySelector('.web-link-reset')!.addEventListener('click', () => { icon = undefined; update(); });
    form.querySelector<HTMLInputElement>('[type=file]')!.addEventListener('change', (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { icon = String(reader.result); update(); };
      reader.readAsDataURL(file);
    });
    form.querySelector('[data-cancel]')!.addEventListener('click', () => close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const url = normalize(urlInput.value);
      if (!url) return;
      const label = form.querySelector<HTMLInputElement>('[name=label]')!.value.trim() || url.hostname.replace(/^www\./, '');
      close({ label, url: url.href, accent, icon: icon ?? faviconOf(url.href) });
    });
    window.addEventListener('keydown', onKey, true);
    root.append(dialog);
    update();
    requestAnimationFrame(() => (initial.url ? urlInput : form.querySelector<HTMLInputElement>('[name=label]')!).focus());
  });
}
