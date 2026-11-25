/* 大肥鱼 · 手机端 第二版
 * 纯原生 ES module，无构建步骤。
 * 登录、历史、文字/图片/表情发送、SSE + 轮询、重试、连接状态。
 */

const $ = (id) => document.getElementById(id);

const els = {
  login: $('login'),
  chat: $('chat'),
  tokenInput: $('tokenInput'),
  loginBtn: $('loginBtn'),
  loginError: $('loginError'),
  fishName: $('fishName'),
  statusText: $('statusText'),
  presenceDot: $('presenceDot'),
  fishAvatarImg: $('fishAvatarImg'),
  backBtn: $('backBtn'),
  messages: $('messages'),
  typing: $('typing'),
  typingAvatar: $('typingAvatar'),
  typingLabel: $('typingLabel'),
  input: $('input'),
  sendBtn: $('sendBtn'),
  attachBtn: $('attachBtn'),
  stickerBtn: $('stickerBtn'),
  fileInput: $('fileInput'),
  pendingPreview: $('pendingPreview'),
  pendingImage: $('pendingImage'),
  pendingTitle: $('pendingTitle'),
  pendingStatus: $('pendingStatus'),
  pendingRemove: $('pendingRemove'),
  stickerPanel: $('stickerPanel'),
  stickerGrid: $('stickerGrid'),
  stickerClose: $('stickerClose'),
  stickerManage: $('stickerManage'),
  voiceInputBtn: $('voiceInputBtn'),
  voiceToggle: $('voiceToggle'),
  lightbox: $('lightbox'),
  lightboxImg: $('lightboxImg'),
  lightboxClose: $('lightboxClose'),
  errorBar: $('errorBar'),
  errorText: $('errorText'),
  errorRetry: $('errorRetry'),
  errorClose: $('errorClose'),
  infoBtn: $('infoBtn'),
  sheet: $('sheet'),
  sheetBackdrop: $('sheetBackdrop'),
  infoVersion: $('infoVersion'),
  infoBridge: $('infoBridge'),
  infoRemote: $('infoRemote'),
  infoToken: $('infoToken'),
  infoCount: $('infoCount'),
  reconnectBtn: $('reconnectBtn'),
  forgetBtn: $('forgetBtn'),
  changeServerBtn: $('changeServerBtn'),
  userAvatarPreview: $('userAvatarPreview'),
  fishAvatarPreview: $('fishAvatarPreview'),
  userAvatarBtn: $('userAvatarBtn'),
  fishAvatarBtn: $('fishAvatarBtn'),
  bgPresets: $('bgPresets'),
  bgUploadBtn: $('bgUploadBtn'),
  themeSeg: $('themeSeg'),
  avatarFileInput: $('avatarFileInput'),
  bgFileInput: $('bgFileInput'),
  messageMenu: $('messageMenu'),
  messageMenuBackdrop: $('messageMenuBackdrop'),
  sidebar: $('sidebar'),
  sidebarBackdrop: $('sidebarBackdrop'),
  sidebarAvatar: $('sidebarAvatar'),
  sidebarHome: $('sidebarHome'),
  sidebarBackground: $('sidebarBackground'),
  sidebarTheme: $('sidebarTheme'),
  sidebarSettings: $('sidebarSettings'),
  sidebarAbout: $('sidebarAbout'),
  fishHome: $('fishHome'),
  fishHomeBack: $('fishHomeBack'),
  fishHomeMore: $('fishHomeMore'),
  fishHomeAvatar: $('fishHomeAvatar'),
  fishHomeName: $('fishHomeName'),
  fishSignature: $('fishSignature'),
  fishBalance: $('fishBalance'),
  fishToday: $('fishToday'),
  fish7d: $('fish7d'),
  fishMonthCost: $('fishMonthCost'),
  fishChart: $('fishChart'),
  fishChartLabels: $('fishChartLabels'),
  fishTotalCost: $('fishTotalCost'),
  fishUpdated: $('fishUpdated'),
  fishError: $('fishError'),
  fishRefresh: $('fishRefresh'),
  historyHome: $('historyHome'),
  historyBack: $('historyBack'),
  historyCount: $('historyCount'),
  historySearch: $('historySearch'),
  historySearchBtn: $('historySearchBtn'),
  historyList: $('historyList'),
  historyMore: $('historyMore'),
  meHome: $('meHome'),
  meBack: $('meBack'),
  meSettings: $('meSettings'),
  meAvatar: $('meAvatar'),
  meName: $('meName'),
  meAvatarBtn: $('meAvatarBtn'),
  meNameInput: $('meNameInput'),
  meNameSave: $('meNameSave'),
  meStickerGrid: $('meStickerGrid'),
  meStickerUpload: $('meStickerUpload'),
  libraryHome: $('libraryHome'),
  libraryBack: $('libraryBack'),
  libraryUploadBtn: $('libraryUploadBtn'),
  libraryTabs: $('libraryTabs'),
  libraryAsk: $('libraryAsk'),
  libraryGrid: $('libraryGrid'),
  libraryUrl: $('libraryUrl'),
  libraryImport: $('libraryImport'),
  libraryNote: $('libraryNote'),
  stickerFileInput: $('stickerFileInput'),
  sidebarMe: $('sidebarMe'),
  sidebarLibrary: $('sidebarLibrary'),
  sidebarHistory: $('sidebarHistory'),
  toast: $('toast'),
};

const PRESET_BACKGROUNDS = {
  'preset:sky': 'linear-gradient(160deg, #e8f5ff, #cfeaff 60%, #f7fbff)',
  'preset:whale': 'linear-gradient(160deg, #dff7f4, #c9ecff 55%, #eefaff)',
  'preset:paper': 'linear-gradient(160deg, #f7f2e8, #e9dfcf)',
  'preset:night': 'linear-gradient(160deg, #1b2a38, #0a1520)',
};

const DEFAULT_PROFILE = {
  userName: '我',
  userAvatar: '',
  fishAvatar: '',
  background: 'preset:sky',
  theme: 'qq',
  voiceEnabled: false,
};

const state = {
  token: '',
  messages: [],
  sending: false,
  sendingKind: 'text',
  connected: false,
  es: null,
  info: null,
  failedText: '',
  failedMedia: null,
  toastTimer: 0,
  sseOk: false,
  pendingMedia: null,
  uploading: false,
  stickers: [],
  stickerUploaded: new Map(),
  profile: { ...DEFAULT_PROFILE },
  avatarTarget: 'user',
  menuTarget: null,
  fishHomeLoaded: false,
  libraryItems: [],
  libraryKind: 'sticker',
  libraryUploadKind: 'sticker',
  historyItems: [],
  historyBefore: '',
  historyHasMore: false,
  historyQuery: '',
  historyLoading: false,
  voiceAudio: null,
  voiceBusy: false,
  recording: false,
  recognition: null,
  highlightId: '',
};

let pollFailures = 0;

const STORAGE_KEY = 'fish_app_token';

