"use strict";
{
  const W = WebEngine;
  let current = null, rooms = [], checking = false, selecting = '', starting = false;
  const request = (data) => W.humanRequest('/v1/group-calls', data);
  const me = () => humanData().me?.id;
  const busy = () => VoiceUI.rtc || VoiceUI.ai || VoiceUI.nativeCall || VoiceUI.recorder;
  async function release() {
    const c = current; current = null; VoiceUI.groupCall = null;
    if (c) { clearInterval(c.floorTimer); for (const agent of c.ais.values()) { agent.engine?.close(); agent.audio?.remove(); for (const p of agent.peers.values()) { p.pc.close(); p.audio?.remove(); } } c.mix?.ctx.close().catch(() => {}); for (const peer of c.peers.values()) { peer.pc.close(); peer.audio?.remove(); } c.stream.getTracks().forEach((t) => t.stop()); }
    document.querySelector('#mzGroupCallPanel')?.remove();document.querySelector('#mzGroupCallTop')?.remove();
    if(document.querySelector('.mz-group-call-controls'))closeModal();
    await call('voiceSession', { active: false }).catch(() => {});
  }
  function controlContent() {
    const c=current;
    return `<div class="mz-group-call-people">${c.room.members.map((p)=>`<div class="user-content">${avatar(p)}<small>${esc(p.name||p.id)}</small></div>`).join('')}</div>${window.mzNoiseSwitch?.()||''}<div class="sheet-actions"><button class="pill" data-action="groupCallMute">${c.muted?'開啟麥克風':'靜音麥克風'}</button><button class="pill hangup" data-action="groupCallLeave">離開通話</button></div>`;
  }
  function draw() {
    if(!current)return;
    let el=document.querySelector('#mzGroupCallPanel');
    if(!el){el=document.createElement('button');el.id='mzGroupCallPanel';el.type='button';el.className='mz-listening mz-group-call-status';el.dataset.action='groupCallControls';}
    const head=document.querySelector('.conversation > header.top');
    const fallback=document.querySelector('#mzGroupCallTop');
    if(head){head.classList.add('mz-has-listening');if(el.parentElement!==head)head.append(el);fallback?.remove();}
    else {
      let host=fallback;
      if(!host){host=document.createElement('div');host.id='mzGroupCallTop';document.body.append(host);}
      if(el.parentElement!==host)host.append(el);
    }
    const c=current,sig=JSON.stringify([c.room.members,c.muted,mzEn()]);
    if(el.dataset.sig!==sig){
      el.dataset.sig=sig;
      el.innerHTML=`${icon('phone')}<span class="user-content">${esc(c.room.name)}</span><span>${mzT('群組通話','Group call')} · ${c.room.members.length}${mzT(' 人',' people')}${c.muted?' · '+mzT('麥克風已關閉','Muted'):''}</span>`;
    }
    const controls=document.querySelector('.mz-group-call-controls');
    if(controls&&controls.dataset.sig!==sig){controls.dataset.sig=sig;controls.innerHTML=controlContent();window.mizukiTranslate?.(controls);}
  }
  actions.groupCallControls=()=>{if(!current)return;showModal(mzT('群組通話','Group call'),'<div class="mz-group-call-controls">'+controlContent()+'</div>');draw();};
  const signal = (to, kind, payload) => request({ action: 'signal', room: current.room.id, to, kind, payload });
  async function peerFor(person, offerer) {
    const c = current, old = c.peers.get(person.id);
    if (old?.epoch === person.epoch) return old;
    old?.pc.close(); old?.audio?.remove();
    const config = await rtcRequest('config'); delete config.hasTurn;
    if (current !== c) return null;
    const pc = new RTCPeerConnection(config), item = { pc, epoch: person.epoch, candidates: [] };
    c.peers.set(person.id, item);
    for (const track of c.stream.getAudioTracks()) pc.addTrack(track, c.stream);
    pc.onicecandidate = (e) => { if (e.candidate && current === c) signal(person.id, 'ice', e.candidate.toJSON()).catch(() => {}); };
    pc.ontrack = (e) => {
      if (current !== c) return;
      if (c.mix && !person.id.startsWith('ai:')) { const source = c.mix.ctx.createMediaStreamSource(e.streams[0] || new MediaStream([e.track])); source.connect(c.mix.destination); item.mixSource = source; }
      const audio = new Audio(); audio.autoplay = true; audio.srcObject = e.streams[0] || new MediaStream([e.track]); document.body.append(audio); item.audio = audio;
      if (typeof routeOutput === 'function') Promise.resolve(routeOutput(audio)).catch(() => {});
      audio.play().catch(() => toast('點一下通話面板以啟用聲音'));
    };
    if (offerer) { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await signal(person.id, 'offer', { type: offer.type, sdp: offer.sdp }); }
    return item;
  }
  async function join(room, takeover = false) {
    if (current || busy()) throw Error('請先結束此裝置目前的錄音或通話');
    let stream;
    try {
      const permission = await call('microphone'); if (permission?.granted === false) throw Error('請允許麥克風權限');
      stream = await openMicrophone();
      const r = await request({ action: 'join', room: room.id, takeover });
      current = { room: r.room, stream, peers: new Map(), ais: new Map(), mix: null, cursor: 0, muted: false }; VoiceUI.groupCall = current;
      closeModal(); await call('voiceSession', { active: true }); draw();
    } catch (e) { stream?.getTracks().forEach((t) => t.stop()); throw e; }
  }
  actions.groupCall = () => {
    if (current || busy()) return toast('請先結束此裝置目前的錄音或通話');
    const gid = chatId.startsWith('hgroup:') ? chatId.slice(7) : '';
    const group = MizukiGroups.data.groups.find((x) => x.id === gid);
    if (!group) return toast('請先打開人類或混合群組');
    const existing = rooms.find((r) => r.group === gid);
    if (existing) return join(existing, existing.joined && !existing.activeHere).catch((e) => toast(e.message));
    selecting = gid;
    const people = (group.members || []).filter((x) => x.id !== me());
    showModal('發起群組通話', `<p class="help">選擇收到來電提醒的成員。未被提醒的人仍可從群組加入。</p><div class="flex"><button class="pill" data-action="groupCallSelectAll">全選</button><button class="pill" data-action="groupCallSelectNone">全部取消</button></div>${people.map((p) => `<label class="audience-row"><input name="mzGroupCallNotify" type="checkbox" value="${esc(p.id)}" checked>${avatar(p)}<span class="user-content">${esc(p.name)}</span></label>`).join('')}${group.owner === me() && (group.ais || []).length ? '<h3>AI 語音成員</h3>' + group.ais.map((a) => `<label class="audience-row"><input name="mzGroupCallAI" type="checkbox" value="${esc(a.id)}" checked><span class="user-content">${esc(a.name)}</span></label>`).join('') : ''}<p id="mzGroupCallError" class="inline-error"></p><button class="pill primary" data-action="groupCallStart">開始通話</button>`);
  };
  actions.groupCallSelectAll = () => document.querySelectorAll('[name=mzGroupCallNotify],[name=mzGroupCallAI]').forEach((el) => el.checked = true);
  actions.groupCallSelectNone = () => document.querySelectorAll('[name=mzGroupCallNotify],[name=mzGroupCallAI]').forEach((el) => el.checked = false);
  actions.groupCallStart = async () => {
    if (starting) return; starting = true;
    try {
      // Acquire the microphone before sending any invitation.
      const permission = await call('microphone'); if (permission?.granted === false) throw Error('請允許麥克風權限');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const notify = [...document.querySelectorAll('[name=mzGroupCallNotify]:checked')].map((x) => x.value);
      const ais = [...document.querySelectorAll('[name=mzGroupCallAI]:checked')].map((x) => x.value);
      let result;
      try { result = await request({ action: 'start', group: selecting, notify, ais }); }
      finally { stream.getTracks().forEach((t) => t.stop()); }
      await join(result.room);
    } catch (e) { const el = document.querySelector('#mzGroupCallError'); if (el) el.textContent = e.message; else toast(e.message); }
    finally { starting = false; }
  };
  async function setupAIs(c) {
    if (c.room.owner !== me() || !c.room.ais?.length || c.mix) return;
    const ctx = new AudioContext(); window.mzWatchAudio?.(ctx); await ctx.resume();
    const destination = ctx.createMediaStreamDestination(), mine = ctx.createMediaStreamSource(c.stream); mine.connect(destination);
    c.mix = { ctx, destination, mine };
    // Only one AI at a time; see group-floor.js.
    c.floor = new MizukiGroupFloor({ mute(actor, off) { const a = c.ais.get(actor); a?.stream?.getAudioTracks().forEach((t) => { t.enabled = !off; }); }, tell(actor, kind, content) { c.ais.get(actor)?.engine?.say?.(kind, content); } });
    c.floorTimer = setInterval(() => c.floor.tick(), 300);
    for (const item of c.peers.values()) if (item.audio?.srcObject) { const source = ctx.createMediaStreamSource(item.audio.srcObject); source.connect(destination); item.mixSource = source; }
    for (const ai of c.room.ais) {
      const actor = 'ai:' + me() + ':' + ai.id;
      const agent = { actor, peers: new Map(), cursor: 0, stream: null, engine: null }; c.ais.set(actor, agent);
      try {
        c.floor.add(actor, ai.name || 'AI');
        agent.engine = await window.mzCreateGroupAI({ id: ai.id, group:c.room.group, input: destination.stream, onText(delta) { c.floor.speech(actor, delta); }, onHeard() { c.floor.person(); }, onAudio(stream) { agent.stream = stream; const audio = new Audio(); audio.autoplay = true; audio.srcObject = stream; document.body.append(audio); agent.audio = audio; audio.play().catch(() => {}); } });
        if (current !== c) { agent.engine.close(); return; }
        const ready = await request({ action: 'join', room: c.room.id, actor, takeover: true }); c.room = ready.room;
      } catch (e) { c.floor.remove(actor);agent.engine?.close();agent.audio?.remove();c.ais.delete(actor);await request({action:'remove-ai',room:c.room.id,actor}).catch(()=>{});toast((ai.name || 'AI') + ' 無法加入語音：' + e.message, 5000); }
    }
  }
  async function pollAIs(c) {
    for (const agent of c.ais.values()) {
      if (!agent.stream) continue;
      const r = await W.humanRequest('/v1/group-calls/poll?room=' + encodeURIComponent(c.room.id) + '&actor=' + encodeURIComponent(agent.actor) + '&since=' + agent.cursor);
      for (const [id, item] of agent.peers) if (!r.room.members.some((x) => x.id === id && x.epoch === item.epoch)) { item.pc.close(); agent.peers.delete(id); }
      const send = (to, kind, payload) => request({ action: 'signal', room: c.room.id, actor: agent.actor, to, kind, payload });
      for (const person of r.room.members.filter((x) => !x.id.startsWith('ai:'))) {
        if (person.id === me()) continue;
        if (agent.peers.get(person.id)?.epoch === person.epoch) continue;
        const config = await rtcRequest('config'); delete config.hasTurn;
        const pc = new RTCPeerConnection(config), item = { pc, epoch: person.epoch, candidates: [] }; agent.peers.set(person.id, item);
        for (const track of agent.stream.getAudioTracks()) pc.addTrack(track, agent.stream);
        pc.onicecandidate = (e) => { if (e.candidate && current === c) send(person.id, 'ice', e.candidate.toJSON()).catch(() => {}); };
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await send(person.id, 'offer', { type: offer.type, sdp: offer.sdp });
      }
      for (const event of r.events || []) {
        agent.cursor = Math.max(agent.cursor, event.id);
        const item = agent.peers.get(event.from); if (!item || item.epoch !== event.epoch) continue;
        if (event.kind === 'answer') { await item.pc.setRemoteDescription(event.payload); for (const ice of item.candidates.splice(0)) await item.pc.addIceCandidate(ice); }
        if (event.kind === 'ice') { if (item.pc.remoteDescription) await item.pc.addIceCandidate(event.payload); else item.candidates.push(event.payload); }
      }
    }
  }
  actions.groupCallMute = () => { if (!current) return; current.muted = !current.muted; current.stream.getAudioTracks().forEach((t) => t.enabled = !current.muted); draw(); };
  actions.groupCallLeave = async () => { const c = current; if (!c) return; await request({ action: 'leave', room: c.room.id }).catch(() => {}); await release(); };
  function affordances() {
    const group = chatId.startsWith('hgroup:') ? chatId.slice(7) : '';
    const head = document.querySelector('.mizuki-group-chat header.top');
    if (head && !head.querySelector('[data-action=groupCall]')) head.insertAdjacentHTML('beforeend', `<button class="icon-button" data-action="groupCall" aria-label="群組通話">${icon('phone')}</button>`);
    let banner = document.querySelector('#mzGroupCallInvite');
    const available = current ? null : rooms.find((r) => r.ring || r.joined || r.group === group);
    if (!available) { banner?.remove(); return; }
    if (!banner) { banner = document.createElement('aside'); banner.id = 'mzGroupCallInvite'; document.body.append(banner); }
    banner.innerHTML = `<span class="user-content">${esc(available.name)} ${mzT("正在通話","is in a call")}</span><button class="pill primary" data-group-call-join="${esc(available.id)}">${available.joined ? '切換到此裝置' : '加入通話'}</button><button class="pill" data-group-call-dismiss="${esc(available.id)}">略過</button>`;
    window.mizukiTranslate?.(banner);
  }
  document.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-group-call-join]'), dismiss = e.target.closest('[data-group-call-dismiss]');
    if (button) { const room = rooms.find((x) => x.id === button.dataset.groupCallJoin); if (room) join(room, room.joined).catch((e) => toast(e.message)); }
    if (dismiss) { await request({ action: 'dismiss', room: dismiss.dataset.groupCallDismiss }).catch(() => {}); rooms = rooms.map((x) => x.id === dismiss.dataset.groupCallDismiss ? { ...x, ring: false } : x); affordances(); }
    if (e.target.closest('#mzGroupCallPanel') && current) for (const item of current.peers.values()) item.audio?.play().catch(() => {});
  });
  async function check() {
    if (checking || !state || !humanData().connected) return; checking = true;
    try {
      if (current) {
        const c = current, r = await W.humanRequest('/v1/group-calls/poll?room=' + encodeURIComponent(c.room.id) + '&since=' + c.cursor);
        if (current !== c) return;
        if (r.room.ended || !r.room.activeHere) { await release(); toast(r.room.ended ? '群組通話已結束' : '群組通話已切換到另一台裝置'); }
        else {
          c.room = r.room;
          await setupAIs(c);
          await pollAIs(c);
          for (const [id, item] of c.peers) if (!r.room.members.some((p) => p.id === id && p.epoch === item.epoch)) { item.pc.close(); item.audio?.remove(); c.peers.delete(id); }
          for (const person of r.room.members.filter((x) => x.id !== me() && !(c.room.owner === me() && x.id.startsWith('ai:')))) await peerFor(person, !person.id.startsWith('ai:') && me().localeCompare(person.id) < 0);
          for (const event of r.events || []) {
            c.cursor = Math.max(c.cursor, event.id);
            const person = c.room.members.find((x) => x.id === event.from && x.epoch === event.epoch); if (!person) continue;
            const peer = await peerFor(person, false); if (!peer) continue;
            if (event.kind === 'offer') { await peer.pc.setRemoteDescription(event.payload); for (const ice of peer.candidates.splice(0)) await peer.pc.addIceCandidate(ice); const answer = await peer.pc.createAnswer(); await peer.pc.setLocalDescription(answer); await signal(person.id, 'answer', { type: answer.type, sdp: answer.sdp }); }
            if (event.kind === 'answer') { await peer.pc.setRemoteDescription(event.payload); for (const ice of peer.candidates.splice(0)) await peer.pc.addIceCandidate(ice); }
            if (event.kind === 'ice') { if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(event.payload); else peer.candidates.push(event.payload); }
          }
          draw();
        }
      }
      const r = await request(); rooms = r.rooms || []; affordances();
    } catch (e) { if (current) console.warn('Group call:', e.message); }
    finally { checking = false; }
  }
  const baseRender = render; render = function () { baseRender(); affordances(); draw(); };
  const baseQuick = actions.quickCall; actions.quickCall = () => chatId.startsWith('hgroup:') ? actions.groupCall() : baseQuick();
  const humanStart = actions.humanVoiceCall; actions.humanVoiceCall = async () => { if (current) throw Error('請先離開群組通話'); return humanStart(); };
  const aiStart = startAIVoiceCall; startAIVoiceCall = async (id) => { if (current) throw Error('請先離開群組通話'); return aiStart(id); };
  window.addEventListener('pagehide', () => { if (current) request({ action: 'leave', room: current.room.id }).catch(() => {}); });
  setInterval(check, 1500);
}
