"use strict";
// Active device belongs to the authenticated login session, never to an account-synced preference.
{
  const W = WebEngine, rawRtc = rtcRequest;
  const handledTransfers = new Set();
  let remoteCall = null, aiRemote = null, taking = false, checking = false, aiRegistered = null;
  const activity = (body) => W.humanRequest('/v1/device-activity', body);
  const errorText = (e) => String(e.message || e).replace(/^.*HTTP \d+[：:]\s*/, '');
  function banner() {
    let el = document.querySelector('#mzDeviceCall');
    const item = remoteCall || aiRemote;
    if (!item) { el?.remove(); return; }
    if (!el) { el = document.createElement('aside'); el.id = 'mzDeviceCall'; document.body.append(el); }
    el.innerHTML = `<span class="user-content">${mzT('正在 ','On ')}${esc(item.deviceName || mzT('另一台裝置','another device'))}${mzT(' 通話',' in a call')}</span><button class="pill primary" data-action="takeCallHere" ${taking ? 'disabled' : ''}>${taking ? '正在切換…' : '切換到此裝置'}</button>`;
    window.mizukiTranslate?.(el);
  }
  const waitConnected = (c) => new Promise((resolve, reject) => {
    const until = Date.now() + 25000;
    const check = () => {
      if (c.pc?.connectionState === 'connected' || c.connected || c.live) return resolve();
      if (c.ending || c.ended || c.pc?.connectionState === 'failed' || Date.now() > until) return reject(Error('切換連線失敗，請在原裝置繼續或重新嘗試'));
      setTimeout(check, 150);
    };
    check();
  });
  async function receiveTransfer(c, payload) {
    const id = c.id, peer = c.peer, started = c.connectedAt;
    const oldAudio = VoiceUI.remoteAudio;
    const next = await buildPeer(true);
    Object.assign(next, { id, peer, isCaller: c.isCaller, startedEvent:c.startedEvent, connectedAt: started, transferId: payload.transfer, remoteCandidates: [], handoffPending:true });
    const stateChange=next.pc.onconnectionstatechange;
    next.pc.onconnectionstatechange=()=>{if(next.handoffPending && ['failed','closed'].includes(next.pc.connectionState))return;stateChange?.();};
    await remoteSDP(next, payload.offer);
    const answer = await next.pc.createAnswer(); await next.pc.setLocalDescription(answer);
    await rawRtc('handoff-answer', { id, transfer: payload.transfer, answer: { type: answer.type, sdp: answer.sdp } });
    await flushICE(next);
    waitConnected(next).then(()=>{next.handoffPending=false;c.ended=true;c.pc?.close();c.stream?.getTracks().forEach(t=>t.stop());c.cameraStream?.getTracks().forEach(t=>t.stop());c.screenStream?.getTracks().forEach(t=>t.stop());c.mix?.ctx.close().catch(()=>{});oldAudio?.remove();}).catch(()=>{if(VoiceUI.rtc!==next)return;const newAudio=VoiceUI.remoteAudio;VoiceUI.rtc=c;next.pc.close();next.stream?.getTracks().forEach(t=>t.stop());if(newAudio!==oldAudio)newAudio?.remove();VoiceUI.remoteAudio=oldAudio;toast('裝置切換未完成，原通話繼續');});
    callScreen(humanFriend(peer).name, '對方正在切換通話裝置…', '<button class="pill hangup" data-action="endHumanCall">掛斷</button>');
  }
  rtcRequest = async (path, body) => {
    const r = await rawRtc(path, body);
    if (!path.startsWith('poll')) return r;
    remoteCall = r.calls?.find((x) => x.status === 'active' && x.activeHere === false && !x.transferringHere) || null;
    const current = VoiceUI.rtc;
    if (current?.pc && r.calls?.some((x) => x.id === current.id && x.activeHere === false && !x.transferringHere)) { await cleanupPeer(); toast('通話已切換到另一台裝置'); }
    const filtered = [];
    for (const event of r.events || []) {
      const c = VoiceUI.rtc;
      VoiceUI.signalCursor=Math.max(VoiceUI.signalCursor||0,event.id);
      if (c) c.mediaCursor=Math.max(c.mediaCursor||0,event.id);
      if (event.kind.startsWith('handoff-')) {if(handledTransfers.has(event.id))continue;handledTransfers.add(event.id);}
      if (event.kind === 'handoff-offer') { if (c?.pc && c.id === event.callid && !c.handoffReceiving) { c.handoffReceiving = true; try { await receiveTransfer(c, event.payload); } catch (e) { toast(errorText(e)); } } continue; }
      if (event.kind === 'handoff-answer') { if (c?.id === event.callid && c.transferId === event.payload.transfer) await remoteSDP(c, event.payload.answer); continue; }
      if (event.kind === 'handoff-complete') continue;
      if (event.kind === 'offer' && r.calls?.find((x) => x.id === event.callid)?.status !== 'ringing') continue;
      if (c?.handoffInitiator && (event.kind === 'answer' || (event.kind === 'ice' && !event.payload?._transfer))) continue;
      if (event.kind === 'ice' && event.payload?._transfer) { const transfer = event.payload._transfer; delete event.payload._transfer; if (c?.transferId !== transfer) continue; }
      filtered.push(event);
    }
    r.events = filtered; banner(); return r;
  };
  actions.takeCallHere = async () => {
    if (taking) return;
    if (VoiceUI.rtc || VoiceUI.ai || VoiceUI.recorder) return toast('請先結束此裝置上的錄音或通話');
    taking = true; banner();
    let next = null;
    try {
      if (remoteCall) {
        const call = remoteCall;
        if (window.webkit?.messageHandlers?.mushuiCall) { await nativeCall('takeover', { id: call.id, me: humanData().me.id }); return; }
        next = await buildPeer();
        const me = humanData().me.id;
        Object.assign(next, { id: call.id, peer: call.caller === me ? call.callee : call.caller, isCaller: call.caller === me, connectedAt: call.created });
        const offer = await next.pc.createOffer(); await next.pc.setLocalDescription(offer);
        const r = await rawRtc('handoff', { id: next.id, offer: { type: offer.type, sdp: offer.sdp } });
        next.transferId = r.transfer; next.handoffInitiator=true;
        await flushICE(next);
        callScreen(humanFriend(next.peer).name, '正在切換到此裝置…', '<button class="pill hangup" data-action="endHumanCall">取消</button>');
        await waitConnected(next);
        await rawRtc('handoff-ready', { id: next.id, transfer: next.transferId });
        next.transferId = '';next.handoffInitiator=false;
        remoteCall = null; banner();
      } else if (aiRemote) {
        const prepared = await activity({ action: 'prepare' }), info = prepared.activity;
        await W.accountSync().catch(() => {}); state = await call('load');
        if (!state.ais.some((x) => x.id === info.ai)) throw Error('AI 資料尚未同步到此裝置，請先完成帳號同步');
        window.mzResumingCall = true;
        try { await startAIVoiceCall(info.ai); } finally { window.mzResumingCall = false; }
        next = VoiceUI.ai;
        if (!next) throw Error('通話未能接手');
        if (next.pc) await waitConnected(next);
        await activity({ action: 'commit', claim: prepared.claim });
        next.connectedAt = info.startedAt; aiRegistered = next; aiRemote = null; banner();
      }
    } catch (e) {
      if (next === VoiceUI.rtc && next) { await rawRtc('handoff-cancel', { id: next.id }).catch(() => {}); await cleanupPeer(); }
      if (next === VoiceUI.ai && next) await window.mzReleaseAICall?.();
      await activity({ action: 'cancel' }).catch(() => {});
      toast(errorText(e), 5000);
    } finally { taking = false; banner(); }
  };
  async function check() {
    if (checking || !state || !humanData().connected) return;
    checking = true;
    try {
      // Also discovers calls from native iPhone even while this device is idle.
      if (!VoiceUI.rtc) { const r = await rawRtc('poll?since=2147483647'); remoteCall = r.calls?.find((x) => x.status === 'active' && x.activeHere === false) || null; }
      const c = VoiceUI.ai;
      if (c && !taking) {
        if (aiRegistered !== c) { await activity({ action: 'register', content: { kind: 'ai', ai: c.ai, chat: c.chat, startedAt: c.connectedAt || c.startedAt || Date.now() } }); aiRegistered = c; }
        const r = await activity({ action: 'heartbeat' });
        if (r.activity && !r.activity.activeHere) { await window.mzReleaseAICall?.(); aiRegistered = null; aiRemote = r.activity; toast('通話已切換到另一台裝置'); }
      } else if (!taking) {
        if (aiRegistered) { await activity({ action: 'end' }); aiRegistered = null; }
        const r = await activity(); aiRemote = r.activity && !r.activity.activeHere ? r.activity : null;
      }
      banner();
    } catch (e) { if (VoiceUI.ai && !taking) console.warn('Device handoff:', errorText(e)); }
    finally { checking = false; }
  }
  const startAI = startAIVoiceCall;
  startAIVoiceCall = async (id) => {
    if (!taking && humanData().connected) { const r = await activity(); if (r.activity && !r.activity.activeHere) throw Error('另一台裝置正在通話，請按「切換到此裝置」'); }
    await startAI(id);
    const c = VoiceUI.ai;
    if (c && !taking && humanData().connected) {
      try { await activity({ action: 'register', content: { kind: 'ai', ai: c.ai, chat: c.chat, startedAt: c.connectedAt || c.startedAt || Date.now() } }); aiRegistered = c; }
      catch (e) { await window.mzReleaseAICall?.(); throw e; }
    }
  };
  const endHuman=actions.endHumanCall;
  actions.endHumanCall=async()=>{const c=VoiceUI.rtc;if(c?.handoffInitiator){await rawRtc('handoff-cancel',{id:c.id}).catch(()=>{});await cleanupPeer();return;}return endHuman();};
  const endAI = actions.endAIVoice;
  actions.endAIVoice = async () => { await endAI(); if (!VoiceUI.ai && !taking) { await activity({ action: 'end' }).catch(() => {}); aiRegistered = null; } };
  setInterval(check, 2000);

  // 3.3.8: a phone can drop the app's page while it sits in the background, and it loads fresh on return. The call is
  // still open on the server, so this device picks it back up (the same way as "切換到此裝置") instead of it ending.
  const MARK = 'mzCallHere', loadedAt = Date.now();
  let resumeDone = false;
  const readMark = () => { try { return JSON.parse(localStorage.getItem(MARK) || 'null'); } catch { return null; } };
  const dropMark = () => { try { localStorage.removeItem(MARK); } catch {} };
  setInterval(() => {
    if (!resumeDone || taking) return;
    const h = VoiceUI.rtc, a = VoiceUI.ai;
    try {
      if (h?.id && (h.connected || h.connectedAt) && !h.ended && !h.ending) localStorage.setItem(MARK, JSON.stringify({ kind: 'human', id: h.id, at: Date.now() }));
      else if (a?.ai && !a.ending) localStorage.setItem(MARK, JSON.stringify({ kind: 'ai', ai: a.ai, chat: a.chat || '', startedAt: a.connectedAt || a.startedAt || Date.now(), at: Date.now() }));
      else dropMark();
    } catch {}
  }, 1500);
  async function resume() {
    if (resumeDone || !state) return;
    const m = readMark();
    if (!m || VoiceUI.rtc || VoiceUI.ai || Date.now() - loadedAt > 60000) { resumeDone = true; return; }
    // A friend's call needs the friend server; an AI call doesn't.
    if (m.kind === 'human' && !humanData().connected) return;
    resumeDone = true;
    // Hours later there's nothing to go back to.
    if (Date.now() - m.at > 3 * 3600000) return dropMark();
    try {
      if (m.kind === 'human') {
        if (window.webkit?.messageHandlers?.mushuiCall) return; // iPhone's own calls keep running natively
        const r = await rawRtc('poll?since=2147483647');
        const found = r.calls?.find((x) => x.id === m.id && x.status === 'active');
        if (!found) return dropMark();
        remoteCall = found;
        toast(mzT('正在接回剛才的通話…', 'Picking the call back up…'));
        await actions.takeCallHere();
      } else if (state.ais.some((x) => x.id === m.ai)) {
        toast(mzT('正在接回剛才的通話…', 'Picking the call back up…'));
        window.mzResumingCall = true;
        try { await startAIVoiceCall(m.ai); } finally { window.mzResumingCall = false; }
        if (VoiceUI.ai) VoiceUI.ai.connectedAt = m.startedAt;
      }
    } catch (e) { toast(errorText(e), 5000); }
  }
  const resumeTimer = setInterval(() => { if (resumeDone) clearInterval(resumeTimer); else resume(); }, 1000);
  // Hanging up on purpose means there's nothing to pick up later.
  const endHumanMark = actions.endHumanCall, endAIMark = actions.endAIVoice;
  actions.endHumanCall = async (...args) => { dropMark(); return endHumanMark(...args); };
  actions.endAIVoice = async (...args) => { dropMark(); return endAIMark(...args); };
}
