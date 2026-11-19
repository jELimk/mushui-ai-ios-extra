'use strict';
// 3.4.1: a WeChat-style camera inside the app. Tap the round button for a photo; press and hold it to record a
// video (up to 1 minute, a ring shows the time). Photos go through the same preview as before; videos get their
// own preview and are added as a video attachment. The video is recorded small (about 480p, 0.3 Mbps) so a full
// minute still fits the human-chat attachment limit. If the in-app camera can't open, the old system camera is used.
{
  const LIMIT = 60000, HOLD = 280;
  const systemCamera = actions.openChatCamera;
  let cam = null;
  const stop = () => {
    if (!cam) return;
    try { cam.rec?.state === 'recording' && cam.rec.stop(); } catch {}
    cam.stream?.getTracks().forEach((t) => t.stop());
    clearInterval(cam.tick);
    if (cam.videoUrl) URL.revokeObjectURL(cam.videoUrl);
    cam = null;
  };
  const askPermissions = async () => {
    if (window.AndroidHost && window.Desktop?.invoke) {
      const c = await Desktop.invoke('cameraPermission').catch(() => ({ granted: false }));
      if (!c.granted) throw Error(mzT('請允許相機權限', 'Allow camera access'));
      await call('microphone').catch(() => {});
    }
  };
  const open = async (stream) => {
    const video = document.querySelector('#mzCamVideo'); if (!video) return;
    video.srcObject = stream; video.muted = true;
    await video.play().catch(() => {});
  };
  const getStream = async (facing) => {
    const want = { video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true };
    try { return await navigator.mediaDevices.getUserMedia(want); }
    catch { return await navigator.mediaDevices.getUserMedia({ ...want, audio: false }); }
  };
  const view = () => `<div class="mz-cam">
<video id="mzCamVideo" autoplay playsinline muted></video>
<div class="mz-cam-time" id="mzCamTime" hidden>0:00</div>
<p class="mz-cam-tip" id="mzCamTip">${mzT('點一下拍照，按住錄影（最多 1 分鐘）', 'Tap for a photo, hold to record (up to 1 minute)')}</p>
<div class="mz-cam-row">
<button class="mz-cam-side" type="button" data-action="mzCamClose" aria-label="${mzT('關閉', 'Close')}">✕</button>
<button class="mz-cam-shutter" type="button" id="mzCamShutter" aria-label="${mzT('拍照或錄影', 'Photo or video')}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="mz-cam-track" cx="50" cy="50" r="45"/><circle class="mz-cam-ring" id="mzCamRing" cx="50" cy="50" r="45"/></svg><i></i></button>
<button class="mz-cam-side" type="button" data-action="mzCamFlip" aria-label="${mzT('切換鏡頭', 'Switch camera')}">⟲</button>
</div></div>`;
  actions.openChatCamera = async () => {
    const target = chatId;
    composerMenuOpen = '';
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return systemCamera();
    try {
      await askPermissions();
      stop();
      const stream = await getStream('environment');
      if (chatId !== target) { stream.getTracks().forEach((t) => t.stop()); return; }
      cam = { stream, chat: target, facing: 'environment' };
      showModal(mzT('相機', 'Camera'), view());
      await open(stream);
    } catch (e) {
      stop();
      toast(mzT('App 內相機打不開，改用系統相機', "The in-app camera couldn't open; using the system camera"), 3000);
      return systemCamera();
    }
  };
  actions.mzCamClose = () => { stop(); closeModal(); };
  actions.mzCamFlip = async () => {
    if (!cam || cam.rec) return;
    const facing = cam.facing === 'environment' ? 'user' : 'environment';
    const next = await getStream(facing).catch(() => null); if (!next || !cam) return;
    cam.stream.getTracks().forEach((t) => t.stop());
    cam.stream = next; cam.facing = facing;
    await open(next);
  };
  const photo = () => {
    const v = document.querySelector('#mzCamVideo'); if (!cam || !v?.videoWidth) return;
    const canvas = document.createElement('canvas'), scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
    const g = canvas.getContext('2d');
    if (cam.facing === 'user') { g.translate(canvas.width, 0); g.scale(-1, 1); }
    g.drawImage(v, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.82), chat = cam.chat;
    stop();
    // the existing photo preview (捨棄 / 重拍 / 加入待傳)
    CameraCapture = { stream: null, chat, image };
    actions.backCaptured();
  };
  const mime = () => ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
  const startRec = () => {
    if (!cam || cam.rec) return;
    const type = mime(), chunks = [];
    let rec;
    try { rec = new MediaRecorder(cam.stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 300000, audioBitsPerSecond: 32000 }); }
    catch { rec = new MediaRecorder(cam.stream); }
    cam.rec = rec; cam.recStart = Date.now();
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    rec.onstop = () => { const c = cam; if (!c) return; c.rec = null; clearInterval(c.tick); const blob = new Blob(chunks, { type: rec.mimeType || type || 'video/webm' }); if (Date.now() - c.recStart < 600 || !blob.size) { toast(mzT('錄影太短了', 'Too short')); resetUi(); return; } preview(blob); };
    rec.start(500);
    document.querySelector('.mz-cam')?.classList.add('recording');
    const tip = document.querySelector('#mzCamTip'); if (tip) tip.textContent = mzT('放開就停止', 'Let go to stop');
    const time = document.querySelector('#mzCamTime'); if (time) time.hidden = false;
    const ring = document.querySelector('#mzCamRing'), len = 2 * Math.PI * 45;
    cam.tick = setInterval(() => {
      if (!cam?.rec) return;
      const ms = Date.now() - cam.recStart, s = Math.floor(ms / 1000);
      if (time) time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (ring) ring.style.strokeDashoffset = String(len * (1 - Math.min(1, ms / LIMIT)));
      if (ms >= LIMIT) stopRec();
    }, 100);
  };
  const stopRec = () => { try { cam?.rec?.state === 'recording' && cam.rec.stop(); } catch {} };
  const resetUi = () => {
    document.querySelector('.mz-cam')?.classList.remove('recording');
    const tip = document.querySelector('#mzCamTip'); if (tip) tip.textContent = mzT('點一下拍照，按住錄影（最多 1 分鐘）', 'Tap for a photo, hold to record (up to 1 minute)');
    const time = document.querySelector('#mzCamTime'); if (time) { time.hidden = true; time.textContent = '0:00'; }
    const ring = document.querySelector('#mzCamRing'); if (ring) ring.style.strokeDashoffset = '';
  };
  const preview = (blob) => {
    const c = cam; if (!c) return;
    c.stream.getTracks().forEach((t) => t.stop());
    c.video = blob; c.videoUrl = URL.createObjectURL(blob);
    showModal(mzT('影片預覽', 'Video preview'), `<video class="mz-cam-preview" src="${c.videoUrl}" controls playsinline autoplay></video><p class="help">${mzT('尚未傳送。', 'Not sent yet.')} ${(blob.size / 1048576).toFixed(1)} MB</p><div class="sheet-actions"><button class="pill" data-action="mzCamClose">${mzT('捨棄', 'Discard')}</button><button class="pill" data-action="mzCamRetake">${mzT('重拍', 'Retake')}</button><button class="pill primary" data-action="mzCamUseVideo">${mzT('加入待傳', 'Add to send')}</button></div>`);
  };
  actions.mzCamRetake = async () => { const chat = cam?.chat; stop(); closeModal(); if (chat && chat === chatId) await actions.openChatCamera(); };
  actions.mzCamUseVideo = async () => {
    const c = cam; if (!c?.video) return;
    // plain "video/mp4" / "video/webm": the recorder reports "video/mp4;codecs=avc1", which broke the data URL type
    const ext = /mp4/.test(c.video.type) ? 'mp4' : 'webm';
    const file = new File([c.video], `video-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`, { type: 'video/' + ext });
    stop(); closeModal();
    if (chatId !== c.chat) return;
    try { await addChatAttachment(file); } catch (e) { toast(String(e.message || e), 5000); }
  };
  // hold = record, short tap = photo
  let downAt = 0, holdTimer = 0;
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest?.('#mzCamShutter') || !cam || cam.rec) return;
    e.preventDefault();
    downAt = Date.now();
    holdTimer = setTimeout(() => { holdTimer = 0; startRec(); }, HOLD);
  });
  const release = (e) => {
    if (!downAt) return;
    downAt = 0;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; if (e.type === 'pointerup' && e.target.closest?.('#mzCamShutter')) photo(); return; }
    stopRec();
  };
  for (const t of ['pointerup', 'pointercancel']) document.addEventListener(t, release, true);
  document.addEventListener('contextmenu', (e) => { if (e.target.closest?.('#mzCamShutter')) e.preventDefault(); }, true);
  // closing the sheet any other way stops the camera
  const closeBefore = actions.closeModal;
  actions.closeModal = (...a) => { stop(); return closeBefore(...a); };
  window.addEventListener('pagehide', stop);

  // a video attachment plays right in the chat (it used to be only a "download" button, and on phones a download of
  // in-app data has nowhere to go); older recordings saved as "video/mp4;codecs=…" are fixed when shown
  const playable = (f) => f && !f.mediaRemoved && /^video\//i.test(f.mime || '') && /^data:video\//i.test(f.data || '');
  const inlineVideos = () => {
    for (const b of document.querySelectorAll('.message-file[data-filemessage]:not([data-mzvid])')) {
      b.dataset.mzvid = '1';
      const m = typeof messageById === 'function' ? messageById(b.dataset.filemessage) : null, f = m?.files?.[Number(b.dataset.fileindex)];
      if (!playable(f)) continue;
      const src = f.data.replace(/^data:video\/(mp4|webm)[^;,]*(;codecs=[^;,]*)?/i, 'data:video/$1');
      const v = document.createElement('video');
      v.className = 'mz-chat-video'; v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.src = src;
      b.before(v);
    }
  };
  const renderBefore = render;
  render = function (...a) { const r = renderBefore.apply(this, a); try { inlineVideos(); } catch {} return r; };
  try { new MutationObserver(() => inlineVideos()).observe(document.getElementById('app'), { childList: true, subtree: true }); } catch {}

  const css = document.createElement('style');
  css.textContent = `.mz-chat-video{display:block;width:min(100%,280px);max-height:360px;margin:6px 0 4px;border-radius:14px;background:#000}
.mz-cam{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px}
.mz-cam video{width:100%;max-height:62vh;border-radius:18px;background:#000;object-fit:cover}
.mz-cam-time{position:absolute;top:12px;left:50%;transform:translateX(-50%);padding:4px 12px;border-radius:999px;background:#e5484dcc;color:#fff;font-size:13px;font-variant-numeric:tabular-nums}
.mz-cam-tip{margin:0;font-size:12px;color:var(--muted)}
.mz-cam-row{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:320px}
.mz-cam-side{width:46px;height:46px;border-radius:50%;border:0;background:var(--soft);color:var(--ink);font-size:18px}
.mz-cam-shutter{position:relative;width:84px;height:84px;border:0;padding:0;background:transparent;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.mz-cam-shutter svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.mz-cam-track{fill:none;stroke:#ffffffb3;stroke-width:7}
.mz-cam-ring{fill:none;stroke:var(--accent);stroke-width:7;stroke-linecap:round;stroke-dasharray:282.7;stroke-dashoffset:282.7;transition:stroke-dashoffset .1s linear}
.mz-cam-shutter i{position:absolute;inset:14px;border-radius:50%;background:#fff;box-shadow:0 2px 10px #0003;transition:transform .2s,background .2s}
.mz-cam.recording .mz-cam-shutter i{transform:scale(.62);background:#e5484d}
.mz-cam-preview{width:100%;max-height:62vh;border-radius:18px;background:#000}`;
  document.head.append(css);
}
