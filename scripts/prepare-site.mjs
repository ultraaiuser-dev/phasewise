import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = path.join(root, 'packages', 'client', 'dist');
const target = path.join(root, 'dist');

if (!existsSync(path.join(source, 'index.html'))) {
  throw new Error('Build packages/client before preparing the Site.');
}

// The Site publishes top-level dist. Copy its contents, never the dist directory itself.
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const entry of readdirSync(source)) {
  cpSync(path.join(source, entry), path.join(target, entry), { recursive: true });
}

console.log(`Prepared Site assets in ${target}`);
