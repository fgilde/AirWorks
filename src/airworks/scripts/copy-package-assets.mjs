import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const copy = async (from, to) => {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    await (entry.isDirectory() ? copy(source, target) : copyFile(source, target));
  }
};

await copy(resolve(import.meta.dirname, '../public/icons'), resolve(import.meta.dirname, '../../../package/icons'));
