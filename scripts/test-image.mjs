import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = fs.readFileSync(path.join(root, 'data', 'token.txt'), 'utf8').trim();
const base = String(process.env.APP_BASE || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const file = process.argv[2] || path.join(root, 'data', 'test-banana.png');
const text = process.argv[3] || '这张图里写了什么？只回答你看到的字。';
const kind = process.env.KIND === 'sticker' ? 'sticker' : 'image';

const buf = fs.readFileSync(file);
const ext = path.extname(file).toLowerCase() === '.png' ? 'png' : 'jpeg';
const dataUrl = `data:image/${ext};base64,${buf.toString('base64')}`;

async function call(pathname, options) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!response.ok) {
    console.error(`${pathname} HTTP ${response.status}`, data);
    process.exit(1);
  }
  return data;
}

const started = Date.now();
const media = await call('/api/media', {
  method: 'POST',
  body: JSON.stringify({ dataUrl }),
});
console.log('media', media.id, media.size, media.mime);

const result = await call('/api/send', {
  method: 'POST',
  body: JSON.stringify({
    text,
    clientId: `img-${Date.now()}`,
    mediaId: media.id,
    kind,
  }),
});
console.log(`HTTP 200  ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(JSON.stringify(result, null, 2));
