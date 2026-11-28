'use strict';
// Settings → Privacy & app lock: two kinds of real-people help, each up to 3 friends or group chats (server/ai_relay.py).
// 緊急聯絡人 (emergency): told when the person says something like "我活不下去了" to the built-in AI — the AI can't call for help.
// 特殊聯絡人 (special): asked to answer for the AI when its chat credit has run out.
// Without any set, the server asks one online friend instead.
{
  let info = null, loading = false, busy = '';
  const picked = { emergency: null, special: null };
  const W = WebEngine;
  const key = (x) => (x.group ? 'group:' : '') + x.id;
  const load = () => {
    if (loading || !humanData().connected) return;
    loading = true;
    W.humanRequest('/v1/emergency').then((r) => { info = r; picked.emergency = picked.special = null; }).catch(() => { info = { error: true }; }).finally(() => { loading = false; if (tab === 'settings' && page === 'privacy') render(); });
  };
  const TEXT = {
    emergency: {
      title: mzT('緊急聯絡人', 'Emergency contacts'),
      about: mzT('AI 無法打電話求救。若你向內建 AI 表達自傷念頭，沐水會通知他們關心你。', "The AI cannot call for help. If you tell the built-in AI you want to hurt yourself, Mizuki asks them to check on you."),
    },
    special: {
      title: mzT('特殊聯絡人', 'Special contacts'),
      about: mzT('AI 額度用完時，沐水會將你的那句話轉給他們代為回覆。', "When the AI runs out of credit, Mizuki forwards that message to them for a reply."),
    },
  };
  const DIFF = mzT('兩種都可選好友或群聊。對方會看到該句訊息。未設定時，沐水會找一位在線好友。',
    'Choose friends or group chats. They will see the message that triggered the request. If none are set, Mizuki asks an online friend.');
  // 3.4.1: the card shows who is chosen; 「選擇聯絡人」 opens a popup with the friends and group chats to pick from,
  // and 「完成」 saves at once (removing someone with ✕ saves at once too). No list of everyone on the page.
  const optionsAll = () => [...(info.friends || []), ...(info.groups || [])];
  const nameOf = (k) => { const x = optionsAll().find((o) => key(o) === k); return x ? (x.name || x.id) : k.replace(/^[a-z]+:/, ''); };
  const section = (kind) => {
    const max = info.max || 3, saved = (info[kind] || []).map(key);
    const chips = saved.length ? saved.map((k) => `<span class="mz-help-chip"><span class="user-content">${esc(nameOf(k))}</span><button type="button" data-helpremove="${kind}" data-k="${esc(k)}" aria-label="${mzT('移除', 'Remove')}" ${busy ? 'disabled' : ''}>✕</button></span>`).join('') : `<p class="small mz-emergency-empty">${mzT('還沒有選擇。', 'None chosen yet.')}</p>`;
    return `<div class="card mz-emergency"><h3>${TEXT[kind].title}</h3><p class="small">${TEXT[kind].about}</p>
      <div class="mz-help-chips">${chips}</div>
      <div class="sheet-actions"><button class="pill primary" type="button" data-helppick="${kind}" ${busy ? 'disabled' : ''}>${busy === kind ? mzT('儲存中…', 'Saving…') : mzT('選擇聯絡人', 'Choose contacts')}（${saved.length}/${max}）</button></div>
      <p class="small mz-emergency-diff">${DIFF}</p>
      ${kind === 'emergency' ? `<p class="small">${window.mzCrisisPlace ? window.mzCrisisPlace.line(window.mzCrisisPlace.here(), mzT('0', '1') === '1') : mzT('有立即危險請撥 119；想找人說話可以撥 1925 安心專線（24 小時）。', 'In immediate danger, call 119. To talk to someone, call the 1925 helpline (24 hours).')}</p>` : ''}
    </div>`;
  };
  let temp = null, tempKind = '';
  const openPicker = (kind) => {
    const max = info.max || 3;
    temp = new Set((info[kind] || []).map(key)); tempKind = kind;
    const opts = optionsAll();
    const rows = opts.length ? opts.map((x) => { const k = key(x), on = temp.has(k); return `<label class="mz-emergency-row"><input type="checkbox" data-helpmodal="${esc(k)}" ${on ? 'checked' : ''} ${!on && temp.size >= max ? 'disabled' : ''}><span class="user-content">${esc(x.name || x.id)}</span><span class="small">${x.group ? mzT('群聊', 'Group') : '@' + esc(x.id)}</span></label>`; }).join('') : `<p class="small">${mzT('還沒有真人好友或群聊。', 'No friends or group chats yet.')}</p>`;
    showModal(TEXT[kind].title, `<p class="small">${mzT('最多 ' + max + ' 個，可以選真人或群聊。新加入的會收到沐水的通知。', 'Up to ' + max + ', friends or group chats. New ones get a note from 沐水.')}</p><div class="mz-emergency-list mz-help-picker">${rows}</div><div class="sheet-actions"><button class="pill primary" type="button" data-helpdone="${kind}">${mzT('完成', 'Done')}</button></div>`);
  };
  const css = document.createElement('style');
  css.textContent = '.mz-help-chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.mz-help-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 8px 6px 12px;border-radius:999px;background:var(--soft);color:var(--ink);font-size:13px}.mz-help-chip button{border:0;background:transparent;color:var(--muted);font:inherit;padding:0 4px;cursor:pointer}.mz-help-picker{max-height:55vh;overflow:auto}';
  document.head.append(css);
  const cards = () => {
    if (!humanData().connected) return `<div class="card mz-emergency"><h3>${mzT('緊急與特殊聯絡人', 'Emergency & special contacts')}</h3><p class="small">${DIFF}</p><p class="small">${mzT('登入好友帳號後才能使用。', 'Sign in to your friend account first.')}</p></div>`;
    if (!info) { load(); return `<div class="card mz-emergency"><h3>${mzT('緊急與特殊聯絡人', 'Emergency & special contacts')}</h3><p class="small">${mzT('讀取中…', 'Loading…')}</p></div>`; }
    if (info.error) return `<div class="card mz-emergency"><h3>${mzT('緊急與特殊聯絡人', 'Emergency & special contacts')}</h3><p class="small">${mzT('讀取失敗，伺服器可能還沒更新。', "Couldn't load. The server may not be updated yet.")}</p></div>`;
    return section('emergency') + section('special');
  };
  const before = settingsPage;
  settingsPage = function () {
    const html = before();
    if (page !== 'privacy' || window.MushuiAIOnly) return html;
    const end = html.lastIndexOf('</div>');
    return end > 0 ? html.slice(0, end) + cards() + html.slice(end) : html + cards();
  };
  document.addEventListener('change', (e) => {
    const box = e.target.closest?.('input[data-helpmodal]');
    if (!box || !temp) return;
    if (box.checked) temp.add(box.dataset.helpmodal); else temp.delete(box.dataset.helpmodal);
    const full = temp.size >= (info?.max || 3);
    document.querySelectorAll('input[data-helpmodal]').forEach((x) => { x.disabled = !x.checked && full; });
  });
  const save = async (kind) => {
    if (busy || !picked[kind]) return;
    busy = kind; render();
    try { info = await W.humanRequest('/v1/emergency', { kind, contacts: picked[kind] }); picked[kind] = null; toast(mzT('已儲存', 'Saved')); }
    catch (e) { toast(String(e.message || e).replace(/^.*HTTP \d+[：:]\s*/, ''), 5000); }
    finally { busy = ''; render(); }
  };
  document.addEventListener('click', (e) => {
    const pick = e.target.closest?.('[data-helppick]');
    if (pick && !pick.disabled && info) { openPicker(pick.dataset.helppick); return; }
    const done = e.target.closest?.('[data-helpdone]');
    if (done && temp) { const kind = done.dataset.helpdone; picked[kind] = [...temp].slice(0, info.max || 3); temp = null; closeModal(); save(kind); return; }
    const rm = e.target.closest?.('[data-helpremove]');
    if (rm && !rm.disabled && info) { const kind = rm.dataset.helpremove; picked[kind] = (info[kind] || []).map(key).filter((k) => k !== rm.dataset.k); save(kind); }
  });
}