/* ── 工具 ─────────────────────────────────────────────────────────────── */

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatText(text) {
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<code>${code.trim()}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const clean = url.replace(/[.,;:!?)]+$/, '');
    const tail = url.slice(clean.length);
    return `<a href="${clean}" target="_blank" rel="noreferrer noopener">${clean}</a>${tail}`;
  });
  return html;
}

function timeOf(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function dayKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayLabel(key) {
  const now = new Date();
  const today = dayKey(now.toISOString());
  const yesterday = new Date(now.getTime() - 86400000);
  if (key === today) return '今天';
  if (key === dayKey(yesterday.toISOString())) return '昨天';
  const [y, m, d] = key.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function toast(message, ms = 2600) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
}

function setConnected(value) {
  state.connected = Boolean(value);
  els.presenceDot.classList.toggle('online', state.connected);
  els.presenceDot.classList.toggle('offline', !state.connected);
  updateStatusText();
}

function updateStatusText() {
  if (state.sending) {
    els.statusText.textContent = state.sendingKind === 'image'
      ? '她在看图…'
      : (state.sendingKind === 'sticker' ? '她在看表情…' : '她在想…');
    return;
  }
  els.statusText.textContent = state.connected ? '在同一段对话里' : '连接断开，正在重连…';
}

function setSending(value, kind = 'text') {
  state.sending = Boolean(value);
  state.sendingKind = kind;
  els.typing.classList.toggle('hidden', !state.sending);
  els.typingLabel.textContent = kind === 'image'
    ? '她在看图…'
    : (kind === 'sticker' ? '她在看表情…' : '她在想…');
  els.sendBtn.disabled = state.sending || state.uploading || (!els.input.value.trim() && !state.pendingMedia);
  updateStatusText();
  if (state.sending) scrollToBottom(true);
}

function scrollToBottom(force = false) {
  const el = els.messages;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  if (force || nearBottom) {
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }
}

/* ── 头像 / 背景 / 主题 ───────────────────────────────────────────────── */

function mediaSrc(url, fallback = '') {
  const value = String(url || '').trim();
  if (!value) return fallback;
  if (!value.startsWith('/media/') && !value.startsWith('/library/')) return value;
  const joiner = value.includes('?') ? '&' : '?';
  return `${value}${joiner}token=${encodeURIComponent(state.token)}`;
}

function applyBackground() {
  const background = state.profile.background || 'preset:sky';
  const theme = state.profile.theme || 'qq';
  const overlay = theme === 'qq'
    ? 'linear-gradient(rgba(255,255,255,.52), rgba(255,255,255,.52))'
    : 'linear-gradient(rgba(4,12,18,.5), rgba(4,12,18,.5))';
  if (background.startsWith('/media/')) {
    const url = mediaSrc(background);
    els.messages.style.backgroundImage = `${overlay}, url("${url}")`;
  } else {
    els.messages.style.backgroundImage = PRESET_BACKGROUNDS[background] || PRESET_BACKGROUNDS['preset:sky'];
  }
}

function updateProfileControls() {
  const profile = state.profile;
  els.userAvatarPreview.src = mediaSrc(profile.userAvatar, '/default-user.svg');
  els.fishAvatarPreview.src = mediaSrc(profile.fishAvatar, '/fish-avatar.png');
  els.voiceToggle.checked = Boolean(profile.voiceEnabled);
  els.meAvatar.src = mediaSrc(profile.userAvatar, '/default-user.svg');
  els.meName.textContent = profile.userName || '我';
  if (!els.meNameInput.value) els.meNameInput.value = profile.userName || '我';
  for (const button of els.bgPresets.querySelectorAll('[data-bg]')) {
    button.classList.toggle('active', button.dataset.bg === profile.background);
  }
  for (const button of els.themeSeg.querySelectorAll('[data-theme]')) {
    button.classList.toggle('active', button.dataset.theme === profile.theme);
  }
}

function applyProfile() {
  const profile = state.profile || DEFAULT_PROFILE;
  document.documentElement.dataset.theme = profile.theme === 'dark' ? 'dark' : 'qq';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', profile.theme === 'dark' ? '#071018' : '#f2f4f7');

  const fishAvatar = mediaSrc(profile.fishAvatar, '/fish-avatar.png');
  els.fishAvatarImg.src = fishAvatar;
  els.typingAvatar.src = fishAvatar;
  els.sidebarAvatar.src = fishAvatar;
  els.fishHomeAvatar.src = fishAvatar;
  els.userAvatarPreview.src = mediaSrc(profile.userAvatar, '/default-user.svg');
  els.fishAvatarPreview.src = fishAvatar;
  applyBackground();
  updateProfileControls();
}

async function saveProfile(patch) {
  const data = await api('/api/profile', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
  state.profile = { ...DEFAULT_PROFILE, ...(data.profile || {}) };
  applyProfile();
  render();
  toast('已保存。');
}

/* ── 渲染 ─────────────────────────────────────────────────────────────── */

function render() {
  const el = els.messages;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;

  if (!state.messages.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><img src="/fish-cover.png" alt="" /></div>
        <h2>换了一扇门，还是她</h2>
        <p>你在这里说的话，会进到你在 DSH 里的同一段对话里。<br />人格、记忆都在你自己的服务器上，换手机也不会丢。</p>
      </div>`;
    return;
  }

  const parts = [];
  let lastDay = '';
  for (const message of state.messages) {
    const key = dayKey(message.at);
    if (key && key !== lastDay) {
      parts.push(`<div class="day-divider"><span>${escapeHtml(dayLabel(key))}</span></div>`);
      lastDay = key;
    }

    const isUser = message.role === 'user';
    const classes = ['row', isUser ? 'user' : 'fish'];
    if (message.kind === 'sticker') classes.push('sticker');
    if (message.pending) classes.push('pending');
    if (message.failed) classes.push('failed');
    if (state.highlightId === message.id) classes.push('highlight');

    const avatarUrl = isUser
      ? mediaSrc(state.profile.userAvatar, '/default-user.svg')
      : mediaSrc(state.profile.fishAvatar, '/fish-avatar.png');
    const avatar = `<span class="row-avatar"><img src="${escapeHtml(avatarUrl)}" alt="" /></span>`;
    const retry = message.failed
      ? `<button class="retry-link" type="button" data-retry="${escapeHtml(message.id)}">发送失败，点这里重试</button>`
      : '';
    const time = timeOf(message.at);
    const speak = !isUser && message.text
      ? `<button class="speak-btn" type="button" data-speak="${escapeHtml(message.id)}" aria-label="朗读">🔊</button>`
      : '';

    let mediaHtml = '';
    let caption = message.text ? formatText(message.text) : '';
    if (caption === '（发来一张图片）') caption = '';
    if (message.kind === 'sticker') caption = '';
    if (message.media?.url) {
      const src = `${message.media.url}?token=${encodeURIComponent(state.token)}`;
      const cls = message.kind === 'sticker' ? 'msg-sticker' : 'msg-image';
      mediaHtml = `<img class="${cls}" src="${escapeHtml(src)}" alt="${message.kind === 'sticker' ? '表情' : '图片'}" loading="lazy" data-full="${escapeHtml(src)}" />`;
    }
    const bubbleClass = message.media ? 'bubble image-bubble' : 'bubble';

    parts.push(`
      <div class="${classes.join(' ')}" data-id="${escapeHtml(message.id)}">
        ${avatar}
        <div class="${bubbleClass}">${mediaHtml}${caption ? `<span class="msg-caption">${caption}</span>` : ''}<span class="msg-time">${escapeHtml(time)}${speak}</span>${retry}</div>
      </div>`);
  }

  el.innerHTML = parts.join('');
  if (nearBottom) scrollToBottom(true);
}

function upsert(message) {
  if (!message || !message.id) return;

  // 服务端回执带着 clientId：把乐观插入的那条替换掉。
  if (message.clientId) {
    const temp = state.messages.find((m) => m.clientId && m.clientId === message.clientId);
    if (temp) {
      Object.assign(temp, message, { pending: false, failed: false });
      render();
      scrollToBottom();
      return;
    }
  }

  const existing = state.messages.find((m) => m.id === message.id);
  if (existing) {
    Object.assign(existing, message, { pending: false, failed: false });
    render();
    return;
  }

  state.messages.push({ ...message, pending: false, failed: false });
  render();
  scrollToBottom();
  maybeAutoSpeak({ ...message, pending: false, failed: false });
}

function updateInfo() {
  const info = state.info || {};
  els.infoVersion.textContent = info.version ? `v${info.version}` : '—';
  els.infoBridge.textContent = info.bridge?.token ? '已读取桥接令牌' : '缺少桥接令牌';
  els.infoToken.textContent = state.token
    ? `••••••${state.token.slice(-4)}`
    : '—';
  els.infoCount.textContent = `${state.messages.length} 条`;
}

/* ── API ──────────────────────────────────────────────────────────────── */

async function api(path, options = {}) {
  const headers = {
    authorization: `Bearer ${state.token}`,
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(path, { ...options, headers });
  let data;
  try { data = await response.json(); }
  catch { data = { ok: false, error: `HTTP ${response.status}` }; }
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function bootstrap() {
  const data = await api('/api/bootstrap');
  state.info = data;
  state.profile = { ...DEFAULT_PROFILE, ...(data.profile || {}) };
  state.messages = Array.isArray(data.messages) ? data.messages : [];
  if (data.fish?.name) els.fishName.textContent = data.fish.name;
  applyProfile();
  setConnected(true);
  pollFailures = 0;
  render();
  updateInfo();
  scrollToBottom(true);
  return data;
}

async function submit(text, options = {}) {
  const media = options.media || state.pendingMedia || null;
  const body = String(text || '').trim();
  if ((!body && !media) || state.sending || state.uploading) return;
  const kind = options.kind || media?.kind || 'image';

  state.failedText = body;
  state.failedMedia = media;
  hideError();

  const clientId = uuid();
  const temp = {
    id: `tmp_${clientId}`,
    clientId,
    role: 'user',
    kind: media ? kind : 'text',
    text: body,
    media: media ? { id: media.id, url: media.url, mime: media.mime, size: media.size } : null,
    at: new Date().toISOString(),
    pending: true,
  };

  state.messages.push(temp);
  els.input.value = '';
  autoGrow();
  setSending(true, media ? kind : 'text');
  render();
  scrollToBottom(true);

  try {
    const data = await api('/api/send', {
      method: 'POST',
      body: JSON.stringify({
        text: body,
        clientId,
        ...(media ? { mediaId: media.id, kind } : {}),
      }),
    });
    upsert(data.user);
    upsert(data.fish);
    updateInfo();
    hideError();
    if (media) clearPendingMedia();
    if (data.sentByTool) {
      toast('她好像顺手在桥接那边也回了一句；如果不想这样，下次把话说得更“只在这里聊”。');
    }
  } catch (error) {
    const failed = state.messages.find((m) => m.clientId === clientId);
    if (failed) {
      failed.pending = false;
      failed.failed = true;
    }
    render();
    showError(error.message || '发送失败', body, media);
  } finally {
    setSending(false);
    render();
    updateSendButton();
  }
}

function showError(message, text, media = null) {
  state.failedText = text || '';
  state.failedMedia = media;
  els.errorText.textContent = message;
  els.errorBar.classList.remove('hidden');
}

function hideError() {
  els.errorBar.classList.add('hidden');
}

function retryFailed(id) {
  const message = state.messages.find((m) => m.id === id);
  if (!message) return;
  state.messages = state.messages.filter((m) => m.id !== id);
  render();
  submit(message.text, { media: message.media, kind: message.kind });
}

/* ── SSE ──────────────────────────────────────────────────────────────── */

function connectEvents() {
  if (state.es) {
    state.es.close();
    state.es = null;
  }
  if (!state.token) return;

  const es = new EventSource(`/api/events?token=${encodeURIComponent(state.token)}`);
  state.es = es;

  es.onopen = () => {
    state.sseOk = true;
    setConnected(true);
  };
  es.onerror = () => {
    // 公网隧道可能缓冲 SSE；不要因此判“离线”，轮询会兜底。
    state.sseOk = false;
  };
  es.addEventListener('hello', () => {
    state.sseOk = true;
    setConnected(true);
  });
  es.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload?.message) upsert(payload.message);
    } catch {
      /* 忽略坏帧 */
    }
  });
}

/* 公网隧道下 SSE 可能被反代缓冲；每 15 秒补一次历史，保证不会“看不到她的回复”。 */
function mergeServerMessages(list) {
  if (!Array.isArray(list) || !list.length) return false;
  let changed = false;
  for (const message of list) {
    if (!message || !message.id) continue;
    const existing = state.messages.find((m) => m.id === message.id);
    if (existing) {
      if (existing.text !== message.text) {
        existing.text = message.text;
        changed = true;
      }
      continue;
    }
    // 不覆盖还在发送中的乐观消息
    if (message.clientId && state.messages.some((m) => m.clientId === message.clientId)) continue;
    state.messages.push({ ...message, pending: false, failed: false });
    changed = true;
  }
  if (changed) {
    state.messages.sort((a, b) => new Date(a.at) - new Date(b.at));
    render();
    updateInfo();
  }
  return changed;
}

setInterval(async () => {
  if (!state.token || state.sending || document.visibilityState !== 'visible') return;
  try {
    const data = await api('/api/bootstrap');
    pollFailures = 0;
    setConnected(true);
    mergeServerMessages(data.messages);
  } catch {
    pollFailures += 1;
    if (pollFailures >= 3) setConnected(false);
    /* 网络不好时静默；下一轮再试 */
  }
}, 15_000);

/* ── 图片 / 表情 ──────────────────────────────────────────────────────── */

function clearPendingMedia() {
  state.pendingMedia = null;
  els.pendingPreview.classList.add('hidden');
  els.pendingImage.removeAttribute('src');
  els.pendingTitle.textContent = '图片';
  els.pendingStatus.textContent = '已就绪';
  updateSendButton();
  requestAnimationFrame(() => scrollToBottom(true));
}

function showPendingMedia(media, localUrl = '') {
  state.pendingMedia = media;
  els.pendingPreview.classList.remove('hidden');
  els.pendingImage.src = localUrl || media.url;
  els.pendingTitle.textContent = media.kind === 'sticker' ? '表情' : '图片';
  const size = Number(media.size) || 0;
  els.pendingStatus.textContent = size
    ? `${Math.max(1, Math.round(size / 1024))} KB · 已就绪`
    : '已就绪';
  updateSendButton();
  requestAnimationFrame(() => scrollToBottom(true));
}

async function compressImage(file, options = {}) {
  const bitmap = await createImageBitmap(file);
  const max = Number(options.max) || 1024;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const limit = Number(options.maxBytes) || 880_000;
  let quality = Number(options.quality) || 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > limit && quality > 0.42) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > limit) {
    throw new Error('这张图压不小，换一张小一点的吧。');
  }
  return dataUrl;
}

async function uploadDataUrl(dataUrl) {
  return api('/api/media', {
    method: 'POST',
    body: JSON.stringify({ dataUrl }),
  });
}

async function handleFile(file) {
  if (!file || !String(file.type || '').startsWith('image/') || state.uploading) return;
  state.uploading = true;
  updateSendButton();
  const localUrl = URL.createObjectURL(file);
  showPendingMedia({ kind: 'image', size: file.size }, localUrl);
  els.pendingStatus.textContent = '正在压缩…';
  try {
    const dataUrl = await compressImage(file);
    els.pendingStatus.textContent = '正在上传…';
    const media = await uploadDataUrl(dataUrl);
    showPendingMedia({ ...media, kind: 'image' }, dataUrl);
  } catch (error) {
    clearPendingMedia();
    showError(error.message || '图片处理失败。', '');
  } finally {
    state.uploading = false;
    updateSendButton();
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败。'));
    reader.readAsDataURL(blob);
  });
}

async function loadStickers() {
  if (state.stickers.length) return state.stickers;
  const data = await api('/api/stickers');
  state.stickers = Array.isArray(data.stickers) ? data.stickers : [];
  els.stickerGrid.innerHTML = state.stickers.map((sticker) => `
    <button class="sticker-item" type="button" data-sticker="${escapeHtml(sticker.id)}">
      <img src="${escapeHtml(sticker.file)}" alt="${escapeHtml(sticker.label)}" loading="lazy" />
      <span>${escapeHtml(sticker.label)}</span>
    </button>`).join('');
  return state.stickers;
}

async function sendSticker(sticker) {
  if (!sticker || state.sending || state.uploading) return;
  els.stickerPanel.classList.add('hidden');
  try {
    let media = state.stickerUploaded.get(sticker.file);
    if (!media) {
      state.uploading = true;
      updateSendButton();
      const response = await fetch(mediaSrc(sticker.file), {
        headers: { authorization: `Bearer ${state.token}` },
      });
      if (!response.ok) throw new Error('表情图片加载失败。');
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      media = await uploadDataUrl(dataUrl);
      state.stickerUploaded.set(sticker.file, media);
    }
    state.uploading = false;
    updateSendButton();
    submit(sticker.custom ? sticker.label : `[表情：${sticker.label}]`, {
      media: { ...media, kind: 'sticker' },
      kind: 'sticker',
    });
  } catch (error) {
    showError(error.message || '表情发送失败。', '');
  } finally {
    state.uploading = false;
    updateSendButton();
  }
}

/* ── 表情 / 图片库 / 我的主页 ───────────────────────────────────── */

async function loadLibrary(force = false) {
  if (state.libraryItems.length && !force) return state.libraryItems;
  const data = await api('/api/library');
  state.libraryItems = Array.isArray(data.items) ? data.items : [];
  if (data.storage) els.libraryNote.textContent = `存储位置：${data.storage}`;
  renderLibrary();
  renderMeStickers();
  return state.libraryItems;
}

function libraryItemHtml(item, compact = false) {
  const label = escapeHtml(item.label || (item.kind === 'sticker' ? '表情' : '图片'));
  return `
    <div class="library-item" data-library-id="${escapeHtml(item.id)}" data-library-kind="${escapeHtml(item.kind)}">
      <img src="${escapeHtml(mediaSrc(item.url))}" alt="${label}" loading="lazy" />
      ${compact ? '' : `<span class="library-label">${label}</span>`}
      <button class="library-del" type="button" data-delete-library="${escapeHtml(item.kind)}:${escapeHtml(item.id)}" aria-label="删除">×</button>
    </div>`;
}

function renderLibrary() {
  const items = state.libraryItems.filter((item) => item.kind === state.libraryKind);
  els.libraryGrid.innerHTML = items.length
    ? items.map((item) => libraryItemHtml(item)).join('')
    : `<div class="library-empty">这里还没有${state.libraryKind === 'sticker' ? '表情' : '图片'}，上传一张，或让她上网找。</div>`;
  for (const button of els.libraryTabs.querySelectorAll('[data-kind]')) {
    button.classList.toggle('active', button.dataset.kind === state.libraryKind);
  }
}

function renderMeStickers() {
  const items = state.libraryItems.filter((item) => item.kind === 'sticker');
  els.meStickerGrid.innerHTML = items.length
    ? items.map((item) => libraryItemHtml(item, true)).join('')
    : '<div class="library-empty">还没有自己的表情，点右上角添加。</div>';
}

function openLibrary() {
  closeSidebar();
  closeHistory();
  closeMeHome();
  closeFishHome();
  els.stickerPanel.classList.add('hidden');
  els.libraryHome.classList.remove('hidden');
  loadLibrary(true).catch((error) => toast(error.message || '表情库读取失败'));
  try { history.pushState({ overlay: 'library' }, ''); } catch {}
}

function closeLibraryHome() {
  els.libraryHome.classList.add('hidden');
}

function openMeHome() {
  closeSidebar();
  closeLibraryHome();
  closeHistory();
  closeFishHome();
  els.stickerPanel.classList.add('hidden');
  els.meHome.classList.remove('hidden');
  updateProfileControls();
  loadLibrary(true)
    .then(() => {
      els.meAvatar.src = mediaSrc(state.profile.userAvatar, '/default-user.svg');
      els.meName.textContent = state.profile.userName || '我';
      els.meNameInput.value = state.profile.userName || '我';
    })
    .catch((error) => toast(error.message || '读取失败'));
  try { history.pushState({ overlay: 'me' }, ''); } catch {}
}

function closeMeHome() {
  els.meHome.classList.add('hidden');
}

async function handleStickerFile(file, kind = 'sticker') {
  if (!file) return;
  try {
    const dataUrl = await compressImage(file, { max: 512, quality: 0.9, maxBytes: 700_000 });
    await api('/api/library', {
      method: 'POST',
      body: JSON.stringify({
        dataUrl,
        kind: kind === 'image' ? 'image' : 'sticker',
        label: file.name.replace(/\.[^.]+$/, '').slice(0, 20) || (kind === 'image' ? '新图片' : '新表情'),
        source: 'user-upload',
      }),
    });
    state.stickers = [];
    await loadLibrary(true);
    toast(kind === 'image' ? '已加入图片库。' : '已加入表情库。');
  } catch (error) {
    showError(error.message || '添加失败。', '');
  }
}

async function deleteLibraryItem(key) {
  const [kind, id] = String(key || '').split(':');
  if (!kind || !id) return;
  try {
    await api(`/api/library/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadLibrary(true);
    state.stickers = [];
    toast('已从库里删除。');
  } catch (error) {
    showError(error.message || '删除失败。', '');
  }
}

async function sendLibraryItem(item) {
  if (!item || state.sending || state.uploading) return;
  try {
    state.uploading = true;
    updateSendButton();
    const response = await fetch(mediaSrc(item.url), {
      headers: { authorization: `Bearer ${state.token}` },
    });
    if (!response.ok) throw new Error('图片读取失败。');
    const dataUrl = await blobToDataUrl(await response.blob());
    const media = await uploadDataUrl(dataUrl);
    closeLibraryHome();
    submit(item.kind === 'sticker' ? item.label : `[图片：${item.label}]`, {
      media: { ...media, kind: item.kind },
      kind: item.kind,
    });
  } catch (error) {
    showError(error.message || '发送失败。', '');
  } finally {
    state.uploading = false;
    updateSendButton();
  }
}

async function collectFromUrl() {
  const url = els.libraryUrl.value.trim();
  if (!url) return;
  try {
    await api('/api/library/collect', {
      method: 'POST',
      body: JSON.stringify({ url, kind: state.libraryKind, label: '收藏图片' }),
    });
    els.libraryUrl.value = '';
    state.stickers = [];
    await loadLibrary(true);
    toast('已收藏。');
  } catch (error) {
    showError(error.message || '收藏失败。', '');
  }
}

async function askFishForImages() {
  const query = (prompt('想让她找什么类型的表情？例如：猫猫、无语、晚安') || '').trim();
  if (!query) return;
  els.libraryAsk.disabled = true;
  els.libraryAsk.textContent = '她在找…';
  try {
    const data = await api('/api/library/request', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    await loadLibrary(true);
    state.stickers = [];
    toast(data.added?.length ? `她收了 ${data.added.length} 张图。` : (data.reply || '这次没找到合适的。'));
  } catch (error) {
    showError(error.message || '她这次没找到。', '');
  } finally {
    els.libraryAsk.disabled = false;
    els.libraryAsk.textContent = '让她联网找';
  }
}

/* ── 她的声音 / 语音输入 ─────────────────────────────────────── */

async function playVoiceForMessage(message) {
  if (!message?.text || state.voiceBusy) return;
  state.voiceBusy = true;
  try {
    const data = await api('/api/tts', {
      method: 'POST',
      body: JSON.stringify({ text: message.text.slice(0, 600) }),
    });
    if (!data.url) throw new Error('没有生成语音。');
    if (state.voiceAudio) {
      try { state.voiceAudio.pause(); } catch {}
    }
    const audio = new Audio(`${data.url}?token=${encodeURIComponent(state.token)}`);
    state.voiceAudio = audio;
    const row = els.messages.querySelector(`[data-id="${CSS.escape(message.id)}"] .speak-btn`);
    if (row) row.classList.add('playing');
    audio.onended = () => { if (row) row.classList.remove('playing'); };
    audio.onerror = () => { if (row) row.classList.remove('playing'); };
    await audio.play();
  } catch (error) {
    toast(error.message || '语音播放失败；点消息上的小喇叭再试。');
  } finally {
    state.voiceBusy = false;
  }
}

function maybeAutoSpeak(message) {
  if (!state.profile.voiceEnabled || !message || message.role !== 'fish' || !message.text) return;
  setTimeout(() => playVoiceForMessage(message), 150);
}

window.FishNativeVoice = (text) => {
  const value = String(text || '').trim();
  if (!value) return;
  els.input.value = value;
  autoGrow();
  updateSendButton();
  els.input.focus();
  toast('听到了，点发送就行。');
};

function toggleVoiceInput() {
  try {
    if (window.FishNative?.startVoiceInput) {
      window.FishNative.startVoiceInput();
      return;
    }
  } catch {}
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast('这个浏览器不支持语音输入；可以打字，或换 Chrome/Edge。');
    return;
  }
  if (state.recording && state.recognition) {
    try { state.recognition.stop(); } catch {}
    return;
  }
  const recognition = new Recognition();
  state.recognition = recognition;
  recognition.lang = 'zh-CN';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => {
    state.recording = true;
    els.voiceInputBtn.classList.add('voice-recording');
    els.input.placeholder = '正在听…';
  };
  recognition.onresult = (event) => {
    let text = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      text += event.results[i][0].transcript;
    }
    els.input.value = text;
    autoGrow();
    updateSendButton();
  };
  recognition.onerror = (event) => {
    if (event.error !== 'aborted') toast(`语音输入失败：${event.error}`);
  };
  recognition.onend = () => {
    state.recording = false;
    els.voiceInputBtn.classList.remove('voice-recording');
    els.input.placeholder = '发消息…';
    state.recognition = null;
    els.input.focus();
  };
  try { recognition.start(); } catch (error) {
    toast(error.message || '麦克风启动失败。');
  }
}

function openLightbox(src) {
  els.lightboxImg.src = src;
  els.lightbox.classList.remove('hidden');
}

function closeLightbox() {
  els.lightbox.classList.add('hidden');
  els.lightboxImg.removeAttribute('src');
}

/* ── 侧边栏 / 她的主页 ─────────────────────────────────────────────── */

function openSidebar() {
  els.sidebar.classList.remove('hidden');
  els.sidebarBackdrop.classList.remove('hidden');
  try { history.pushState({ overlay: 'sidebar' }, ''); } catch {}
}

function closeSidebar() {
  els.sidebar.classList.add('hidden');
  els.sidebarBackdrop.classList.add('hidden');
}

function openFishHome() {
  closeSidebar();
  els.fishHome.classList.remove('hidden');
  loadFishHome();
  try { history.pushState({ overlay: 'fish-home' }, ''); } catch {}
}

function closeFishHome() {
  els.fishHome.classList.add('hidden');
}

/* ── 聊天记录（翻回以前说过的话） ───────────────────────────────── */

function openHistory() {
  closeSidebar();
  closeFishHome();
  closeMeHome();
  closeLibraryHome();
  els.stickerPanel.classList.add('hidden');
  els.historyHome.classList.remove('hidden');
  els.historySearch.value = '';
  state.historyItems = [];
  state.historyBefore = '';
  state.historyQuery = '';
  state.historyHasMore = false;
  loadHistory(true);
  try { history.pushState({ overlay: 'history' }, ''); } catch {}
}

function closeHistory() {
  els.historyHome.classList.add('hidden');
}

function renderHistory() {
  const list = state.historyItems;
  els.historyCount.textContent = `${state.historyItems.length} 条`;
  if (!list.length) {
    els.historyList.innerHTML = '<div class="history-empty">没有找到以前的话。</div>';
    els.historyMore.classList.add('hidden');
    return;
  }
  const parts = [];
  let lastDay = '';
  for (const message of list) {
    const key = dayKey(message.at);
    if (key && key !== lastDay) {
      parts.push(`<div class="history-day">${escapeHtml(dayLabel(key))}</div>`);
      lastDay = key;
    }
    const role = message.role === 'user' ? '我' : '大肥鱼';
    const text = String(message.text || '').trim();
    const preview = text.length > 220 ? `${text.slice(0, 220)}…` : text;
    const media = message.media?.url
      ? `<img class="history-media" src="${escapeHtml(mediaSrc(message.media.url))}" alt="" loading="lazy" />`
      : '';
    parts.push(`
      <div class="history-item" data-history-id="${escapeHtml(message.id)}">
        <div class="history-top"><span>${escapeHtml(role)}</span><span>${escapeHtml(timeOf(message.at))}</span></div>
        ${preview ? `<div class="history-text">${escapeHtml(preview)}</div>` : ''}
        ${media}
      </div>`);
  }
  els.historyList.innerHTML = parts.join('');
  els.historyMore.classList.toggle('hidden', !state.historyHasMore || Boolean(state.historyQuery));
}

async function loadHistory(reset = false) {
  if (state.historyLoading) return;
  state.historyLoading = true;
  els.historyMore.textContent = '加载中…';
  try {
    const query = reset ? els.historySearch.value.trim() : state.historyQuery;
    if (reset) {
      state.historyItems = [];
      state.historyBefore = '';
      state.historyQuery = query;
    }
    let data;
    if (query) {
      data = await api(`/api/messages/search?q=${encodeURIComponent(query)}&limit=50`);
      state.historyItems = data.messages || [];
      state.historyHasMore = false;
    } else {
      const before = reset ? '' : state.historyBefore;
      data = await api(`/api/messages/page?limit=40${before ? `&before=${encodeURIComponent(before)}` : ''}`);
      const page = data.messages || [];
      state.historyItems = reset ? page : [...page, ...state.historyItems];
      state.historyBefore = page[0]?.id || state.historyBefore;
      state.historyHasMore = Boolean(data.hasMore);
    }
    renderHistory();
  } catch (error) {
    els.historyList.innerHTML = `<div class="history-empty">读取失败：${escapeHtml(error.message || '未知错误')}</div>`;
  } finally {
    state.historyLoading = false;
    els.historyMore.textContent = '加载更早';
  }
}

async function jumpHistory(id) {
  try {
    const data = await api(`/api/messages/around?id=${encodeURIComponent(id)}`);
    state.messages = data.messages || [];
    state.highlightId = id;
    closeHistory();
    render();
    updateInfo();
    const row = els.messages.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (row) {
      row.scrollIntoView({ block: 'center' });
      setTimeout(() => {
        state.highlightId = '';
        render();
      }, 2200);
    }
  } catch (error) {
    showError(error.message || '找不到这条消息。', '');
  }
}

function money(value, currency = 'CNY', digits = 2) {
  const symbol = currency === 'CNY' ? '¥' : (currency === 'USD' ? '$' : `${currency} `);
  return `${symbol}${Number(value || 0).toFixed(digits)}`;
}

function timeText(iso) {
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function renderFishChart(daily) {
  const list = Array.isArray(daily) ? daily : [];
  const max = Math.max(...list.map((item) => Number(item.cost) || 0), 0.01);
  if (!list.length || list.every((item) => !(Number(item.cost) > 0))) {
    els.fishChart.innerHTML = '<div class="fish-chart-empty">近 7 天还没有花费</div>';
    els.fishChartLabels.textContent = '';
    return;
  }
  els.fishChart.innerHTML = list.map((item, index) => {
    const cost = Number(item.cost) || 0;
    const today = index === list.length - 1;
    return `
      <div class="fish-bar-wrap">
        <div class="fish-bar${today ? ' today' : ''}" data-cost="${cost}">
          <b>${cost > 0 ? cost.toFixed(1) : ''}</b>
        </div>
        <em>${escapeHtml(String(item.date || '').slice(5))}</em>
      </div>`;
  }).join('');
  const bars = els.fishChart.querySelectorAll('.fish-bar');
  bars.forEach((bar) => {
    const cost = Number(bar.dataset.cost) || 0;
    bar.style.height = `${Math.max(3, Math.round((cost / max) * 82))}px`;
  });
  els.fishChartLabels.textContent = '';
}

async function loadFishHome() {
  els.fishError.classList.add('hidden');
  els.fishBalance.textContent = '读取中…';
  els.fishToday.textContent = '—';
  els.fish7d.textContent = '—';
  try {
    const data = await api('/api/fish/home');
    state.fishHomeLoaded = true;
    if (data.name) els.fishHomeName.textContent = data.name;
    els.fishHomeAvatar.src = mediaSrc(data.avatar, '/fish-avatar.png');
    els.fishSignature.textContent = data.signature || '今天也在好好过日子。';
    if (data.balance) {
      els.fishBalance.textContent = money(data.balance.total, data.balance.currency);
      els.fishTotalCost.textContent = money(data.balance.totalCosts, data.balance.currency);
    } else {
      els.fishBalance.textContent = '读取失败';
      els.fishTotalCost.textContent = '—';
    }
    els.fishToday.textContent = money(data.todayCost, data.balance?.currency || 'CNY');
    els.fish7d.textContent = money(data.spend7d, data.balance?.currency || 'CNY');
    els.fishMonthCost.textContent = `本月 ${money(data.monthCost, data.balance?.currency || 'CNY')}`;
    els.fishUpdated.textContent = timeText(data.updatedAt);
    renderFishChart(data.daily);
    if (data.available === false && data.error) {
      els.fishError.textContent = data.error;
      els.fishError.classList.remove('hidden');
    }
  } catch (error) {
    state.fishHomeLoaded = true;
    els.fishBalance.textContent = '读取失败';
    els.fishError.textContent = error.message || '余额读取失败。';
    els.fishError.classList.remove('hidden');
    renderFishChart([]);
  }
}

/* ── 设置：头像 / 背景 / 主题 ─────────────────────────────────────────── */

function pickAvatar(target) {
  state.avatarTarget = target === 'fish' ? 'fish' : 'user';
  els.avatarFileInput.value = '';
  els.avatarFileInput.click();
}

async function handleAvatarFile(file) {
  if (!file) return;
  try {
    const dataUrl = await compressImage(file, { max: 512, quality: 0.9, maxBytes: 600_000 });
    const media = await uploadDataUrl(dataUrl);
    const patch = state.avatarTarget === 'fish'
      ? { fishAvatar: media.url }
      : { userAvatar: media.url };
    await saveProfile(patch);
  } catch (error) {
    showError(error.message || '头像更换失败。', '');
  }
}

async function handleBackgroundFile(file) {
  if (!file) return;
  try {
    const dataUrl = await compressImage(file, { max: 1600, quality: 0.78, maxBytes: 880_000 });
    const media = await uploadDataUrl(dataUrl);
    await saveProfile({ background: media.url });
  } catch (error) {
    showError(error.message || '背景更换失败。', '');
  }
}

function openMessageMenu(message) {
  if (!message) return;
  state.menuTarget = message;
  els.messageMenu.classList.remove('hidden');
  els.messageMenuBackdrop.classList.remove('hidden');
}

function closeMessageMenu() {
  state.menuTarget = null;
  els.messageMenu.classList.add('hidden');
  els.messageMenuBackdrop.classList.add('hidden');
}

async function copyMessage(text) {
  const value = String(text || '').trim();
  if (!value) {
    toast('这条没有可复制的文字。');
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast('已复制。');
  } catch {
    toast('复制失败，长按文字手动复制吧。');
  }
}

/* ── 输入 ─────────────────────────────────────────────────────────────── */

function autoGrow() {
  const el = els.input;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
}

function updateSendButton() {
  els.sendBtn.disabled = state.sending || state.uploading || (!els.input.value.trim() && !state.pendingMedia);
}

function onInput() {
  autoGrow();
  updateSendButton();
}

/* ── 登录 / 启动 ──────────────────────────────────────────────────────── */

function showLogin(message = '') {
  els.chat.classList.add('hidden');
  els.login.classList.remove('hidden');
  els.loginError.textContent = message;
  els.tokenInput.value = '';
  setTimeout(() => els.tokenInput.focus(), 50);
}

function readTokenFromUrl() {
  const url = new URL(location.href);
  const token = url.searchParams.get('token');
  if (!token) return '';
  localStorage.setItem(STORAGE_KEY, token);
  url.searchParams.delete('token');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return token;
}

async function start() {
  els.login.classList.add('hidden');
  els.chat.classList.remove('hidden');
  try {
    await bootstrap();
    connectEvents();
    updateInfo();
    setTimeout(() => els.input.focus(), 80);
  } catch (error) {
    if (error.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      state.token = '';
      showLogin('令牌不对，再试一次。');
      return;
    }
    showError(error.message || '连不上电脑上的服务。', '');
    setConnected(false);
  }
}

async function login() {
  const token = els.tokenInput.value.trim();
  if (!token) {
    els.loginError.textContent = '先填令牌。';
    return;
  }
  els.loginBtn.disabled = true;
  els.loginError.textContent = '';
  state.token = token;
  localStorage.setItem(STORAGE_KEY, token);
  try {
    await start();
    if (els.chat.classList.contains('hidden')) {
      // start() 内部处理了 401；这里不再重复。
    }
  } finally {
    els.loginBtn.disabled = false;
  }
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
  state.token = '';
  if (state.es) {
    state.es.close();
    state.es = null;
  }
  state.messages = [];
  state.pendingMedia = null;
  state.profile = { ...DEFAULT_PROFILE };
  state.stickerUploaded.clear();
  document.documentElement.dataset.theme = 'qq';
  clearPendingMedia();
  els.stickerPanel.classList.add('hidden');
  closeLightbox();
  closeSidebar();
  closeFishHome();
  closeHistory();
  closeMeHome();
  closeLibraryHome();
  closeSheet();
  showLogin('已清除这台手机的令牌。');
}

/* ── 面板 ─────────────────────────────────────────────────────────────── */

function openSheet() {
  updateInfo();
  updateProfileControls();
  els.sheet.classList.remove('hidden');
  els.sheetBackdrop.classList.remove('hidden');
  api('/api/profile')
    .then((data) => {
      state.profile = { ...DEFAULT_PROFILE, ...(data.profile || {}) };
      applyProfile();
      render();
    })
    .catch(() => {});
  api('/api/remote')
    .then((data) => {
      els.infoRemote.textContent = data.url || '未启动（运行 start-remote.ps1）';
    })
    .catch(() => {
      els.infoRemote.textContent = '读取失败';
    });
}

function closeSheet() {
  els.sheet.classList.add('hidden');
  els.sheetBackdrop.classList.add('hidden');
}

/* ── 事件绑定 ─────────────────────────────────────────────────────────── */

els.loginBtn.addEventListener('click', login);
els.tokenInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') login();
});

