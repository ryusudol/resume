import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(process.env.MUC_BENCH_WORKSPACE || path.join(dir, '../../.build/muc-benchmark'));
for (const variant of ['baseline', 'current']) {
  const cwd = path.join(workspace, variant, 'frontend');
  const result = spawnSync(process.execPath, ['node_modules/react-scripts/scripts/build.js'], {
    cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, DISABLE_ESLINT_PLUGIN: 'true', GENERATE_SOURCEMAP: 'false' },
  });
  const log = (result.stdout || '') + (result.stderr || '');
  fs.writeFileSync(path.join(workspace, variant + '-build.log'), log);
  process.stdout.write(variant + ': ' + log);
  if (result.status !== 0) process.exit(result.status || 1);
}
