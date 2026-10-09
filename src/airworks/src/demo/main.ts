import { AirWorks, localAuthProvider, localIdentityStore, MANAGE_IDENTITY, type AppDefinition } from '../index';
import { keyRatiosApp } from './key-ratios';
import './demo.css';

const base = import.meta.env.BASE_URL;
const rows = ['Total', 'Sales North', 'Sales South', 'Sales West', 'International', 'Service'];

const table = () => `<div class="function-toolbar"><button>New</button><button>Open</button><button>Save</button><button>Export</button></div>
  <table class="data-grid"><thead><tr><th>Area</th><th>Actual</th><th>Plan</th><th>Variance</th><th>Prior year</th></tr></thead><tbody>${rows.map((row, index) =>
    `<tr><td>${row}</td><td>${(1284 - index * 97).toLocaleString()}</td><td>${(1200 - index * 82).toLocaleString()}</td><td class="${index % 3 === 1 ? 'negative' : 'positive'}">${index % 3 === 1 ? '−' : '+'}${(3.2 + index * 1.1).toFixed(1)} %</td><td>${(1160 - index * 79).toLocaleString()}</td></tr>`).join('')}</tbody></table>`;

const chart = () => `<div class="function-toolbar"><button>View</button><button>Period</button><button>Export</button></div>
  <div class="chart"><div class="chart-title">Business development</div><svg viewBox="0 0 600 260" preserveAspectRatio="none"><polyline points="0,210 55,180 110,195 165,128 220,145 275,92 330,118 385,64 440,80 495,35 550,55 600,20"/><line x1="0" y1="220" x2="600" y2="220"/></svg></div>`;

const dashboard = () => `<div class="dashboard-grid">
  <section><strong>Revenue</strong><span class="kpi">12.48 M</span><small>+7.4 % year over year</small></section>
  <section><strong>Result</strong><div class="donut"></div><small>84 % of plan</small></section>
  <section class="wide"><strong>Trend</strong><div class="bars">${[42, 65, 51, 78, 70, 88, 93, 81, 96, 90, 105, 112].map((height) => `<i style="height:${height}px"></i>`).join('')}</div></section></div>`;

const apps: AppDefinition[] = [
  { id: 'report', title: 'Report table', icon: 'fn-reporttable.png', accent: '#35496b', width: 930, height: 650, render: table },
  { id: 'analysis', title: 'Analysis', icon: 'fn-analysis.png', accent: '#00a4a6', width: 820, height: 590, render: chart },
  { id: 'planning', title: 'Planning', icon: 'fn-planning.png', accent: '#8d4085', width: 880, height: 620, render: table, requiredPermissions: ['planning.edit'] },
  { id: 'dashboard', title: 'Dashboard', icon: 'fn-dashboard.png', accent: '#d15c27', width: 900, height: 640, render: dashboard },
  keyRatiosApp((name) => `${base}icons/${name}`),
  { id: 'workflow', title: 'Workflow', icon: 'fn-workflow.png', accent: '#a2273b', width: 760, height: 520, render: table, requiredPermissions: ['workflow.use'] },
  {
    id: 'counter', title: 'Counter', icon: 'fn-abcAnalysis.png', accent: '#00777a', width: 420, height: 300,
    render: ({ host, setTitle }) => {
      let count = 0;
      host.innerHTML = '<div class="demo-counter"><output>0</output><button>+1</button></div>';
      host.querySelector('button')!.addEventListener('click', () => {
        host.querySelector('output')!.textContent = String(++count);
        setTitle(`Counter (${count})`);
      });
    },
  },
];

const identity = localIdentityStore({
  roles: [
    { id: 'user', title: 'User', permissions: ['planning.edit'] },
    { id: 'admin', title: 'Administrator', permissions: ['planning.edit', 'workflow.use', MANAGE_IDENTITY] },
  ],
  users: [
    { id: 'demo', userName: 'demo', displayName: 'Demo User', roles: ['user'] },
    { id: 'admin', userName: 'admin', displayName: 'Demo Admin', email: 'admin@example.com', roles: ['admin'] },
  ],
}, 'airworks.demo.identity');

AirWorks.configure({
  assetBase: `${base}icons/`,
  docsUrl: base,
  identityStore: identity,
  initialShortcuts: ['report', 'analysis', 'planning', 'dashboard', 'key-ratios', 'counter'],
  initialApps: ['report', 'dashboard'],
});
AirWorks.registerPermissions([
  { id: 'planning.edit', title: 'Edit planning', group: 'Planning' },
  { id: 'workflow.use', title: 'Use workflows', group: 'Workflow' },
]);
AirWorks.registerApps(apps);
AirWorks.registerAuthProvider(localAuthProvider(identity, { title: 'Demo users (demo / admin)' }));
void AirWorks.loadRemote(`${base}remote/manifest.json`);
