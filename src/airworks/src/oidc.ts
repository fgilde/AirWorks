import type { AuthProvider, Session } from './types';

export type OidcOptions = {
  id: string;
  title: string;
  icon?: string;
  authority: string;
  clientId: string;
  scope?: string;
  redirectUri?: string;
  postLogoutRedirectUri?: string;
  extraParams?: Record<string, string>;
  roleClaims?: string[];
  mapSession?: (claims: Record<string, unknown>, tokens: TokenSet) => Session;
};

export type TokenSet = { access_token: string; id_token?: string; refresh_token?: string; expires_in?: number };

type Discovery = { authorization_endpoint: string; token_endpoint: string; end_session_endpoint?: string };
type Stored = { tokens: TokenSet; expiresAt: number };

const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));
const claimsOf = (jwt?: string): Record<string, unknown> => {
  try {
    const binary = atob(jwt!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))));
  } catch { return {}; }
};
const pick = (claims: Record<string, unknown>, path: string) =>
  path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], claims);

export function createOidcProvider(options: OidcOptions): AuthProvider {
  const storageKey = `airworks.oidc.${options.id}`;
  const pendingKey = `${storageKey}.pending`;
  const redirectUri = options.redirectUri ?? `${location.origin}${location.pathname}`;
  let discovery: Promise<Discovery> | undefined;
  const discover = () => discovery ??= fetch(`${options.authority.replace(/\/$/, '')}/.well-known/openid-configuration`).then((response) => {
    if (!response.ok) throw new Error(`OIDC discovery failed (${response.status})`);
    return response.json() as Promise<Discovery>;
  });

  const toSession = ({ tokens, expiresAt }: Stored): Session => {
    const claims = { ...claimsOf(tokens.access_token), ...claimsOf(tokens.id_token) };
    if (options.mapSession) return { expiresAt, ...options.mapSession(claims, tokens) };
    const roles = (options.roleClaims ?? ['realm_access.roles', 'roles', 'groups'])
      .flatMap((path) => { const value = pick(claims, path); return Array.isArray(value) ? value.map(String) : []; });
    return {
      token: tokens.access_token,
      expiresAt,
      identity: {
        id: String(claims.preferred_username ?? claims.sub ?? 'unknown'),
        displayName: String(claims.name ?? claims.preferred_username ?? claims.email ?? 'User'),
        email: claims.email as string | undefined,
      },
      roles: [...new Set(roles)],
    };
  };

  const tokenRequest = async (body: Record<string, string>, previousRefreshToken?: string) => {
    const { token_endpoint } = await discover();
    const response = await fetch(token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: options.clientId, ...body }) });
    if (!response.ok) throw new Error(`Token request failed (${response.status})`);
    const tokens = await response.json() as TokenSet;
    tokens.refresh_token ??= previousRefreshToken;
    const stored: Stored = { tokens, expiresAt: Date.now() + (tokens.expires_in ?? 300) * 1000 };
    sessionStorage.setItem(storageKey, JSON.stringify(stored));
    return stored;
  };

  return {
    id: options.id,
    title: options.title,
    icon: options.icon,
    async login() {
      const { authorization_endpoint } = await discover();
      const verifier = random();
      const state = random();
      const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      sessionStorage.setItem(pendingKey, JSON.stringify({ verifier, state }));
      const url = new URL(authorization_endpoint);
      Object.entries({
        client_id: options.clientId, response_type: 'code', scope: options.scope ?? 'openid profile email', redirect_uri: redirectUri,
        state, code_challenge: challenge, code_challenge_method: 'S256', ...options.extraParams,
      }).forEach(([key, value]) => url.searchParams.set(key, value));
      location.assign(url);
    },
    async restore() {
      const query = new URLSearchParams(location.search);
      const pending = JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null') as { verifier: string; state: string } | null;
      if (pending && query.get('code') && query.get('state') === pending.state) {
        sessionStorage.removeItem(pendingKey);
        const clean = new URL(location.href);
        ['code', 'state', 'session_state', 'iss'].forEach((key) => clean.searchParams.delete(key));
        history.replaceState(history.state, '', clean);
        return toSession(await tokenRequest({ grant_type: 'authorization_code', code: query.get('code')!, redirect_uri: redirectUri, code_verifier: pending.verifier }));
      }
      const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Stored | null;
      if (!stored) return undefined;
      if (stored.expiresAt - Date.now() > 60_000) return toSession(stored);
      if (!stored.tokens.refresh_token) { sessionStorage.removeItem(storageKey); return undefined; }
      try {
        const refreshToken = stored.tokens.refresh_token;
        return toSession(await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken }, refreshToken));
      } catch { sessionStorage.removeItem(storageKey); return undefined; }
    },
    async logout() {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Stored | null;
      sessionStorage.removeItem(storageKey);
      const { end_session_endpoint } = await discover();
      if (!end_session_endpoint) return;
      const url = new URL(end_session_endpoint);
      url.searchParams.set('client_id', options.clientId);
      url.searchParams.set('post_logout_redirect_uri', options.postLogoutRedirectUri ?? redirectUri);
      if (stored?.tokens.id_token) url.searchParams.set('id_token_hint', stored.tokens.id_token);
      location.assign(url);
    },
  };
}