els.backBtn.addEventListener('click', openSidebar);
els.sidebarBackdrop.addEventListener('click', closeSidebar);
els.sidebarHome.addEventListener('click', openFishHome);
els.sidebarMe.addEventListener('click', openMeHome);
els.sidebarHistory.addEventListener('click', openHistory);
els.sidebarLibrary.addEventListener('click', openLibrary);
els.sidebarBackground.addEventListener('click', () => {
  closeSidebar();
  openSheet();
});
els.sidebarTheme.addEventListener('click', () => {
  closeSidebar();
  const next = state.profile.theme === 'dark' ? 'qq' : 'dark';
  saveProfile({ theme: next }).catch((error) => showError(error.message, ''));
});
els.sidebarSettings.addEventListener('click', () => {
  closeSidebar();
  openSheet();
});
els.sidebarAbout.addEventListener('click', () => {
  closeSidebar();
  toast('大肥鱼手机端 z0.1.0 · 私有版');
});

els.fishHomeBack.addEventListener('click', closeFishHome);
els.fishHomeMore.addEventListener('click', () => {
  closeFishHome();
  openSheet();
});
els.fishRefresh.addEventListener('click', loadFishHome);
window.addEventListener('popstate', () => {
  closeSidebar();
  closeFishHome();
  closeHistory();
  closeMeHome();
  closeLibraryHome();
  closeSheet();
  closeMessageMenu();
});

