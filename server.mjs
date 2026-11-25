#!/usr/bin/env node
/**
 * 大肥鱼 App 开源版
 * ------------------------------------------------------------------
 * 一个只做三件事的小网关：
 *   1. 给手机一个能打开的聊天页（PWA / 普通网页）
 *   2. 把手机的话转发给本机 SurfCore 桥接的 /api/app/ask
 *   3. 把消息记在本地的 messages.jsonl 里，供历史和断线补拉
 *
 * 它不碰人格、记忆、QQ 协议；这些都在 SurfCore / DSH 里。
 * 依赖：Node.js >= 22（只用内置模块，不需要 npm install）
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const LEDGER_FILE = path.join(DATA_DIR, 'messages.jsonl');
const TOKEN_FILE = path.join(DATA_DIR, 'token.txt');
const TUNNEL_URL_FILE = path.join(DATA_DIR, 'tunnel.url');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const LIBRARY_DIR = path.join(DATA_DIR, 'library');
const LIBRARY_INDEX = path.join(LIBRARY_DIR, 'index.json');
const VOICE_DIR = path.join(DATA_DIR, 'voice');
const TTS_SCRIPT = path.join(__dirname, 'scripts', 'tts.ps1');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');
const MEDIA_ID_RE = /^[a-f0-9]{64}\.(jpg|png|webp|gif)$/;
const MAX_IMAGE_BYTES = 700_000;
const VERSION = 'z0.1.0';
const PORT = Number(process.env.PORT || 8787);
const HOST = process.argv.includes('--lan') ? '0.0.0.0' : (process.env.HOST || '127.0.0.1');
const BRIDGE_URL = String(process.env.BRIDGE_URL || 'http://127.0.0.1:3100').replace(/\/+$/, '');
const FISH_NAME = String(process.env.FISH_NAME || '大肥鱼').trim() || '大肥鱼';
const BRIDGE_TOKEN_FILE = process.env.BRIDGE_TOKEN_FILE
  || path.join(DATA_DIR, 'bridge-token.txt');
const DEEPSEEK_GRANT_FILE = String(process.env.DEEPSEEK_GRANT_FILE || '').trim();
const DEEPSEEK_PLATFORM = 'https://platform.deepseek.com';
const BRIDGE_TOKEN = readText(BRIDGE_TOKEN_FILE).trim() || String(process.env.BRIDGE_TOKEN || '').trim();

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(LIBRARY_DIR, { recursive: true });
fs.mkdirSync(path.join(LIBRARY_DIR, 'stickers'), { recursive: true });
fs.mkdirSync(path.join(LIBRARY_DIR, 'images'), { recursive: true });
fs.mkdirSync(VOICE_DIR, { recursive: true });
const APP_TOKEN = loadAppToken();

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function loadAppToken() {
  const fromEnv = String(process.env.FISH_APP_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  const existing = readText(TOKEN_FILE).trim();
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString('base64url');
  fs.writeFileSync(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
  return token;
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function tokenFrom(req, url) {
  const header = String(req.headers.authorization || '');
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return String(url.searchParams.get('token') || '').trim();
}

function requireAuth(req, url) {
  const supplied = tokenFrom(req, url);
  if (!supplied || !safeEqual(supplied, APP_TOKEN)) {
    throw new AppError(401, 'UNAUTHORIZED', '令牌不对。看一下电脑上的 data/token.txt，或启动日志。');
  }
}

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isPrivateAddress(raw, localRaw = '') {
  if (!raw) return false;
  const addr = String(raw).replace(/^::ffff:/, '');
  const local = String(localRaw).replace(/^::ffff:/, '');
  if (addr === '::1' || addr === '127.0.0.1') return true;
  if (addr.startsWith('127.')) return true;
  if (addr.startsWith('10.')) return true;
  if (addr.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return true;
  // Tailscale 的 CGNAT 段 100.64.0.0/10：只有本机也在这个段上（直连 Tailscale）才认，
  // 避免“公网端口转发 + 手机蜂窝 100.x”被误当成私网。
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(addr)) {
    return /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(local);
  }
  if (addr.startsWith('fe80:') || addr.startsWith('fc') || addr.startsWith('fd')) return true;
  return false;
}

// ── 本地账本 ────────────────────────────────────────────────────────────────
let messages = [];
try {
  const lines = readText(LEDGER_FILE).split('\n').filter(Boolean);
  messages = lines.slice(-500).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
} catch {}

function appendMessage(message) {
  messages.push(message);
  if (messages.length > 1000) messages = messages.slice(-1000);
  try {
    fs.appendFileSync(LEDGER_FILE, `${JSON.stringify(message)}\n`);
  } catch (error) {
    console.error('[ledger] 写入失败：', error?.message || error);
  }
  return message;
}

function makeMessage({ role, text, clientId = '', kind = 'text', media = null }) {
  return {
    id: `m_${crypto.randomUUID()}`,
    clientId,
    role,
    kind,
    text: String(text),
    media: media || null,
    at: new Date().toISOString(),
  };
}

function readAllMessages() {
  try {
    return readText(LEDGER_FILE)
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return messages.slice();
  }
}

function historyPage({ before = '', limit = 40, q = '' } = {}) {
  let all = readAllMessages();
  const query = String(q || '').trim().toLowerCase();
  if (query) {
    all = all.filter((message) => String(message.text || '').toLowerCase().includes(query));
  }
  const size = Math.min(100, Math.max(1, Number(limit) || 40));
  let end = all.length;
  if (before) {
    const index = all.findIndex((message) => message.id === before);
    if (index >= 0) end = index;
  }
  const start = Math.max(0, end - size);
  return {
    messages: all.slice(start, end),
    total: all.length,
    hasMore: start > 0,
    start,
    end,
  };
}

function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  const head6 = buf.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return { ext: 'gif', mime: 'image/gif' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

function saveImageBuffer(buf) {
  const info = sniffImage(buf);
  if (!info) throw new AppError(400, 'BAD_IMAGE', '这不是有效的图片（只支持 jpg/png/webp/gif）。');
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const id = `${hash}.${info.ext}`;
  const file = path.join(MEDIA_DIR, id);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return { id, url: `/media/${id}`, mime: info.mime, size: buf.length };
}

const PRESET_BACKGROUNDS = new Set(['preset:sky', 'preset:paper', 'preset:whale', 'preset:night', 'preset:none']);

function defaultProfile() {
  return {
    userName: '我',
    userAvatar: '',
    fishAvatar: '',
    background: 'preset:sky',
    theme: 'qq',
    voiceEnabled: false,
    updatedAt: '',
  };
}

function loadProfile() {
  try {
    const parsed = JSON.parse(readText(PROFILE_FILE) || '{}');
    return { ...defaultProfile(), ...parsed };
  } catch {
    return defaultProfile();
  }
}

function saveProfile(next) {
  const temp = `${PROFILE_FILE}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`);
  fs.renameSync(temp, PROFILE_FILE);
}

function validateMediaRef(value, field) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = /^\/media\/([a-f0-9]{64}\.(jpg|png|webp|gif))$/.exec(text);
  if (!match || !fs.existsSync(path.join(MEDIA_DIR, match[1]))) {
    throw new AppError(400, 'BAD_PROFILE', `${field} 不是有效的图片。`);
  }
  return text;
}

let profile = loadProfile();

/* ── 表情 / 图片库（独立目录，内置表情之外） ───────────────────────── */

