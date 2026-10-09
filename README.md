<p align="center"><img src="src/airworks/public/icons/logo-air.png" width="72" style="background:#35496b;padding:12px" alt="AirWorks logo"></p>

# AirWorks

A framework-free web desktop and micro-frontend shell: windows, taskbar with previews, several webtops, folders, drag and drop, search, pop-outs, login, roles and permissions. You register apps.

- **Documentation:** [English](https://fgilde.github.io/AirWorks/) · [Deutsch](https://fgilde.github.io/AirWorks/de.html)
- **Live demo (client only):** https://fgilde.github.io/AirWorks/webtop.html

## Use it

```bash
npm install github:fgilde/AirWorks
```

```ts
import { AirWorks } from '@fgilde/airworks';
import '@fgilde/airworks/style.css';

AirWorks.configure({ initialShortcuts: ['hello'] });
AirWorks.registerApp({ id: 'hello', title: 'Hello', icon: 'fn-dashboard.png', render: () => '<h1>Hello AirWorks</h1>' });
document.body.append(document.createElement('air-desktop'));
```

Or without installing anything:

```html
<link rel="stylesheet" href="https://fgilde.github.io/AirWorks/lib/airworks.css">
<script type="module">
  import { AirWorks } from 'https://fgilde.github.io/AirWorks/lib/airworks.js';
</script>
<air-desktop></air-desktop>
```

## Full-stack sample

`samples/AirWorks.Demo` runs AirWorks with .NET Aspire, Keycloak and a permission-checking ASP.NET Core API.

[![QuickRun](https://quickrun.org/badge.svg)](https://quickrun.org/run?repo=fgilde/AirWorks)

One click with [QuickRun](https://quickrun.org) clones, builds and starts it from `quickrun.yml`. Or by hand:

```bash
cd samples/AirWorks.Demo
dotnet run --project AirWorks.Demo.AppHost
```

Open http://localhost:5177 and sign in as `demo`/`demo` or `admin`/`admin` (local development credentials). Requires Docker.

## Develop

```bash
cd src/airworks
npm install
npm run dev            # docs on http://127.0.0.1:4173, demo on /webtop.html
npm run check          # grid model self-test
npm run build:package  # library into ../../package
```

| Path | Content |
| --- | --- |
| `src/airworks/src` | library |
| `src/airworks/src/demo` | client-only demo |
| `src/airworks/index.html`, `de.html` | documentation (EN/DE) |
| `samples/AirWorks.Demo` | Aspire + Keycloak + API sample |

MIT License
