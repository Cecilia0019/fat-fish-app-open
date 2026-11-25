import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = fs.readFileSync(path.join(root, 'data', 'token.txt'), 'utf8').trim();
const base = String(process.env.APP_BASE || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const text = process.argv.slice(2).join(' ').trim() || '在吗，手机端自检。';
const started = Date.now();

const response = await fetch(`${base}/api/send`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ text, clientId: `test-${Date.now()}` }),
});

const raw = await response.text();
console.log(`HTTP ${response.status}  ${((Date.now() - started) / 1000).toFixed(1)}s`);
try {
  console.log(JSON.stringify(JSON.parse(raw), null, 2));
} catch {
  console.log(raw);
}
