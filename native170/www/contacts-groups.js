'use strict';
// 3.4.1: contacts in plain groups. No A–Z letter rows and no group titles any more; a thin line only where two groups
// meet. AI: official account → (cat theme: the three cats) → favourites → stars → everyone else. People: favourites → stars →
// everyone else (at most 2 lines). A group with nobody in it takes no space and adds no line. Rows keep their ♡ / ☆ marks.
{
  const before = contactsView;
  contactsView = function (...a) {
    const html = before.apply(this, a);
    try {
      const tpl = document.createElement('template'); tpl.innerHTML = html;
      // the list is the .content that holds contact rows (the people page also has a .content for the account row)
      const list = [...tpl.content.querySelectorAll('.content')].find((c) => c.querySelector('.contact-row, .contact-entry, .human-row, [data-humanprofile]') && !c.querySelector('.friend-requests, [data-action="humanAccount"]'))
        || [...tpl.content.querySelectorAll('.content')].at(-1);
      if (!list) return html;
      const groups = [];
      let rest = null;
      for (const node of [...list.childNodes]) {
        if (node.nodeType === 1 && node.matches('.letter')) { node.remove(); continue; }
        if (node.nodeType === 1 && node.matches('section.contact-favorites')) {
          node.querySelector(':scope > .favorites-title')?.remove();
          node.classList.add('mz-cgroup');
          groups.push(node); rest = null; continue;
        }
        if (node.nodeType === 3 && !node.textContent.trim()) continue;
        if (!rest) { rest = document.createElement('section'); rest.className = 'mz-cgroup mz-cgroup-rest'; node.before(rest); groups.push(rest); }
        rest.append(node);
      }
      // 3.4.2: the cat theme's three cats get their own group, right under the official account (in 水沐 always)
      if (contactMode !== 'human' && (document.documentElement.classList.contains('mz-cat') || window.MizukiStaffEdition)) {
        const order = window.mzCatFriends?.CATS?.map((c) => c.id) || [];
        const cats = [...list.querySelectorAll('[data-contact^="mz-cat-"]')].sort((x, y) => order.indexOf(x.dataset.contact) - order.indexOf(y.dataset.contact)).map((b) => b.closest('.contact-entry') || b);
        if (cats.length) {
          const sec = document.createElement('section'); sec.className = 'mz-cgroup mz-cgroup-cats'; cats.forEach((c) => sec.append(c));
          const off = groups.find((g) => g.matches('.official-contact-section'));
          if (off) { off.after(sec); groups.splice(groups.indexOf(off) + 1, 0, sec); } else { (groups[0] || list.firstChild)?.before?.(sec) || list.prepend(sec); groups.unshift(sec); }
        }
      }
      const filled = groups.filter((g) => g.children.length);
      // nobody yet on the AI side (the official account doesn't count): say what to do and offer the buttons right here
      const realRows = list.querySelectorAll('.contact-row:not([data-action="openOfficialProfile"]), [data-humancontact]').length;
      if (contactMode !== 'human' && !realRows && !String(search || '').trim()) {
        list.insertAdjacentHTML('beforeend', `<div class="empty mz-contacts-empty"><h2>${mzT('還沒有 AI', 'No AIs yet')}</h2><p>${mzT('匯入角色檔，或自訂一位 AI，熟悉的名字就會出現在這裡。', 'Import a character file or create your own AI, and familiar names will show up here.')}</p><div class="flex" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="pill primary" data-action="import">${mzT('匯入角色檔', 'Import character file')}</button></div></div>`);
      }
      groups.filter((g) => !g.children.length).forEach((g) => g.remove());
      // one divider in the gap between two groups (not stuck to the last row), drawn in the theme's style
      filled.forEach((g, i) => { if (i) g.before(Object.assign(document.createElement('div'), { className: 'mz-cdivider', role: 'separator' })); });
      // phones: everything under the AI / 人類 buttons in one box, so a swipe slides the whole page below them
      // (before, only the first box moved — on 人類 that was just the ID row — and the rest popped in by itself)
      const mode = tpl.content.querySelector('.contact-mode');
      if (mode && !document.querySelector('.desktop-shell')) {
        const pane = document.createElement('div'); pane.className = 'mz-cpane';
        while (mode.nextSibling) pane.append(mode.nextSibling);
        mode.after(pane);
      }
      return tpl.innerHTML;
    } catch { return html; }
  };
  const css = document.createElement('style');
  css.textContent = `.mz-cgroup.contact-favorites,.mz-cgroup{border:0!important;padding:0!important;margin:0!important}
.mz-cdivider{height:1px;margin:12px 0;background:var(--line)}
html.mz-jelly:root .mz-cdivider{height:6px;background:var(--jl-wave) left 14px center/64px 6px repeat-x}
html.mz-jelly:root .mz-cgroup.contact-favorites :is(.setting-row,.contact-row,.wx-menu-row,.letter):last-child{background-image:none!important}
@media(min-width:850px){.mz-cpane>.search{max-width:566px;margin-left:auto;margin-right:auto}}`;
  document.head.append(css);
}