function loadLibrary() {
  try {
    const list = JSON.parse(readText(LIBRARY_INDEX) || '[]');
    return Array.isArray(list)
      ? list.filter((item) => item && item.id && (item.kind === 'sticker' || item.kind === 'image'))
      : [];
  } catch {
    return [];
  }
}

let library = loadLibrary();

function saveLibrary() {
  const temp = `${LIBRARY_INDEX}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(library.slice(-2000), null, 2)}\n`);
  fs.renameSync(temp, LIBRARY_INDEX);
}

function librarySubdir(kind) {
  return path.join(LIBRARY_DIR, kind === 'sticker' ? 'stickers' : 'images');
}

function libraryFilePath(item) {
  return path.join(librarySubdir(item.kind), item.id);
}

function libraryUrl(item) {
  return `/library/${item.kind}/${item.id}`;
}

function saveLibraryBuffer(buf, kind, label, source = 'upload') {
  const info = sniffImage(buf);
  if (!info) throw new AppError(400, 'BAD_IMAGE', '只支持 jpg/png/webp/gif 图片。');
  if (buf.length > 2_500_000) throw new AppError(413, 'IMAGE_TOO_LARGE', '这张图太大了（最多 2.5 MB）。');
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const id = `${hash}.${info.ext}`;
  const targetKind = kind === 'image' ? 'image' : 'sticker';
  const dir = librarySubdir(targetKind);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, id);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);

  const nextLabel = String(label || '').trim().slice(0, 40) || (targetKind === 'sticker' ? '新表情' : '新图片');
  const item = {
    id,
    kind: targetKind,
    label: nextLabel,
    source: String(source || 'upload').slice(0, 200),
    url: `/library/${targetKind}/${id}`,
    size: buf.length,
    addedAt: new Date().toISOString(),
  };
  const existing = library.find((entry) => entry.id === id && entry.kind === targetKind);
  if (existing) {
    Object.assign(existing, item);
  } else {
    library.push(item);
  }
  saveLibrary();
  return item;
}

function removeLibraryItem(kind, id) {
  const index = library.findIndex((item) => item.kind === kind && item.id === id);
  if (index < 0) return false;
  const [item] = library.splice(index, 1);
  try { fs.unlinkSync(libraryFilePath(item)); } catch {}
  saveLibrary();
  return true;
}

