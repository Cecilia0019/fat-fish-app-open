import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = fs.readFileSync(path.join(root, 'data', 'token.txt'), 'utf8').trim();
const base = 'http://127.0.0.1:8787';
const reset = process.env.RESET === '1';

async function call(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!response.ok) {
    console.error(pathname, response.status, data);
    process.exit(1);
  }
  return data;
}

async function upload(file) {
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase() === '.png' ? 'png' : 'jpeg';
  const dataUrl = `data:image/${ext};base64,${buf.toString('base64')}`;
  const media = await call('/api/media', { method: 'POST', body: JSON.stringify({ dataUrl }) });
  console.log('media', media.id, media.size);
  return media.url;
}

if (reset) {
  const data = await call('/api/profile', {
    method: 'POST',
    body: JSON.stringify({ userAvatar: '', fishAvatar: '', background: 'preset:sky', theme: 'qq' }),
  });
  console.log('reset', data.profile);
} else {
  const avatar = await upload(path.join(root, 'data', 'test-avatar.png'));
  const background = await upload(path.join(root, 'data', 'test-bg.png'));
  const data = await call('/api/profile', {
    method: 'POST',
    body: JSON.stringify({ userAvatar: avatar, fishAvatar: avatar, background, theme: 'qq' }),
  });
  console.log('profile', data.profile);
}
