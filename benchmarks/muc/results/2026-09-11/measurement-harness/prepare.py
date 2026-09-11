#!/usr/bin/env python3
"""Snapshot both MUC frontends without changing the source checkout."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=ROOT.parent / 'projects/Machine-Unlearning-Comparator')
parser.add_argument('--output', type=Path, default=ROOT / '.build/muc-benchmark')
args = parser.parse_args()
source, output = args.source.resolve(), args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
git = lambda *a: subprocess.check_output(['git', '-C', str(source), *a])
head = git('rev-parse', 'HEAD').decode().strip()
manifest = {'source': str(source), 'head': head, 'variants': {}, 'data': {}}
patch = git('diff', '--binary', 'HEAD', '--', 'frontend')
(output / 'existing-frontend-changes.patch').write_bytes(patch)
for variant in ('baseline', 'current'):
    dest = output / variant
    if dest.exists():
        raise SystemExit('Snapshot exists; use a new --output directory: ' + str(dest))
    dest.mkdir()
    archive = git('archive', head, 'frontend')
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for member in tar.getmembers():
            resolved = (dest / member.name).resolve()
            if dest not in resolved.parents:
                raise ValueError('Invalid archive path')
        tar.extractall(dest)
    frontend = dest / 'frontend'
    if variant == 'current':
        for name in ('src', 'public'):
            shutil.rmtree(frontend / name)
            shutil.copytree(source / 'frontend' / name, frontend / name)
        for file in (source / 'frontend').iterdir():
            if file.is_file() and (file.suffix in ('.json', '.js', '.ts', '.yaml') or file.name == '.browserslistrc'):
                shutil.copy2(file, frontend / file.name)
    hashes = {}
    for file in sorted(frontend.rglob('*')):
        if file.is_file():
            hashes[str(file.relative_to(frontend))] = hashlib.sha256(file.read_bytes()).hexdigest()
    manifest['variants'][variant] = {'files': hashes, 'source_sha256': hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()}
    deps = frontend / 'node_modules'
    deps.mkdir()
    for dep in (source / 'frontend/node_modules').iterdir():
        if dep.name != '.cache':
            (deps / dep.name).symlink_to(dep.resolve(), target_is_directory=dep.is_dir())

fixtures = output / 'fixtures'
fixtures.mkdir()
for cls in ('0', '1'):
    target = fixtures / cls
    target.mkdir()
    for file in sorted((source / 'backend/data' / cls).glob('*.json')):
        shutil.copy2(file, target / file.name)
        data = json.loads(file.read_text())
        manifest['data'][cls + '/' + file.name] = {'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'points': len(data.get('points', [])), 'bytes': file.stat().st_size}
    image_file = source / 'backend/data/subset' / cls / (cls + '_base64.json')
    if image_file.exists():
        shutil.copy2(image_file, fixtures / (cls + '_images.json'))
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'output': str(output), 'head': head, 'data_files': len(manifest['data']), 'frontend_patch_bytes': len(patch)}))
