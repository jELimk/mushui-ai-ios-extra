'use strict';
// 3.4.1: tap a comment in Moments to reply to it — an AI's, a friend's or your own. The comment box opens with
// 「回覆 名字：」 already written; it is sent as a normal comment on the same post (own, AI or friends' posts alike).
{
  document.addEventListener('click', (e) => {
    const p = e.target.closest?.('.comments p:not(.accent)');
    if (!p || e.target.closest('a,button')) return;
    const post = p.closest('article, .moment'), btn = post?.querySelector('[data-comment]');
    if (!btn) return;
    const name = (p.textContent.split(/：|:/)[0] || '').trim().replace(/^回覆\s*\S+\s*/, '').slice(0, 30);
    if (!name) return;
    e.preventDefault(); e.stopPropagation();
    btn.click();
    setTimeout(() => {
      const t = document.querySelector('#commentText'); if (!t) return;
      const head = mzT(`回覆 ${name}：`, `Reply to ${name}: `);
      if (!t.value.startsWith(head)) t.value = head + t.value;
      t.placeholder = mzT(`回覆 ${name}…`, `Reply to ${name}…`);
      t.focus(); try { t.setSelectionRange(t.value.length, t.value.length); } catch {}
    }, 30);
  }, true);
  const css = document.createElement('style');
  css.textContent = `.comments p:not(.accent){cursor:pointer;border-radius:8px;margin-left:-4px;margin-right:-4px;padding-left:4px;padding-right:4px;transition:background-color .15s}
.comments p:not(.accent):active{background:color-mix(in srgb,var(--accent) 12%,transparent)}
@media(hover:hover){.comments p:not(.accent):hover{background:color-mix(in srgb,var(--accent) 8%,transparent)}}`;
  document.head.append(css);
}