els.historyBack.addEventListener('click', closeHistory);
els.historySearchBtn.addEventListener('click', () => loadHistory(true));
els.historySearch.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loadHistory(true);
});
els.historyMore.addEventListener('click', () => loadHistory(false));
els.historyList.addEventListener('click', (event) => {
  const item = event.target.closest('[data-history-id]');
  if (item) jumpHistory(item.dataset.historyId);
});

els.meBack.addEventListener('click', closeMeHome);
els.meSettings.addEventListener('click', () => {
  closeMeHome();
  openSheet();
});
els.meAvatarBtn.addEventListener('click', () => pickAvatar('user'));
els.meNameSave.addEventListener('click', async () => {
  try {
    await saveProfile({ userName: els.meNameInput.value.trim().slice(0, 20) || '我' });
    els.meName.textContent = state.profile.userName;
  } catch (error) {
    showError(error.message || '保存失败。', '');
  }
});
els.meStickerUpload.addEventListener('click', () => {
  state.libraryUploadKind = 'sticker';
  els.stickerFileInput.value = '';
  els.stickerFileInput.click();
});

els.libraryBack.addEventListener('click', closeLibraryHome);
els.libraryUploadBtn.addEventListener('click', () => {
  state.libraryUploadKind = state.libraryKind;
  els.stickerFileInput.value = '';
  els.stickerFileInput.click();
});
els.libraryTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-kind]');
  if (!button) return;
  state.libraryKind = button.dataset.kind === 'image' ? 'image' : 'sticker';
  renderLibrary();
});
els.libraryImport.addEventListener('click', collectFromUrl);
els.libraryUrl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') collectFromUrl();
});
els.libraryAsk.addEventListener('click', askFishForImages);
els.libraryGrid.addEventListener('click', (event) => {
  const del = event.target.closest('[data-delete-library]');
  if (del) {
    deleteLibraryItem(del.dataset.deleteLibrary);
    return;
  }
  const item = event.target.closest('[data-library-id]');
  if (!item) return;
  const found = state.libraryItems.find((entry) => entry.id === item.dataset.libraryId && entry.kind === item.dataset.libraryKind);
  if (found) sendLibraryItem(found);
});
els.meStickerGrid.addEventListener('click', (event) => {
  const del = event.target.closest('[data-delete-library]');
  if (del) {
    deleteLibraryItem(del.dataset.deleteLibrary);
    return;
  }
  const item = event.target.closest('[data-library-id]');
  if (!item) return;
  const found = state.libraryItems.find((entry) => entry.id === item.dataset.libraryId && entry.kind === item.dataset.libraryKind);
  if (found) sendLibraryItem(found);
});
els.stickerFileInput.addEventListener('change', () => {
  const file = els.stickerFileInput.files?.[0];
  els.stickerFileInput.value = '';
  if (file) handleStickerFile(file, state.libraryUploadKind);
});

