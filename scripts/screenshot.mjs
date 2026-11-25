import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const out = process.argv[3] || path.join(process.cwd(), 'data', 'shot.png');
if (!url) {
  console.error('usage: node scripts/screenshot.mjs <url> [out.png]');
  process.exit(1);
}

const port = 9223 + Math.floor(Math.random() * 200);
const profile = path.join(os.tmpdir(), `edge-fish-${Date.now()}`);
const child = spawn(edge, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-allow-origins=*',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--window-size=390,844',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitVersion() {
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {}
    await sleep(500);
  }
  throw new Error('Edge remote debugging port did not open');
}

async function main() {
  await waitVersion();
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = targetResponse.ok ? await targetResponse.json() : (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())[0];
  if (!target?.webSocketDebuggerUrl) throw new Error('no CDP target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    ws.send(JSON.stringify({ id: callId, method, params }));
    setTimeout(() => {
      if (pending.delete(callId)) reject(new Error(`timeout: ${method}`));
    }, 20000);
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await send('Page.navigate', { url });
  await sleep(5000);

  if (process.env.ACTION === 'stickers') {
    await send('Runtime.evaluate', { expression: "document.getElementById('stickerBtn').click()" });
    await sleep(1200);
  } else if (process.env.ACTION === 'voice') {
    await send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelectorAll('#voiceInputBtn,.speak-btn').forEach((el) => {
          el.style.setProperty('outline', '4px solid #ff3b30', 'important');
          el.style.setProperty('outline-offset', '4px', 'important');
          el.style.setProperty('box-shadow', '0 0 0 7px rgba(255,59,48,.22)', 'important');
        });
      })()`,
    });
    await sleep(500);
  } else if (process.env.ACTION === 'sidebar') {
    await send('Runtime.evaluate', { expression: "document.getElementById('backBtn').click()" });
    await sleep(700);
  } else if (process.env.ACTION === 'home') {
    await send('Runtime.evaluate', { expression: "document.getElementById('backBtn').click()" });
    await sleep(700);
    await send('Runtime.evaluate', { expression: "document.getElementById('sidebarHome').click()" });
    await sleep(2600);
  } else if (process.env.ACTION === 'settings') {
    await send('Runtime.evaluate', { expression: "document.getElementById('infoBtn').click()" });
    await sleep(1200);
  } else if (process.env.ACTION === 'me') {
    await send('Runtime.evaluate', { expression: "document.getElementById('backBtn').click()" });
    await sleep(600);
    await send('Runtime.evaluate', { expression: "document.getElementById('sidebarMe').click()" });
    await sleep(1600);
  } else if (process.env.ACTION === 'library') {
    await send('Runtime.evaluate', { expression: "document.getElementById('backBtn').click()" });
    await sleep(600);
    await send('Runtime.evaluate', { expression: "document.getElementById('sidebarLibrary').click()" });
    await sleep(1200);
    await send('Runtime.evaluate', {
      expression: "const n=document.getElementById('libraryNote'); if(n) n.textContent='存储位置：data/library';",
    });
    await sleep(400);
  } else if (process.env.ACTION === 'history') {
    await send('Runtime.evaluate', { expression: "document.getElementById('backBtn').click()" });
    await sleep(600);
    await send('Runtime.evaluate', { expression: "document.getElementById('sidebarHistory').click()" });
    await sleep(1600);
  } else if (process.env.ACTION === 'historyjump') {
    await send('Runtime.evaluate', { expression: "document.getElementById('backBtn').click()" });
    await sleep(600);
    await send('Runtime.evaluate', { expression: "document.getElementById('sidebarHistory').click()" });
    await sleep(1600);
    await send('Runtime.evaluate', { expression: "document.querySelector('[data-history-id]')?.click()" });
    await sleep(1400);
  } else if (process.env.ACTION === 'lightbox') {
    await send('Runtime.evaluate', { expression: "document.querySelector('.msg-image')?.click()" });
    await sleep(600);
  } else if (process.env.ACTION === 'pending') {
    await send('Runtime.evaluate', {
      expression: `(async () => {
        const response = await fetch('/stickers/good.png');
        const blob = await response.blob();
        const file = new File([blob], 'good.png', { type: 'image/png' });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        const input = document.getElementById('fileInput');
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    await sleep(2500);
  } else if (process.env.ACTION === 'sendsticker') {
    await send('Runtime.evaluate', { expression: "document.getElementById('stickerBtn').click()" });
    await sleep(1200);
    await send('Runtime.evaluate', { expression: "document.querySelector('.sticker-item')?.click()" });
    await sleep(8000);
  }

  const evaluated = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      title: document.title,
      chatHidden: document.getElementById('chat').classList.contains('hidden'),
      loginHidden: document.getElementById('login').classList.contains('hidden'),
      status: document.getElementById('statusText').textContent,
      bubbles: document.querySelectorAll('.row').length,
      hasAttach: !!document.getElementById('attachBtn'),
      hasSticker: !!document.getElementById('stickerBtn'),
      hasLightbox: !!document.getElementById('lightbox'),
      toast: document.getElementById('toast').textContent,
      bar: (() => {
        const el = document.querySelector('.fish-bar');
        if (!el) return null;
        const s = getComputedStyle(el);
        return { inline: el.style.height, computed: s.height, rect: el.getBoundingClientRect().height, wrap: el.parentElement.getBoundingClientRect().height };
      })(),
      bars: [...document.querySelectorAll('.fish-bar-wrap')].map((wrap) => {
        const r = wrap.getBoundingClientRect();
        const b = wrap.querySelector('.fish-bar').getBoundingClientRect();
        return { label: wrap.querySelector('em')?.textContent, x: Math.round(r.x), w: Math.round(r.width), barX: Math.round(b.x), barW: Math.round(b.width) };
      }),
      stickerStyle: (() => {
        const el = document.querySelector('.row.sticker .bubble');
        if (!el) return null;
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, padding: s.padding, shadow: s.boxShadow, border: s.borderTopWidth + ' ' + s.borderTopColor };
      })()
    })`,
    returnByValue: true,
  });
  console.log('DOM', evaluated?.result?.value);

  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('screenshot', out, fs.statSync(out).size);
  ws.close();
}

main()
  .catch((error) => {
    console.error('failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sleep(300);
    try { child.kill(); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  });
