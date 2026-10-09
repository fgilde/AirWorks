import { AirWorks, createOidcProvider, httpIdentityStore, httpProfileStore, type AccessSnapshot, type OidcOptions } from '@fgilde/airworks';
import './styles.css';

type RuntimeConfig = { apiBaseUrl: string; providers: OidcOptions[] };
const config = await fetch('/airworks-config').then((response) => response.json()) as RuntimeConfig;

AirWorks.configure({
  assetBase: '/icons/',
  serverBaseUrl: config.apiBaseUrl,
  accessProvider: () => AirWorks.request<AccessSnapshot>('/me'),
  identityStore: httpIdentityStore(AirWorks.request, '/identity'),
  profileStore: httpProfileStore(AirWorks.request, '/profile'),
  brand: { title: 'AirWorks Demo' },
  loginHint: 'Keycloak users: admin / admin (administrator) or demo / demo (user).',
  initialShortcuts: ['secure-reports', 'notes', 'airworks.identity'],
  initialApps: ['secure-reports'],
});

for (const provider of config.providers) AirWorks.registerAuthProvider(createOidcProvider({ ...provider, extraParams: provider.extraParams ?? undefined }));

AirWorks.registerPermission({ id: 'notes.use', title: 'Use notes', group: 'Notes' });

AirWorks.registerSearchProvider({
  id: 'server',
  search: (query, { request, signal }) => request(`/search?q=${encodeURIComponent(query)}`, { signal }),
});

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

AirWorks.registerApps([
  {
    id: 'secure-reports', title: 'Secure reports', icon: 'fn-reporttable.png', accent: '#167d79', width: 840, height: 560,
    requiredPermissions: ['reports.read'],
    async render({ host, request, can, intent, onIntent }) {
      host.innerHTML = '<section class="secure-sample"><h2>Protected report</h2><p>Loading from the API…</p></section>';
      try {
        const rows = await request<Array<{ department: string; actual: number; plan: number }>>('/reports');
        host.innerHTML = `<section class="secure-sample"><h2>Protected report</h2>
          <p>Delivered by the .NET API after checking the <code>reports.read</code> permission.</p>
          <table><thead><tr><th>Department</th><th>Actual</th><th>Plan</th></tr></thead><tbody>${rows.map((row) => `<tr data-department="${escape(row.department)}"><td>${escape(row.department)}</td><td>${row.actual.toLocaleString()}</td><td>${row.plan.toLocaleString()}</td></tr>`).join('')}</tbody></table>
          <p>${can('reports.export') ? '<button>Export</button>' : '<small>Export requires <code>reports.export</code>.</small>'}</p></section>`;
        const highlight = (department?: string) => host.querySelectorAll<HTMLElement>('tr[data-department]').forEach((row) => row.classList.toggle('highlight', row.dataset.department === department));
        highlight(intent?.department);
        onIntent((next) => highlight(next.department));
      } catch (error) {
        host.innerHTML = `<section class="secure-sample"><p class="error">${escape(error)}</p></section>`;
      }
    },
  },
  {
    id: 'notes', title: 'Notes', icon: 'icon-edit.png', accent: '#8d4085', width: 520, height: 420,
    requiredPermissions: ['notes.use'],
    render: ({ host }) => {
      host.innerHTML = '<textarea class="notes" placeholder="Stored in this browser"></textarea>';
      const area = host.querySelector('textarea')!;
      area.value = localStorage.getItem('demo.notes') ?? '';
      area.addEventListener('input', () => localStorage.setItem('demo.notes', area.value));
    },
  },
]);

document.body.append(document.createElement('air-desktop'));
