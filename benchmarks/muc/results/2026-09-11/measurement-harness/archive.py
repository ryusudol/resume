#!/usr/bin/env python3
"""Preserve finished measurements and a runnable frozen fixture/build copy."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

directory = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--workspace', type=Path, default=directory.parents[1] / '.build/muc-benchmark')
parser.add_argument('--label', default='measured')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
workspace, output = args.workspace.resolve(), args.output.resolve()
if output.exists():
    raise SystemExit('Refusing to overwrite an evidence archive: ' + str(output))
raw = workspace / args.label
environment = json.loads((raw / 'environment.json').read_text())
expected = environment['runsPerVariantPerProfile'] * len(environment['profiles']) * 2
sessions = [p for p in raw.glob('*.json') if p.stem.endswith(('-baseline', '-current'))]
if len(sessions) != expected:
    raise SystemExit('Incomplete experiment: %s / %s sessions' % (len(sessions), expected))
for file in sessions:
    data = json.loads(file.read_text())
    if data['errors'] or data['measurements']['errors']:
        raise SystemExit('Browser errors in ' + file.name)
output.mkdir(parents=True)
shutil.copytree(raw, output / 'raw')
for name in ['manifest.json', 'existing-frontend-changes.patch']:
    shutil.copy2(workspace / name, output / name)
runtime = output / 'frozen-runtime'
runtime.mkdir()
shutil.copy2(workspace / 'manifest.json', runtime / 'manifest.json')
shutil.copytree(workspace / 'fixtures', runtime / 'fixtures')
for variant in ['baseline', 'current']:
    dest = runtime / variant / 'frontend'
    dest.mkdir(parents=True)
    shutil.copytree(workspace / variant / 'frontend/build', dest / 'build')
    for name in ['package.json', 'pnpm-lock.yaml']:
        shutil.copy2(workspace / variant / 'frontend' / name, dest / name)
harness = output / 'measurement-harness'
harness.mkdir()
for file in directory.iterdir():
    if file.is_file() and file.suffix in ['.mjs', '.py', '.json', '.md']:
        shutil.copy2(file, harness / file.name)
source = Path(json.loads((workspace / 'manifest.json').read_text())['source'])
frontend_dependencies = {}
package = json.loads((source / 'frontend/package.json').read_text())
for dep in package.get('dependencies', {}):
    dep_file = source / 'frontend/node_modules' / dep / 'package.json'
    if dep_file.exists():
        installed = json.loads(dep_file.read_text())
        frontend_dependencies[dep] = installed.get('version')
(output / 'installed-frontend-dependencies.json').write_text(json.dumps(frontend_dependencies, indent=2) + '\n')
hashes = {}
for file in sorted(output.rglob('*')):
    if file.is_file():
        hashes[str(file.relative_to(output))] = hashlib.sha256(file.read_bytes()).hexdigest()
(output / 'evidence-sha256.json').write_text(json.dumps(hashes, indent=2) + '\n')
print(json.dumps({'output': str(output), 'sessions': len(sessions), 'files': len(hashes)}))
