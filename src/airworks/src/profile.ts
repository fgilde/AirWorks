import type { Settings } from './apps/settings';
import type { ProfileStore } from './types';
import { readJson, writeJson } from './util';
import type { Zone } from './windows';
import type { WorkspaceState } from './workspace';

export type SavedWindow = { appId: string; x: number; y: number; width: number; height: number; maximized: boolean; snap?: Zone; linkId?: string; intent?: Record<string, string> };

export type Profile = { settings?: Partial<Settings>; workspace?: WorkspaceState; windows?: SavedWindow[] };

export const localProfileStore = (): ProfileStore => ({
  load: async (key) => readJson(key),
  save: async (key, profile) => writeJson(key, profile),
});

export const httpProfileStore = (request: <T>(path: string, init?: RequestInit) => Promise<T>, path = '/profile'): ProfileStore => ({
  load: (key) => request(`${path}?key=${encodeURIComponent(key)}`).then((profile) => profile || undefined),
  save: (key, profile) => request<void>(`${path}?key=${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(profile) }),
});