els.userAvatarBtn.addEventListener('click', () => pickAvatar('user'));
els.fishAvatarBtn.addEventListener('click', () => pickAvatar('fish'));
els.avatarFileInput.addEventListener('change', () => {
  const file = els.avatarFileInput.files?.[0];
  els.avatarFileInput.value = '';
  if (file) handleAvatarFile(file);
});
els.bgUploadBtn.addEventListener('click', () => {
  els.bgFileInput.value = '';
  els.bgFileInput.click();
});
els.bgFileInput.addEventListener('change', () => {
  const file = els.bgFileInput.files?.[0];
  els.bgFileInput.value = '';
  if (file) handleBackgroundFile(file);
});
els.bgPresets.addEventListener('click', (event) => {
  const button = event.target.closest('[data-bg]');
  if (!button) return;
  saveProfile({ background: button.dataset.bg }).catch((error) => showError(error.message, ''));
});
els.themeSeg.addEventListener('click', (event) => {
  const button = event.target.closest('[data-theme]');
  if (!button) return;
  saveProfile({ theme: button.dataset.theme }).catch((error) => showError(error.message, ''));
});

els.messageMenuBackdrop.addEventListener('click', closeMessageMenu);
els.messageMenu.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const message = state.menuTarget;
  const action = button.dataset.action;
  closeMessageMenu();
  if (!message) return;
  if (action === 'copy') {
    copyMessage(message.text);
  } else if (action === 'retry') {
    state.messages = state.messages.filter((item) => item.id !== message.id);
    render();
    submit(message.text, { media: message.media, kind: message.kind });
  } else if (action === 'delete') {
    state.messages = state.messages.filter((item) => item.id !== message.id);
    render();
    toast('已在本地删除这条。');
  }
});

