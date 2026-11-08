'use strict';
// AI calls with video. The voice service only takes sound, so this device looks at the camera or screen every few
// seconds, a vision model says what it sees, and the AI gets that as quiet context. Frames that haven't changed are skipped.
(() => {
  const W = WebEngine, EVERY = 12000, QUIET_FOR = 45000;
  let watch = null;
  const say = (c, kind, content) => { try { c.dc.send(JSON.stringify({ type: kind === 'thinking' ? 'session.thinking.append' : 'session.commentary.append', event_id: 'sight_' + Date.now(), delegation_id: null, content: String(content).slice(0, 1000) })); } catch {} };
  const label = (kind) => (watch?.kind === kind ? mzT('關閉', 'Stop ') : mzT('開啟', 'Start ')) + (kind === 'camera' ? mzT('視訊', 'video') : mzT('分享畫面', 'screen share'));
  window.mzAIVideoButtons = () => `<button class="pill" data-action="aiVideoCamera">${label('camera')}</button>${window.MushuiDesktop ? `<button class="pill" data-action="aiVideoScreen">${label('screen')}</button>` : ''}`;
  const refresh = () => { for (const [action, kind] of [['aiVideoCamera', 'camera'], ['aiVideoScreen', 'screen']]) { const b = document.querySelector(`.call-overlay [data-action="${action}"]`); if (b) { b.textContent = label(kind); b.classList.toggle('primary', watch?.kind === kind); } } };

  function stop() {
    if (!watch) return;
    clearInterval(watch.timer);
    watch.stream.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    watch.video.remove();
    watch = null;
    refresh();
  }
  window.mzAIVideoStop = stop;

  // A tiny grey copy of the frame, to tell whether anything moved.
  function fingerprint(video) {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 18;
    const g = canvas.getContext('2d', { willReadFrequently: true }); g.drawImage(video, 0, 0, 32, 18);
    const data = g.getImageData(0, 0, 32, 18).data, out = new Uint8Array(576);
    for (let i = 0; i < 576; i++) out[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    return out;
  }
  const changed = (a, b) => { if (!a) return true; let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length > 6; };

  async function look(c, w) {
    if (w.busy || watch !== w) return;
    if (liveVoice !== c) return stop();
    const { video } = w;
    if (!video.videoWidth) return;
    const print = fingerprint(video), now = Date.now();
    if (!changed(w.print, print) && now - w.at < QUIET_FOR) return;
    w.busy = true;
    try {
      const canvas = document.createElement('canvas'), scale = Math.min(1, 768 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', 0.7), s = await W.read();
      const seen = await W.see(s.settings, [url], '這是對方現在的' + (w.kind === 'camera' ? '鏡頭' : '分享畫面') + '，用一到兩句話描述。');
      if (watch !== w || liveVoice !== c || !seen) return;
      w.print = print; w.at = now;
      if (w.first) { w.first = false; say(c, 'commentary', '對方打開了' + (w.kind === 'camera' ? '鏡頭' : '畫面分享') + '，你現在看得到。你看到：' + seen + ' 用一句話自然回應。'); }
      else say(c, 'thinking', '你現在從對方的畫面看到：' + seen + ' 不需要每次都提起，對方問到或有趣時再說。');
    } catch (e) { if (w.first) toast(mzT('AI 暫時看不到畫面：', 'The AI can\'t see the video right now: ') + e.message, 5000); }
    finally { w.busy = false; }
  }

  function begin(c, kind, stream) {
    stop();
    const video = document.createElement('video');
    video.className = 'mz-ai-video'; video.muted = true; video.playsInline = true; video.autoplay = true; video.srcObject = stream;
    if (kind === 'camera') video.classList.add('is-mirror');
    (callOverlay || document.body).append(video);
    video.play().catch(() => {});
    const w = watch = { kind, stream, video, first: true, at: 0, print: null, busy: false };
    w.timer = setInterval(() => look(c, w), EVERY);
    setTimeout(() => look(c, w), 1500);
    stream.getVideoTracks()[0].onended = stop;
    refresh();
  }

  actions.aiVideoCamera = async () => {
    const c = liveVoice;
    if (!c?.liveSession) return;
    if (watch?.kind === 'camera') return stop();
    if (window.AndroidHost) { const p = await Desktop.invoke('cameraPermission'); if (!p.granted) throw Error(mzT('需要相機權限', 'Camera access is needed')); }
    const id = typeof deviceConfig === 'function' ? deviceConfig().camera : '';
    begin(c, 'camera', await navigator.mediaDevices.getUserMedia({ audio: false, video: id ? { deviceId: { exact: id }, width: { ideal: 1280 } } : { facingMode: 'user', width: { ideal: 1280 } } }));
  };

  let sources = [];
  actions.aiVideoScreen = async () => {
    if (!liveVoice?.liveSession) return;
    if (watch?.kind === 'screen') return stop();
    sources = await Desktop.invoke('sources');
    showModal(mzT('選擇分享畫面', 'Choose what to share'), `<p class="help">${mzT('AI 會看到這個畫面，可能包含通知與私人資料。', 'The AI will see this, including any notifications or private details on it.')}</p><div class="mz-ai-sources">${sources.map((x, i) => `<button class="setting-choice full" data-aisource="${i}">${esc(x.name)}</button>`).join('')}</div>`);
  };
  document.addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-aisource]');
    if (!pick) return;
    const source = sources[+pick.dataset.aisource], c = liveVoice;
    closeModal();
    if (!source || !c?.liveSession) return;
    try {
      await Desktop.invoke('selectSource', { id: source.id, audio: false });
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).catch(() => navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: source.id } } }));
      begin(c, 'screen', stream);
    } catch (err) { toast(err.message); }
  });
})();
