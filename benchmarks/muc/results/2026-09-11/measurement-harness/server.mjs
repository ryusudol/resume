import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };

export async function startServers(workspace) {
  const fixtures = path.join(workspace, 'fixtures');
  const servers = [];
  const stats = [];
  const cache = new Map();
  function send(req, res, content, type, status = 200, compress = true) {
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const key = req.headers.host + req.url;
    let body = raw;
    const headers = { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Timing-Allow-Origin': '*', 'Cache-Control': 'no-store' };
    if (compress && /gzip/.test(req.headers['accept-encoding'] || '')) {
      if (!cache.has(key)) cache.set(key, zlib.gzipSync(raw));
      body = cache.get(key);
      headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = body.length;
    stats.push({ url: req.url, host: req.headers.host, rawBytes: raw.length, bodyBytes: body.length, status, time: Date.now() });
    res.writeHead(status, headers); res.end(body);
  }
  async function listen(port, handler) {
    const server = http.createServer(handler);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    servers.push(server);
  }
  // Replay the checked-in JSON payloads; do not start training or load PyTorch.
  await listen(8000, (req, res) => {
    const parts = new URL(req.url, 'http://localhost').pathname.split('/').filter(Boolean);
    if (req.method !== 'GET') return send(req, res, '{}', 'application/json', 405, false);
    if (parts[0] === 'data' && /^\d$/.test(parts[1])) {
      const cls = parts[1];
      const files = fs.readdirSync(path.join(fixtures, cls)).filter(f => f.endsWith('.json')).sort();
      if (parts[2] === 'all_weights_name') return send(req, res, JSON.stringify(files.map(f => f.replace('.json', '.pth'))), 'application/json', 200, false);
      if (parts[2] === 'all') {
        const all = Object.fromEntries(files.map(f => [f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(fixtures, cls, f)))]));
        return send(req, res, JSON.stringify(all), 'application/json', 200, false);
      }
      if (files.includes(parts[2] + '.json')) return send(req, res, JSON.stringify(JSON.parse(fs.readFileSync(path.join(fixtures, cls, parts[2] + '.json')))), 'application/json', 200, false);
    }
    if (parts[0] === 'image' && parts[1] === 'all_subset' && /^\d$/.test(parts[2])) {
      return send(req, res, JSON.stringify(JSON.parse(fs.readFileSync(path.join(fixtures, parts[2] + '_images.json')))), 'application/json', 200, false);
    }
    send(req, res, JSON.stringify({ error: 'Unsupported fixture endpoint', url: req.url }), 'application/json', 404, false);
  });
  for (const [variant, port] of [['baseline', 4173], ['current', 4174]]) {
    const root = path.join(workspace, variant, 'frontend/build');
    await listen(port, (req, res) => {
      let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = name.startsWith('/benchmark-font/') ? path.join(fixtures, name.slice(1)) : path.join(root, name === '/' ? 'index.html' : name);
      if (!file.startsWith(root + '/') && !file.startsWith(path.join(fixtures, 'benchmark-font') + '/')) return send(req, res, 'Forbidden', 'text/plain', 403);
      if (!fs.existsSync(file)) return send(req, res, 'Not found', 'text/plain', 404);
      let body = fs.readFileSync(file);
      if (file.endsWith('index.html')) {
        // Preserve the production font, but serve a frozen copy from this origin.
        body = Buffer.from(body.toString().replace(/<link[^>]*rel="preconnect"[^>]*>/g, '').replace(/https:\/\/fonts.googleapis.com\/css2\?[^" ]+/g, '/benchmark-font/font.css'));
      }
      send(req, res, body, types[path.extname(file)] || 'application/octet-stream');
    });
  }
  return { stats, close: async () => Promise.all(servers.map(s => new Promise(resolve => s.close(resolve)))) };
}