let pressTimer = 0;
els.messages.addEventListener('pointerdown', (event) => {
  const row = event.target.closest('.row[data-id]');
  if (!row) return;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    const message = state.messages.find((item) => item.id === row.dataset.id);
    if (message) openMessageMenu(message);
  }, 520);
});
for (const type of ['pointerup', 'pointercancel', 'pointermove']) {
  els.messages.addEventListener(type, () => clearTimeout(pressTimer));
}
els.messages.addEventListener('contextmenu', (event) => {
  const row = event.target.closest('.row[data-id]');
  if (!row) return;
  event.preventDefault();
  const message = state.messages.find((item) => item.id === row.dataset.id);
  if (message) openMessageMenu(message);
});

els.sendBtn.addEventListener('click', () => submit(els.input.value));
els.input.addEventListener('input', onInput);
els.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    submit(els.input.value);
  }
});
els.input.addEventListener('paste', (event) => {
  const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'));
  if (!item) return;
  event.preventDefault();
  handleFile(item.getAsFile());
});

els.attachBtn.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => {
  const file = els.fileInput.files?.[0];
  els.fileInput.value = '';
  if (file) handleFile(file);
});
els.pendingRemove.addEventListener('click', clearPendingMedia);

els.stickerBtn.addEventListener('click', async () => {
  if (!els.stickerPanel.classList.contains('hidden')) {
    els.stickerPanel.classList.add('hidden');
    return;
  }
  try {
    await loadStickers();
    els.stickerPanel.classList.remove('hidden');
  } catch (error) {
    showError(error.message || '表情加载失败。', '');
  }
});
els.stickerClose.addEventListener('click', () => els.stickerPanel.classList.add('hidden'));
els.stickerManage.addEventListener('click', openLibrary);
els.stickerGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-sticker]');
  if (!button) return;
  const sticker = state.stickers.find((item) => item.id === button.dataset.sticker);
  if (sticker) sendSticker(sticker);
});
els.voiceInputBtn.addEventListener('click', toggleVoiceInput);
els.voiceToggle.addEventListener('change', () => {
  saveProfile({ voiceEnabled: els.voiceToggle.checked }).catch((error) => showError(error.message, ''));
});
els.messages.addEventListener('click', (event) => {
  const speak = event.target.closest('[data-speak]');
  if (speak) {
    const message = state.messages.find((item) => item.id === speak.dataset.speak);
    if (message) playVoiceForMessage(message);
    return;
  }
  const image = event.target.closest('[data-full]');
  if (image) {
    openLightbox(image.dataset.full);
    return;
  }
  const button = event.target.closest('[data-retry]');
  if (!button) return;
  retryFailed(button.dataset.retry);
});