function isSafeRemoteUrl(value) {
  let target;
  try { target = new URL(String(value)); } catch { return false; }
  if (!['http:', 'https:'].includes(target.protocol)) return false;
  const host = target.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  }
  if (host.startsWith('[') || host.includes(':')) return false;
  return true;
}

async function downloadRemoteImage(url) {
  if (!isSafeRemoteUrl(url)) throw new AppError(400, 'BAD_URL', '只接受公网 http(s) 图片地址。');
  let response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'fat-fish-app/0.4 image-library' },
    });
  } catch (error) {
    throw new AppError(502, 'FETCH_FAILED', `下载图片失败：${error?.message || error}`);
  }
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  if (!response.ok || !type.startsWith('image/')) {
    throw new AppError(400, 'NOT_IMAGE', '这个地址不是图片。');
  }
  const buf = Buffer.from(await response.arrayBuffer());
  if (!buf.length) throw new AppError(400, 'EMPTY_IMAGE', '图片是空的。');
  if (buf.length > 2_500_000) throw new AppError(413, 'IMAGE_TOO_LARGE', '图片超过 2.5 MB。');
  return buf;
}

const COLLECT_RE = /\[\[\s*(STICKER|IMAGE)\s*:\s*(https?:\/\/[^\s\]|]+)\s*\|\s*([^\]]*)\]\]/gi;

function stripCollectMarkers(text) {
  return String(text || '').replace(COLLECT_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

async function collectFromMarkers(text) {
  const found = [];
  const regex = new RegExp(COLLECT_RE.source, 'gi');
  let match;
  while ((match = regex.exec(String(text || '')))) {
    found.push({ kind: match[1].toLowerCase() === 'image' ? 'image' : 'sticker', url: match[2], label: match[3] });
  }
  const added = [];
  for (const item of found.slice(0, 4)) {
    try {
      const buf = await downloadRemoteImage(item.url);
      added.push(saveLibraryBuffer(buf, item.kind, item.label, item.url));
    } catch (error) {
      console.error('[library] 收集失败：', item.url, error?.message || error);
    }
  }
  return { added, cleanText: stripCollectMarkers(text) };
}

/* ── 她的声音：Windows SAPI 生成 MP3，缓存到 data/voice ─────────────── */

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

async function synthesizeVoice(rawText) {
  const text = String(rawText || '').trim();
  if (!text) throw new AppError(400, 'EMPTY_TEXT', '没有可读的文字。');
  if (text.length > 600) throw new AppError(413, 'TEXT_TOO_LONG', '这段太长了，语音最多 600 字。');
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const mp3 = path.join(VOICE_DIR, `${hash}.mp3`);
  if (fs.existsSync(mp3)) return { url: `/voice/${hash}.mp3`, cached: true };

  const tomb = `${hash}-${process.pid}-${Date.now()}`;
  const tmpText = path.join(VOICE_DIR, `${tomb}.txt`);
  const tmpWav = path.join(VOICE_DIR, `${tomb}.wav`);
  const tmpMp3 = path.join(VOICE_DIR, `${tomb}.mp3`);
  try {
    fs.writeFileSync(tmpText, text, 'utf8');
    await execFileAsync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', TTS_SCRIPT,
      '-TextFile', tmpText, '-OutFile', tmpWav,
    ], { timeout: 30_000, windowsHide: true });
    await execFileAsync(FFMPEG, [
      '-y', '-loglevel', 'error', '-i', tmpWav,
      '-codec:a', 'libmp3lame', '-b:a', '64k', tmpMp3,
    ], { timeout: 30_000, windowsHide: true });
    fs.renameSync(tmpMp3, mp3);
    return { url: `/voice/${hash}.mp3`, cached: false };
  } catch (error) {
    console.error('[tts] 生成失败：', error?.message || error);
    throw new AppError(503, 'TTS_FAILED', '她的声音暂时生成失败。检查 Windows 语音组件和 ffmpeg。');
  } finally {
    for (const file of [tmpText, tmpWav, tmpMp3]) {
      try { fs.unlinkSync(file); } catch {}
    }
  }
}

