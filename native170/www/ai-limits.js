// 3.4.4: free-account limits (server/ai_gateway.TIERS). The server counts and refuses; here only AI calls end on time.
(() => {
  const W = window.WebEngine;
  let lim = null, at = 0, call = null, warned = false;
  const read = async () => {
    if (Date.now() - at < 60000) return lim;
    at = Date.now();
    try { lim = await W.humanRequest('/v1/ai-limits', {}); } catch { lim = null; }
    try { if (lim) localStorage.setItem('mz-pet-unlock', lim.unlimited || lim.member ? '1' : '0'); } catch {} // pet DLC
    return lim;
  };
  window.mzAiLimits = read;
  setTimeout(read, 8000);
  setInterval(async () => {
    const c = typeof liveVoice !== 'undefined' ? liveVoice : null;
    if (!c?.connectedAt || c.ending) { call = null; return; }
    if (call !== c) { call = c; warned = false; await read(); }
    const min = lim && !lim.unlimited && lim.callMinutes;
    if (!min) return;
    const left = min * 60000 - (Date.now() - c.connectedAt);
    if (left <= 60000 && !warned) { warned = true; toast(mzT('通話剩 1 分鐘（帳號越久，通話可以越長）', 'One minute left on this call (older accounts get longer calls)'), 4000); }
    if (left <= 0) { toast(mzT(`這次通話最多 ${min} 分鐘，已結束 (｡•ᴗ•｡)`, `Calls can last ${min} minutes, so this one ended`), 5000); actions.endAIVoice?.(); }
  }, 5000);
})();