els.lightboxClose.addEventListener('click', closeLightbox);
els.lightbox.addEventListener('click', (event) => {
  if (event.target === els.lightbox) closeLightbox();
});

els.errorRetry.addEventListener('click', () => {
  if (!state.failedText && !state.failedMedia) return;
  const text = state.failedText;
  const media = state.failedMedia;
  state.messages = state.messages.filter((m) => !m.failed);
  hideError();
  submit(text, { media, kind: media?.kind || 'text' });
});
els.errorClose.addEventListener('click', hideError);

els.infoBtn.addEventListener('click', openSheet);
els.sheetBackdrop.addEventListener('click', closeSheet);

els.reconnectBtn.addEventListener('click', async () => {
  closeSheet();
  setConnected(false);
  try {
    await bootstrap();
    connectEvents();
    toast('已重新连接。');
  } catch (error) {
    showError(error.message || '重连失败。', '');
  }
});

els.forgetBtn.addEventListener('click', logout);
els.changeServerBtn.addEventListener('click', () => {
  try {
    if (window.FishNative?.openSetup) {
      window.FishNative.openSetup();
      return;
    }
  } catch {}
  toast('浏览器里不能换服务器；在 App 里可以。');
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !state.token) return;
  if (state.sending) return; // 回合还没落地，别用服务端历史覆盖乐观消息
  try {
    await bootstrap();
    if (!state.es || state.es.readyState === EventSource.CLOSED) connectEvents();
  } catch {
    /* 网络不好时静默 */
  }
});

/* ── 启动 ─────────────────────────────────────────────────────────────── */

if ('serviceWorker' in navigator
  && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

(async function boot() {
  const fromUrl = readTokenFromUrl();
  const stored = localStorage.getItem(STORAGE_KEY) || '';
  state.token = fromUrl || stored;

  if (!state.token) {
    showLogin('');
    return;
  }
  await start();
})();