function readDeepSeekGrant() {
  try {
    const raw = readText(DEEPSEEK_GRANT_FILE);
    const match = /deepseek-account-platform\/default:[\s\S]*?token:\s*([^\r\n]+)/.exec(raw);
    if (!match) return '';
    return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

async function fetchPlatformJson(pathname) {
  const grant = readDeepSeekGrant();
  if (!grant) throw new AppError(503, 'DEEPSEEK_NO_GRANT', '没有找到 DeepSeek 登录凭据。');
  let response;
  try {
    response = await fetch(`${DEEPSEEK_PLATFORM}${pathname}`, {
      headers: {
        'x-dsh-auth-token': grant,
        'x-client-platform': 'web',
        accept: 'application/json',
        'user-agent': 'fat-fish-app/0.3',
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new AppError(502, 'DEEPSEEK_UNREACHABLE', `连不上 DeepSeek 平台：${error?.message || error}`);
  }
  const body = await response.text();
  let json;
  try { json = JSON.parse(body); } catch { json = null; }
  if (!response.ok || !json || json.code !== 0) {
    const code = json?.code ?? response.status;
    throw new AppError(502, 'DEEPSEEK_API', `DeepSeek 平台返回 ${code}${json?.msg ? `：${json.msg}` : ''}`);
  }
  return json;
}

let deepseekCache = { at: 0, data: null };

async function getDeepSeekHome() {
  if (deepseekCache.data && Date.now() - deepseekCache.at < 5 * 60_000) return deepseekCache.data;
  const grant = readDeepSeekGrant();
  if (!grant) {
    return {
      ok: false,
      available: false,
      error: '未配置 DeepSeek 平台凭据（可选）',
      balance: null,
      daily: [],
    };
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const [summary, usage] = await Promise.all([
    fetchPlatformJson('/api/v0/users/get_user_summary'),
    fetchPlatformJson(`/api/v0/usage/cost?month=${month}&year=${year}`),
  ]);

  const wallets = summary?.data?.biz_data?.normal_wallets || [];
  const bonus = summary?.data?.biz_data?.bonus_wallets || [];
  const currency = wallets[0]?.currency || bonus[0]?.currency || 'CNY';
  const walletTotal = wallets.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const bonusTotal = bonus.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const totalCosts = (summary?.data?.biz_data?.total_costs || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const dayMap = new Map();
  const usageRoot = Array.isArray(usage?.data?.biz_data) ? usage.data.biz_data[0] : usage?.data?.biz_data;
  for (const day of usageRoot?.days || []) {
    let cost = 0;
    for (const model of day.data || []) {
      for (const part of model.usage || []) {
        if (part.type === 'REQUEST') continue;
        cost += Number(part.amount || 0);
      }
    }
    if (cost > 0) dayMap.set(day.date, cost);
  }

  const daily = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    daily.push({ date: key, cost: Number((dayMap.get(key) || 0).toFixed(4)) });
  }
  const todayKey = daily[daily.length - 1]?.date;
  const monthCost = [...dayMap.entries()]
    .filter(([date]) => date <= todayKey)
    .reduce((sum, [, cost]) => sum + cost, 0);

  const data = {
    ok: true,
    available: walletTotal + bonusTotal > 0,
    balance: {
      currency,
      total: Number((walletTotal + bonusTotal).toFixed(4)),
      toppedUp: Number(walletTotal.toFixed(4)),
      granted: Number(bonusTotal.toFixed(4)),
      totalCosts: Number(totalCosts.toFixed(4)),
    },
    todayCost: Number((dayMap.get(todayKey) || 0).toFixed(4)),
    monthCost: Number(monthCost.toFixed(4)),
    daily,
    updatedAt: new Date().toISOString(),
  };
  deepseekCache = { at: Date.now(), data };
  return data;
}

// ── SSE 广播 ────────────────────────────────────────────────────────────────
const sseClients = new Set();

function sseWrite(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    sseClients.delete(res);
  }
}

function broadcast(event, data) {
  for (const res of [...sseClients]) sseWrite(res, event, data);
}

setInterval(() => {
  for (const res of [...sseClients]) {
    try { res.write(': ping\n\n'); } catch { sseClients.delete(res); }
  }
}, 20_000).unref();

// ── 发送闸门 ────────────────────────────────────────────────────────────────
let turnInFlight = false;
const recentSends = [];
function rateLimited() {
  const now = Date.now();
  while (recentSends.length && now - recentSends[0] > 60_000) recentSends.shift();
  if (recentSends.length >= 30) return true;
  recentSends.push(now);
  return false;
}

async function readJson(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new AppError(413, 'TOO_LARGE', '这一条太长了，分几次发吧。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new AppError(400, 'BAD_JSON', '请求格式不对。')); }
    });
    req.on('error', reject);
  });
}

async function askBridge(text, image = null) {
  if (!BRIDGE_TOKEN) {
    throw new AppError(503, 'BRIDGE_TOKEN_MISSING',
      '找不到桥接令牌。请在 data/bridge-token.txt 或 BRIDGE_TOKEN 环境变量里配置。');
  }
  let response;
  try {
    response = await fetch(`${BRIDGE_URL}/api/app/ask`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-console-token': BRIDGE_TOKEN,
      },
      body: JSON.stringify(image ? { text, image } : { text }),
      signal: AbortSignal.timeout(160_000),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new AppError(504, 'TURN_TIMEOUT', '她想了太久还没回来，等会儿再试一次。');
    }
    throw new AppError(502, 'BRIDGE_UNREACHABLE',
      `连不上桥接（${BRIDGE_URL}）。确认 SurfCore 在跑。`);
  }

  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { ok: false, error: raw.slice(0, 300) }; }

  if (!response.ok || data?.ok === false) {
    const code = data?.code || `HTTP_${response.status}`;
    const message = data?.error || `桥接返回了 ${response.status}`;
    if (response.status === 409) throw new AppError(409, 'TURN_BUSY', message);
    if (response.status === 401) throw new AppError(502, 'BRIDGE_AUTH', '桥接令牌失效了，需要重启 SurfCore。');
    if (response.status === 404) {
      throw new AppError(502, 'APP_ENDPOINT_MISSING',
        '桥接还没有 /api/app/ask。需要重启一次 SurfCore 让新代码生效。');
    }
    throw new AppError(502, code, message);
  }
  return data;
}

