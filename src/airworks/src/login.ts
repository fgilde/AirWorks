import { label, t } from './i18n';
import { runtime } from './runtime';
import type { AuthProvider } from './types';
import { esc } from './util';

export type LoginHost = {
  brand(): { title: string; logo: string };
  guestAllowed(): boolean;
  target(): HTMLElement;
  closed(): void;
};

export class LoginView {
  private card = document.createElement('div');

  constructor(private readonly view: HTMLElement, private readonly host: LoginHost) {
    this.card.className = 'login-card';
    view.append(this.card);
  }

  get visible() { return this.view.classList.contains('visible'); }

  show(busy = false) {
    this.render(busy);
    this.card.removeAttribute('style');
    this.card.classList.remove('flying', 'closing');
    this.view.classList.remove('closing');
    this.view.classList.add('visible');
    this.view.ariaHidden = 'false';
    requestAnimationFrame(() => this.card.classList.add('shown'));
    if (!busy) requestAnimationFrame(() => this.card.querySelector<HTMLElement>('input, .login-provider')?.focus());
  }

  hide() {
    this.view.classList.remove('visible', 'closing');
    this.view.ariaHidden = 'true';
    this.card.classList.remove('shown', 'flying', 'closing');
    this.card.removeAttribute('style');
  }

  close() {
    if (!this.visible) return;
    const from = this.card.getBoundingClientRect();
    const to = this.host.target().getBoundingClientRect();
    Object.assign(this.card.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    this.card.classList.add('flying');
    void this.card.offsetWidth;
    this.card.classList.add('closing');
    this.view.classList.add('closing');
    Object.assign(this.card.style, { left: `${to.left + to.width / 2 - 15.5}px`, top: `${to.top + to.height / 2 - 15.5}px`, width: '31px', height: '31px' });
    setTimeout(() => { this.hide(); this.host.closed(); }, 1000);
  }

  render(busy = false) {
    const brand = this.host.brand();
    const providers = [...runtime.access.providers.values()];
    this.card.innerHTML = `<header><span class="login-logo" style="--logo:url('${esc(brand.logo)}')"></span><strong>${esc(brand.title)}</strong></header>
      ${busy ? '<div class="login-busy"></div>' : providers.map((provider) => this.provider(provider)).join('')}
      <p class="login-error" role="alert"></p>
      ${!busy && this.host.guestAllowed() ? `<button class="login-guest">${t('continueAsGuest')}</button>` : ''}`;
    this.card.querySelectorAll<HTMLElement>('.login-provider').forEach((button) => button.addEventListener('click', () => this.login(button.dataset.provider!)));
    this.card.querySelectorAll<HTMLFormElement>('.login-form').forEach((form) => form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.login(form.dataset.provider!, Object.fromEntries(new FormData(form)));
    }));
    this.card.querySelector('.login-guest')?.addEventListener('click', () => this.hide());
  }

  private provider(provider: AuthProvider) {
    if (!provider.fields?.length) {
      return `<button class="login-provider" data-provider="${esc(provider.id)}">${provider.icon ? `<img src="${esc(runtime.asset(provider.icon))}" alt=""/>` : ''}${esc(t('signInWith', provider.title))}</button>`;
    }
    const last = provider.fields.length - 1;
    return `<form class="login-form" data-provider="${esc(provider.id)}">${runtime.access.providers.size > 1 ? `<small>${esc(provider.title)}</small>` : ''}
      ${provider.fields.map((field, index) => `<label class="login-field"><img src="${esc(runtime.asset(field.type === 'password' ? 'login-password.png' : 'login-user.png'))}" alt=""/>
        <input name="${esc(field.name)}" type="${esc(field.type ?? 'text')}" placeholder="${esc(label(field.label))}" aria-label="${esc(label(field.label))}" required/>
        ${index === last ? `<button type="submit" aria-label="${t('login')}"><img src="${esc(runtime.asset('login-arrow.png'))}" alt=""/></button>` : ''}</label>`).join('')}</form>`;
  }

  private async login(providerId: string, values?: unknown) {
    const error = this.card.querySelector('.login-error')!;
    error.textContent = '';
    this.card.classList.add('loading');
    try {
      const session = await runtime.access.login(providerId, values);
      if (session) this.close();
    } catch (failure) {
      error.textContent = t('loginFailed', failure instanceof Error ? failure.message : failure);
      this.card.classList.remove('shake');
      void this.card.offsetWidth;
      this.card.classList.add('shake');
    } finally {
      this.card.classList.remove('loading');
    }
  }
}
