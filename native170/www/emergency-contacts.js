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
      about: mzT('AI 沒辦法打電話求救。你跟內建 AI 說出想傷害自己之類的話時，沐水會通知他們來陪你。', "The AI can't call for help. If you tell the built-in AI you want to hurt yourself, 沐水 asks them to check on you."),
    },
    special: {
      title: mzT('特殊聯絡人', 'Special contacts'),
      about: mzT('AI 的額度用完、沒力氣說話時，沐水會把你對 AI 說的話給他們看，請他們幫 AI 回你一句。', "When the AI's credit runs out, 沐水 shows them what you said and asks them to answer you for the AI."),
    },
  };
  const DIFF = mzT('兩者區別：緊急聯絡人是你可能有危險時，請人來陪你；特殊聯絡人是 AI 沒辦法回話時，請人幫 AI 傳話。都可以選真人或群聊（群聊會發在群裡，你也看得到）。沒設定時，會找一位正在線上的好友。對方會看到你說的那一句話。',
    'The difference: emergency contacts are asked to be with you when you may be in danger; special contacts answer for the AI when it can\'t reply. Either can be a friend or a group chat (a group gets the note in the chat, so you see it too). Without any set, one online friend is asked. They will see what you said.');
  const section = (kind) => {
    const max = info.max || 3, saved = (info[kind] || []).map(key), chosen = picked[kind] || saved;
    const options = [...(info.friends || []), ...(info.groups || [])];
    const rows = options.length ? options.map((x) => {
      const k = key(x), on = chosen.includes(k), full = !on && chosen.length >= max;
      return `<label class="mz-emergency-row${full ? ' disabled' : ''}"><input type="checkbox" data-helpkind="${kind}" data-helptarget="${esc(k)}" ${on ? 'checked' : ''} ${full || busy ? 'disabled' : ''}><span class="user-content">${esc(x.name || x.id)}</span><span class="small">${x.group ? mzT('群聊', 'Group') : '@' + esc(x.id)}</span></label>`;
    }).join('') : `<p class="small">${mzT('還沒有真人好友或群聊。', 'No friends or group chats yet.')}</p>`;
    const changed = picked[kind] && (picked[kind].length !== saved.length || picked[kind].some((k) => !saved.includes(k)));
    return `<div class="card mz-emergency"><h3>${TEXT[kind].title}</h3><p class="small">${TEXT[kind].about}</p>
      <p class="small">${mzT('最多 ' + max + ' 個，可以選真人或群聊。新加入的會收到沐水的通知。', 'Up to ' + max + ', friends or group chats. New ones get a note from 沐水.')}</p>
      <div class="mz-emergency-list">${rows}</div>
      <div class="sheet-actions"><button class="pill primary" type="button" data-helpsave="${kind}" ${!changed || busy ? 'disabled' : ''}>${busy === kind ? mzT('儲存中…', 'Saving…') : mzT('儲存', 'Save')}</button></div>
      <p class="small mz-emergency-diff">${DIFF}</p>
      ${kind === 'emergency' ? `<p class="small">${window.mzCrisisPlace ? window.mzCrisisPlace.line(window.mzCrisisPlace.here(), mzT('0', '1') === '1') : mzT('有立即危險請撥 119；想找人說話可以撥 1925 安心專線（24 小時）。', 'In immediate danger, call 119. To talk to someone, call the 1925 helpline (24 hours).')}</p>` : ''}
    </div>`;
  };
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
    const box = e.target.closest?.('input[data-helptarget]');
    if (!box || !info) return;
    const kind = box.dataset.helpkind, now = new Set(picked[kind] || (info[kind] || []).map(key));
    if (box.checked) now.add(box.dataset.helptarget); else now.delete(box.dataset.helptarget);
    picked[kind] = [...now].slice(0, info.max || 3);
    render();
  });
  const save = async (kind) => {
    if (busy || !picked[kind]) return;
    busy = kind; render();
    try { info = await W.humanRequest('/v1/emergency', { kind, contacts: picked[kind] }); picked[kind] = null; toast(mzT('已儲存', 'Saved')); }
    catch (e) { toast(String(e.message || e).replace(/^.*HTTP \d+[：:]\s*/, ''), 5000); }
    finally { busy = ''; render(); }
  };
  document.addEventListener('click', (e) => { const b = e.target.closest?.('[data-helpsave]'); if (b && !b.disabled) save(b.dataset.helpsave); });
}
