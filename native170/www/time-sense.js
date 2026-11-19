'use strict';
// 3.2.2: AIs notice time passing. The model only saw message text, so a two-hour silence looked like nothing.
// Each request now ends with a short note of how long the gap was; proactive messages get the same note.
{
  const W = WebEngine, QUIET = 5 * 60000;
  const span = (ms) => {
    const minutes = Math.max(1, Math.round(ms / 60000)), days = Math.floor(minutes / 1440), hours = Math.floor((minutes % 1440) / 60), rest = minutes % 60;
    return (days ? days + ' 天' : '') + (hours ? hours + ' 小時' : '') + (!days && rest ? rest + ' 分鐘' : '') || '不到 1 分鐘';
  };
  const clock = (time) => new Date(time).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

  W.timeNote = (s, a, c) => {
    const list = (c?.messages || []).filter((m) => !m.callEvent && m.author !== 'system' && Number.isFinite(m.time));
    const last = list.at(-1), now = Date.now();
    if (!last) return '';
    const facts = [];
    if (last.author === 'me') {
      let i = list.length - 1;
      while (i > 0 && list[i - 1].author === 'me') i--;
      const before = list[i - 1], gap = before ? list[i].time - before.time : 0;
      if (gap >= QUIET) facts.push('上一則訊息是 ' + clock(before.time) + (before.author === a.id ? ' 你傳的' : ''), '使用者隔了 ' + span(gap) + '，到 ' + clock(list[i].time) + ' 才傳訊息');
      if (now - last.time >= QUIET) facts.push('使用者的訊息已經放了 ' + span(now - last.time) + '，你還沒回');
    } else if (now - last.time >= QUIET) {
      facts.push((last.author === a.id ? '你' : W.person(s, last.author)) + '在 ' + clock(last.time) + ' 傳了最後一則訊息', '已經過了 ' + span(now - last.time) + '，使用者還沒回');
    }
    return facts.length ? '［時間資訊，不是使用者說的話：' + facts.join('；') + '。你感覺得到時間過去，可以依個性和關係自然反應，例如注意到對方很久才回或一直沒回；不一定要提，也不要每次都提，不要編造對方在做什麼。］' : '';
  };

  const context = W.context;
  W.context = (s, a, c) => {
    const out = context(s, a, c), note = W.timeNote(s, a, c);
    if (note) out.push({ role: 'user', content: note });
    return out;
  };
}
