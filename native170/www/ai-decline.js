'use strict';
// 3.2.2: an AI can decline when the user calls. It decides from its personality, the recent chat and the time;
// if the model can't answer in time, it picks up, so a slow network never looks like a rejection.
{
  const W = WebEngine, WAIT = 6000;
  let dial = 0;

  async function aiWantsCall(id) {
    const s = await W.read(), a = W.find(s.ais, id), chat = s.chats.find((c) => c.members.length === 1 && c.members[0] === id);
    const recent = (chat?.messages || []).slice(-12).map((m) => ({ author: W.person(s, m.author), text: m.text }));
    const raw = await W.complete(s.settings, W.system(a) + '\n使用者現在打電話給你。依你的個性、你們的關係、最近的對話與此刻時間，決定接或不接。多數時候會接；只有真的有理由（在忙、睡了、正在生氣、想冷靜）才拒接。只回 JSON {answer:true或false,reason:拒接時傳給使用者的一句話，接聽時留空}。', [{ role: 'user', content: JSON.stringify(recent) }]);
    const choice = W.json(raw);
    return { answer: choice.answer !== false, reason: String(choice.reason || '').trim().slice(0, 200) };
  }

  const baseStart = startAIVoiceCall;
  startAIVoiceCall = async (id) => {
    if (window.mzResumingCall || state.settings.aiDeclineCalls === false || VoiceUI.ai || VoiceUI.rtc || VoiceUI.recorder) return baseStart(id);
    const mine = ++dial;
    closeModal();
    callScreen(ai(id).name, '正在撥號…', '<button class="pill hangup" data-action="mzCancelDial">取消</button>');
    let result = { answer: true, reason: '' };
    try {
      result = await Promise.race([aiWantsCall(id), new Promise((r) => setTimeout(() => r({ answer: true, reason: '' }), WAIT))]);
    } catch {}
    if (mine !== dial) return;
    hideCall();
    if (result.answer) return baseStart(id);
    await W.edit((s) => {
      const c = W.dm(s, id);
      W.append(c, 'system', '對方已拒接', { callEvent: true });
      if (result.reason) W.append(c, id, result.reason);
    });
    state = await call('load');
    render();
    toast(ai(id).name + ' 拒接了你的來電', 2200);
  };

  actions.mzCancelDial = () => {
    dial++;
    hideCall();
  };
}
