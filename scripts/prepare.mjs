import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync(new URL('../package/airworks.js', import.meta.url))) {
  const run = (command) => execSync(command, { stdio: 'inherit', cwd: new URL('../src/airworks/', import.meta.url) });
  run('npm ci --no-audit --no-fund');
  run('npm run build:package');
}
