'use strict';
// 3.4.0: one AI, one memory. What you told an AI in private (say, "I'm going to sleep") is known when it talks in a
// group, and what happened in a group is known in private. Only recent lines go along, as background; the AI is told
// not to repeat private details in front of others.
{
  const W = window.WebEngine;
  const ago = (t) => {
    const m = Math.max(0, Math.round((Date.now() - (t || 0)) / 60000));
    return m < 1 ? '剛剛' : m < 60 ? m + ' 分鐘前' : m < 1440 ? Math.round(m / 60) + ' 小時前' : Math.round(m / 1440) + ' 天前';
  };
  const me = () => state?.settings?.nickname || humanData?.().me?.name || '我';

  // Recent private chat between you and this AI, plus its long-term summary.
  W.dmRecap = (aiId, count = 10) => {
    try {
      const ch = (state.chats || []).find((c) => c.members.length === 1 && c.members[0] === aiId);
      if (!ch) return '';
      const a = (state.ais || []).find((x) => x.id === aiId);
      const lines = (ch.messages || []).filter((m) => !m.system && (m.text || m.sticker)).slice(-count)
        .map((m) => `${ago(m.time)} ${m.author === 'me' ? me() : (a?.name || 'AI')}：${String(m.text || '［表情包］').slice(0, 160)}`);
      const summary = ch.memories?.[aiId]?.summary || '';
      if (!lines.length && !summary) return '';
      return '\n【你和' + me() + '的私聊（同一個你的記憶）】' + (summary ? '\n長期記憶：' + String(summary).slice(0, 800) : '') + (lines.length ? '\n最近：\n' + lines.join('\n') : '') +
        '\n這些是你自己記得的事，用來理解對方的近況（例如對方剛說要去睡、心情不好），可以自然地延續。私聊的細節不要在群組裡逐字說出，也不要透露給其他人。';
    } catch { return ''; }
  };

  // Recent lines from groups this AI is in, for private chats.
  W.groupRecap = (aiId, count = 8) => {
    try {
      const data = (typeof MizukiGroups !== 'undefined' ? MizukiGroups : window.MizukiGroups)?.data;
      if (!data) return '';
      const groups = (data.groups || []).filter((g) => (g.ais || []).some((a) => a.id === aiId));
      if (!groups.length) return '';
      const myId = humanData().me?.id;
      const out = [];
      for (const g of groups) {
        const lines = (data.messages || []).filter((m) => m.gid === g.id && !m.system && (m.text || m.sticker)).slice(-count).map((m) => {
          const who = m.aiAuthor ? m.aiAuthor.name : m.sender === myId ? me() : ((g.members || []).find((p) => p.id === m.sender)?.name || m.sender);
          return `${ago(m.time)} ${who}：${String(m.text || '［表情包］').slice(0, 160)}`;
        });
        if (lines.length) out.push('「' + g.name + '」\n' + lines.join('\n'));
      }
      return out.length ? '\n【你也在的群組，最近的對話（同一個你的記憶）】\n' + out.join('\n') + '\n可以自然地記得群組裡發生的事。' : '';
    } catch { return ''; }
  };

  // Private chats and other one-to-one moments get the group recap. Group replies add the private recap themselves
  // (and set mzInGroupReply so they don't also get the group recap twice).
  const systemBefore = W.system;
  W.system = (a) => systemBefore(a) + (window.mzInGroupReply ? '' : W.groupRecap(a?.id));
}