// ── 静态文件 ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, rel);
  if (!filePath.startsWith(`${path.resolve(PUBLIC_DIR)}${path.sep}`) && filePath !== path.resolve(PUBLIC_DIR, 'index.html')) {
    throw new AppError(403, 'FORBIDDEN', '不允许访问这个路径。');
  }
  let stat;
  try { stat = fs.statSync(filePath); } catch { throw new AppError(404, 'NOT_FOUND', '页面不存在。'); }
  if (!stat.isFile()) throw new AppError(404, 'NOT_FOUND', '页面不存在。');
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=3600',
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function setSecurityHeaders(res) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('content-security-policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'");
}

// ── HTTP ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (pathname.startsWith('/api/')) {
      if (!isPrivateAddress(req.socket.remoteAddress, req.socket.localAddress)) {
        throw new AppError(403, 'NOT_PRIVATE', '这个入口只接受本机/局域网/Tailscale 设备。');
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, {
          ok: true,
          version: VERSION,
          uptimeSec: Math.round(process.uptime()),
          bridge: { url: BRIDGE_URL, token: Boolean(BRIDGE_TOKEN) },
        });
      }

      requireAuth(req, url);

      if (req.method === 'GET' && pathname === '/api/remote') {
        const url = readText(TUNNEL_URL_FILE).trim();
        return sendJson(res, 200, { ok: true, url, active: Boolean(url) });
      }

      if (req.method === 'GET' && pathname === '/api/profile') {
        return sendJson(res, 200, { ok: true, profile });
      }

      if (req.method === 'POST' && pathname === '/api/profile') {
        const body = await readJson(req);
        const next = { ...profile };
        if (body.userName !== undefined) {
          const userName = String(body.userName ?? '').trim().slice(0, 20);
          next.userName = userName || '我';
        }
        if (body.userAvatar !== undefined) next.userAvatar = validateMediaRef(body.userAvatar, '我的头像');
        if (body.fishAvatar !== undefined) next.fishAvatar = validateMediaRef(body.fishAvatar, '她的头像');
        if (body.voiceEnabled !== undefined) next.voiceEnabled = Boolean(body.voiceEnabled);
        if (body.background !== undefined) {
          const background = String(body.background ?? '').trim();
          if (background && !PRESET_BACKGROUNDS.has(background) && !/^\/media\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(background)) {
            throw new AppError(400, 'BAD_PROFILE', '聊天背景不是有效的预设或图片。');
          }
          if (background.startsWith('/media/')) {
            const id = background.slice('/media/'.length);
            if (!MEDIA_ID_RE.test(id) || !fs.existsSync(path.join(MEDIA_DIR, id))) {
              throw new AppError(400, 'BAD_PROFILE', '聊天背景图片不存在。');
            }
          }
          next.background = background || 'preset:sky';
        }
        if (body.theme !== undefined) {
          const theme = String(body.theme ?? '').trim();
          if (!['qq', 'dark'].includes(theme)) throw new AppError(400, 'BAD_PROFILE', '主题只能是 qq 或 dark。');
          next.theme = theme;
        }
        next.updatedAt = new Date().toISOString();
        profile = next;
        saveProfile(profile);
        return sendJson(res, 200, { ok: true, profile });
      }

      if (req.method === 'GET' && pathname === '/api/fish/home') {
        let home;
        try {
          home = await getDeepSeekHome();
        } catch (error) {
          home = {
            ok: false,
            available: false,
            error: error?.message || '读取 DeepSeek 余额失败',
            balance: null,
            daily: [],
          };
        }
        const daily = Array.isArray(home.daily) ? home.daily : [];
        return sendJson(res, 200, {
          ...home,
          ok: true,
          name: FISH_NAME,
          avatar: profile.fishAvatar || '/fish-avatar.png',
          cover: '/fish-cover.png',
          signature: '今天也在好好过日子。',
          spend7d: Number(daily.reduce((sum, item) => sum + Number(item.cost || 0), 0).toFixed(4)),
        });
      }

      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        const all = readAllMessages();
        return sendJson(res, 200, {
          ok: true,
          version: VERSION,
          fish: { name: FISH_NAME, avatar: profile.fishAvatar || '/fish-avatar.png' },
          profile,
          messages: all.slice(-200),
          history: { total: all.length, hasMore: all.length > 200 },
          serverTime: new Date().toISOString(),
          bridge: { url: BRIDGE_URL, token: Boolean(BRIDGE_TOKEN) },
        });
      }

      if (req.method === 'GET' && pathname === '/api/messages/page') {
        const page = historyPage({
          before: String(url.searchParams.get('before') || ''),
          limit: Number(url.searchParams.get('limit') || 40),
        });
        return sendJson(res, 200, { ok: true, ...page });
      }

      if (req.method === 'GET' && pathname === '/api/messages/search') {
        const q = String(url.searchParams.get('q') || '').trim();
        if (!q) return sendJson(res, 200, { ok: true, messages: [], total: 0, hasMore: false });
        const page = historyPage({
          q,
          limit: Number(url.searchParams.get('limit') || 50),
        });
        return sendJson(res, 200, { ok: true, ...page, query: q });
      }

      if (req.method === 'GET' && pathname === '/api/messages/around') {
        const id = String(url.searchParams.get('id') || '').trim();
        const all = readAllMessages();
        const index = all.findIndex((message) => message.id === id);
        if (index < 0) throw new AppError(404, 'NOT_FOUND', '找不到这条消息。');
        const before = Math.max(0, index - 25);
        const after = Math.min(all.length, index + 26);
        return sendJson(res, 200, {
          ok: true,
          messages: all.slice(before, after),
          targetId: id,
          hasMore: before > 0,
          total: all.length,
        });
      }

      if (req.method === 'GET' && pathname === '/api/events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        // 某些反代（包括 Cloudflare quick tunnel）会攒够一块才转发；先灌 2KB 注释强制 flush。
        res.write(`:${'-'.repeat(2048)}\n\n`);
        res.write(': connected\n\n');
        sseWrite(res, 'hello', { version: VERSION, serverTime: new Date().toISOString(), count: messages.length });
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }

      if (req.method === 'POST' && pathname === '/api/media') {
        const body = await readJson(req, 2 * 1024 * 1024);
        const dataUrl = String(body.dataUrl || '');
        const match = /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
        if (!match) throw new AppError(400, 'BAD_IMAGE', '只接受 jpg/png/webp/gif 的 base64 图片。');
        const buf = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
        if (!buf.length) throw new AppError(400, 'EMPTY_IMAGE', '图片是空的。');
        if (buf.length > MAX_IMAGE_BYTES) {
          throw new AppError(413, 'IMAGE_TOO_LARGE', `图片太大了（压缩后最多 ${Math.round(MAX_IMAGE_BYTES / 1024)} KB）。`);
        }
        const saved = saveImageBuffer(buf);
        return sendJson(res, 200, { ok: true, ...saved });
      }

      if (req.method === 'GET' && pathname === '/api/stickers') {
        const raw = readText(path.join(PUBLIC_DIR, 'stickers', 'index.json'));
        let stickers = [];
        try { stickers = JSON.parse(raw).stickers || []; } catch {}
        const custom = library
          .filter((item) => item.kind === 'sticker')
          .map((item) => ({
            id: item.id,
            label: item.label,
            file: item.url,
            custom: true,
          }));
        return sendJson(res, 200, { ok: true, stickers: [...stickers, ...custom], library: custom });
      }

      if (req.method === 'GET' && pathname === '/api/library') {
        return sendJson(res, 200, {
          ok: true,
          items: library,
          storage: path.join(DATA_DIR, 'library'),
          note: '表情和图片存在电脑的 data/library，手机端只负责浏览和上传。',
        });
      }

      if (req.method === 'POST' && pathname === '/api/library') {
        const body = await readJson(req, 4 * 1024 * 1024);
        const dataUrl = String(body.dataUrl || '');
        const match = /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
        if (!match) throw new AppError(400, 'BAD_IMAGE', '只接受 jpg/png/webp/gif 的 base64 图片。');
        const buf = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
        const item = saveLibraryBuffer(buf, body.kind, body.label, body.source || 'upload');
        broadcast('library', { action: 'add', item });
        return sendJson(res, 200, { ok: true, item });
      }

      if (req.method === 'POST' && pathname === '/api/library/collect') {
        const body = await readJson(req);
        const buf = await downloadRemoteImage(String(body.url || '').trim());
        const item = saveLibraryBuffer(buf, body.kind, body.label, String(body.url || ''));
        broadcast('library', { action: 'add', item });
        return sendJson(res, 200, { ok: true, item });
      }

      if (req.method === 'POST' && pathname === '/api/library/request') {
        const body = await readJson(req);
        const query = String(body.query || '').trim().slice(0, 80);
        if (!query) throw new AppError(400, 'EMPTY_QUERY', '想让她找什么表情？');
        const prompt = [
          '（这是 App 表情库任务，不是聊天回复。）',
          `请联网找 1-3 张适合当表情包的图片，主题：${query}`,
          '只回复下面这种标记，每行一条，不要解释：',
          '[[STICKER:图片直链URL|短标签]]',
          '如果找不到，就回复“这次没找到合适的”。',
        ].join('\n');
        const result = await askBridge(prompt, null);
        const collected = await collectFromMarkers(result.reply);
        for (const item of collected.added) broadcast('library', { action: 'add', item });
        return sendJson(res, 200, {
          ok: true,
          reply: collected.cleanText,
          added: collected.added,
        });
      }

      const libraryMatch = /^\/api\/library\/(sticker|image)\/([a-f0-9]{64}\.(?:jpg|png|webp|gif))$/.exec(pathname);
      if (libraryMatch) {
        const kind = libraryMatch[1];
        const id = libraryMatch[2];
        const item = library.find((entry) => entry.kind === kind && entry.id === id);
        if (!item) throw new AppError(404, 'NOT_FOUND', '这张图不在库里。');
        if (req.method === 'DELETE') {
          removeLibraryItem(kind, id);
          broadcast('library', { action: 'remove', kind, id });
          return sendJson(res, 200, { ok: true });
        }
        if (req.method === 'GET') {
          const file = libraryFilePath(item);
          if (!fs.existsSync(file)) throw new AppError(404, 'NOT_FOUND', '文件不见了。');
          res.writeHead(200, {
            'content-type': MIME[path.extname(id).toLowerCase()] || 'application/octet-stream',
            'cache-control': 'private, max-age=86400',
          });
          fs.createReadStream(file).pipe(res);
          return;
        }
      }

      if (req.method === 'POST' && pathname === '/api/tts') {
        const body = await readJson(req);
        const voice = await synthesizeVoice(body.text);
        return sendJson(res, 200, { ok: true, ...voice });
      }

      if (req.method === 'POST' && pathname === '/api/send') {
        if (rateLimited()) throw new AppError(429, 'RATE_LIMIT', '发得太快了，歇十秒再发。');
        if (turnInFlight) throw new AppError(409, 'TURN_BUSY', '她还在回上一句，等十几秒。');
        const body = await readJson(req);
        let text = String(body.text || '').trim();
        const clientId = String(body.clientId || '').trim().slice(0, 80);
        const mediaId = String(body.mediaId || '').trim();
        const kind = body.kind === 'sticker' ? 'sticker' : 'image';

        let media = null;
        let image = null;
        if (mediaId) {
          if (!MEDIA_ID_RE.test(mediaId)) throw new AppError(400, 'BAD_MEDIA', '图片标识不对。');
          const file = path.join(MEDIA_DIR, mediaId);
          let buf;
          try { buf = fs.readFileSync(file); }
          catch { throw new AppError(404, 'MEDIA_MISSING', '这张图片已经不在了，重新发一次。'); }
          const info = sniffImage(buf);
          if (!info) throw new AppError(400, 'BAD_MEDIA', '图片文件损坏了。');
          if (buf.length > MAX_IMAGE_BYTES) throw new AppError(413, 'IMAGE_TOO_LARGE', '图片太大了。');
          media = { id: mediaId, url: `/media/${mediaId}`, mime: info.mime, size: buf.length };
          image = { mimeType: info.mime, data: buf.toString('base64'), name: mediaId };
        }

        if (!text && !media) throw new AppError(400, 'EMPTY', '说点什么吧，或者发张图。');
        if (text.length > 2000) throw new AppError(400, 'TOO_LONG', '这一条太长了（最多 2000 字）。');

        const userMessage = makeMessage({
          role: 'user',
          text,
          clientId,
          kind: media ? kind : 'text',
          media,
        });

        turnInFlight = true;
        try {
          const result = await askBridge(text, image);
          const collected = await collectFromMarkers(String(result.reply || ''));
          let replyText = collected.cleanText;
          if (!replyText && collected.added.length) {
            replyText = `给你收了 ${collected.added.length} 张图，放在表情库里了。`;
          }
          if (!replyText) {
            throw new AppError(502, 'EMPTY_REPLY', '她这次没有回文字。再试一次，或者回 QQ 看看。');
          }
          for (const item of collected.added) broadcast('library', { action: 'add', item });
          // 回合成功后才落账：失败的消息不写历史，客户端直接重试，不会留下半条。
          appendMessage(userMessage);
          broadcast('message', { message: userMessage });

          const fishMessage = makeMessage({ role: 'fish', text: replyText });
          appendMessage(fishMessage);
          broadcast('message', { message: fishMessage });
          return sendJson(res, 200, {
            ok: true,
            user: userMessage,
            fish: fishMessage,
            sentByTool: Boolean(result.sentByTool),
          });
        } finally {
          turnInFlight = false;
        }
      }

      throw new AppError(404, 'NOT_FOUND', '没有这个接口。');
    }

    if (req.method === 'GET' && pathname.startsWith('/library/')) {
      if (!isPrivateAddress(req.socket.remoteAddress, req.socket.localAddress)) {
        throw new AppError(403, 'NOT_PRIVATE', '这个入口只接受本机/局域网/Tailscale 设备。');
      }
      requireAuth(req, url);
      const match = /^\/library\/(sticker|image)\/([a-f0-9]{64}\.(?:jpg|png|webp|gif))$/.exec(pathname);
      if (!match) throw new AppError(404, 'NOT_FOUND', '图片不存在。');
      const kind = match[1];
      const id = match[2];
      const item = library.find((entry) => entry.kind === kind && entry.id === id);
      if (!item) throw new AppError(404, 'NOT_FOUND', '图片不存在。');
      const file = libraryFilePath(item);
      if (!fs.existsSync(file)) throw new AppError(404, 'NOT_FOUND', '图片不存在。');
      res.writeHead(200, {
        'content-type': MIME[path.extname(id).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'private, max-age=86400',
      });
      fs.createReadStream(file).pipe(res);
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/voice/')) {
      if (!isPrivateAddress(req.socket.remoteAddress, req.socket.localAddress)) {
        throw new AppError(403, 'NOT_PRIVATE', '这个入口只接受本机/局域网/Tailscale 设备。');
      }
      requireAuth(req, url);
      const id = pathname.slice('/voice/'.length);
      if (!/^[a-f0-9]{64}\.mp3$/.test(id)) throw new AppError(404, 'NOT_FOUND', '语音不存在。');
      const file = path.join(VOICE_DIR, id);
      if (!fs.existsSync(file)) throw new AppError(404, 'NOT_FOUND', '语音不存在。');
      res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=86400' });
      fs.createReadStream(file).pipe(res);
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/media/')) {
      if (!isPrivateAddress(req.socket.remoteAddress, req.socket.localAddress)) {
        throw new AppError(403, 'NOT_PRIVATE', '这个入口只接受本机/局域网/Tailscale 设备。');
      }
      requireAuth(req, url);
      const id = pathname.slice('/media/'.length);
      if (!MEDIA_ID_RE.test(id)) throw new AppError(404, 'NOT_FOUND', '图片不存在。');
      const file = path.join(MEDIA_DIR, id);
      let stat;
      try { stat = fs.statSync(file); } catch { throw new AppError(404, 'NOT_FOUND', '图片不存在。'); }
      if (!stat.isFile()) throw new AppError(404, 'NOT_FOUND', '图片不存在。');
      const ext = path.extname(id).toLowerCase();
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': 'private, max-age=86400',
      });
      fs.createReadStream(file).pipe(res);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      throw new AppError(405, 'METHOD_NOT_ALLOWED', '只支持 GET。');
    }
    return serveStatic(req, res, pathname);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    const code = error instanceof AppError ? error.code : 'INTERNAL';
    const message = error instanceof AppError ? error.message : '服务器出了点问题。';
    if (!(error instanceof AppError)) console.error('[app] 未处理异常：', error);
    if (res.headersSent) { try { res.end(); } catch {} return; }
    return sendJson(res, status, { ok: false, code, error: message });
  }
});

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) out.push(item.address);
    }
  }
  return [...new Set(out)];
}

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  大肥鱼 · 手机端 v' + VERSION);
  console.log('  ─────────────────────────────────────────────');
  console.log(`  监听：${HOST}:${PORT}`);
  console.log(`  桥接：${BRIDGE_URL}（令牌${BRIDGE_TOKEN ? '已读取' : '没找到！'}）`);
  console.log('');
  console.log(`  本机打开：http://127.0.0.1:${PORT}/?token=${APP_TOKEN}`);
  if (HOST === '0.0.0.0') {
    for (const ip of lanAddresses()) {
      console.log(`  手机打开：http://${ip}:${PORT}/?token=${APP_TOKEN}`);
    }
    console.log('');
    console.log('  提示：手机和电脑要在同一个 Wi-Fi；第一次打开后令牌会存在手机里。');
    console.log('  远程访问请走 Tailscale，不要把这个端口映射到公网。');
  } else {
    console.log('  只监听本机。要手机访问，用 --lan 重新启动。');
  }
  console.log('');
  console.log(`  令牌文件：${TOKEN_FILE}`);
  console.log('');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\n[app] 正在退出…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
