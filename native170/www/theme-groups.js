'use strict';
// 3.4.1: themes in four groups (Appearance):
//  - 馬卡龍 (Macaron): the original one-colour themes
//  - 都市 (City): soft two-colour gradients behind white frosted cards, with one matching ink colour
//  - 霓虹 (Neon): only the background and colours change — main, base and pop together; the layout is untouched
//  - 特殊 (Special): Liquid Glass, Moon Jelly, Cats — everything changes (pictures, icons, motion)
// applyTheme writes every field of a theme as a CSS variable (--n1, --c1 …), so the group styles below read them.
{
  const tint = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
  // neon: n1 main, n2 base, n3 pop; o1 / o3 = text on n1 / n3; dark = the base itself is dark
  const NEON = {
    neonSky: ['天空粉紅', '#0593C6', '#FCFFFF', '#D83995', '#ffffff', '#ffffff'],
    neonNight: ['午夜電光', '#0297DE', '#F3F8FB', '#FC734D', '#ffffff', '#1a0700'],
    neonGum: ['泡泡糖', '#09318D', '#FFFFFF', '#FD91CC', '#ffffff', '#3b0b2a'],
    neonAmber: ['天藍琥珀', '#0099FF', '#FDFDFE', '#F5290A', '#ffffff', '#ffffff'],
    neonPunk: ['螢光橙', '#F42902', '#FDFDFF', '#CCFF00', '#ffffff', '#1c2400'],
    neonJade: ['寶石翡翠', '#0042AC', '#F3FCFF', '#83FD80', '#ffffff', '#06331a'],
  };
  for (const [id, [name, n1, n2, n3, o1, o3, dark]] of Object.entries(NEON)) {
    themes[id] = { name, group: 'neon', accent: n1, deep: dark ? '#e8f6ff' : n1, soft: dark ? '#0d1a24' : tint(n1, .1), pink: tint(n3, .16), bg: n2, bubble: dark ? '#0b2a3d' : tint(n1, .12), cover: `linear-gradient(135deg,${n1},${n1} 55%,${n3})`, n1, n2, n3, o1, o3, ninkdark: dark ? '1' : '0' };
  }
  // city: two gradient ends + one ink colour taken from the pair
  const CITY = {
    cityLime: ['青檸紫霧', '#DDFFC2', '#EEE1FF', '#5fae3d'],
    cityNude: ['奶茶天藍', '#FFEAE1', '#B6FAFF', '#b0835f'],
    citySpring: ['春日藍', '#CFFFBD', '#B9DFFF', '#6e74b5'],
    cityBubble: ['粉色泡泡', '#DBDDFF', '#FFD0D0', '#e0786e'],
    cityAqua: ['薄荷玫瑰', '#ACFFF1', '#FFDCDC', '#2f9e7e'],
    cityButter: ['奶油天空', '#FFFFD0', '#D8EFFF', '#6f98b4'],
    cityCyan: ['粉末天青', '#B8FFF0', '#FFC5CE', '#d9707f'],
    cityLilac: ['黃紫迷人', '#FFFFD0', '#D2CDFF', '#8a83cf'],
  };
  for (const [id, [name, c1, c2, ink]] of Object.entries(CITY)) {
    themes[id] = { name, group: 'city', accent: ink, deep: ink, soft: tint(ink, .1), pink: tint(c2, .5), bg: c1, bubble: tint(ink, .14), cover: `linear-gradient(180deg,${c1},${c2})`, c1, c2, cink: ink };
  }
  const SPECIAL = ['glass', 'jelly', 'cat', 'cyber', 'cyberLight'];
  const groupOf = (id) => themes[id]?.group || (SPECIAL.includes(id) ? 'special' : 'macaron');

  const root = document.documentElement;
  const apply = () => {
    const t = themes[((typeof draft !== 'undefined' && draft) || state.settings).theme] || {};
    root.classList.toggle('mz-neon', t.group === 'neon');
    root.classList.toggle('mz-neon-dark', t.group === 'neon' && t.ninkdark === '1');
    root.classList.toggle('mz-city', t.group === 'city');
  };
  const before = applyTheme;
  applyTheme = function (...a) { const r = before.apply(this, a); try { apply(); } catch {} return r; };

  // the picker: one titled row per group
  const swatch = (id, t, sel) => {
    const g = groupOf(id);
    const face = g === 'neon' ? `background:linear-gradient(135deg,${t.n1} 10%,${t.n2} 50%,${t.n3} 90%);border:1px solid #0000001a`
      : g === 'city' ? `background:linear-gradient(160deg,${t.c1},${t.c2});border:1px solid #ffffffcc;box-shadow:inset 0 0 0 1px ${tint(t.cink, .25)}`
        : g === 'special' ? '' : `background:${t.soft};border:1px solid ${t.accent}`;
    return `<button class="swatch ${sel === id ? 'selected' : ''}" data-theme="${id}"><span${face ? ` style="${face}"` : ''}></span>${t.name}</button>`;
  };
  const GROUPS = [['macaron', '馬卡龍', 'Macaron', '一種顏色，柔和乾淨。', 'One soft colour.'], ['city', '都市', 'City', '兩種顏色的漸層，配白色霧面卡片。', 'A two-colour gradient with white frosted cards.'], ['neon', '霓虹', 'Neon', '只換背景和配色：主色、底色和亮色搭在一起，介面不變。', 'Only the background and colours change: a main colour, a base and a bright pop together; the layout stays the same.'], ['special', '特殊', 'Special', '全部都會換：畫面、圖示和動態。', 'Everything changes: pictures, icons and motion.']];
  const picker = () => {
    const sel = ((typeof draft !== 'undefined' && draft) || state.settings).theme;
    return GROUPS.map(([g, zh, en, dz, de]) => {
      const list = Object.entries(themes).filter(([id]) => groupOf(id) === g);
      if (!list.length) return '';
      return `<div class="mz-tg"><label>${mzT(zh, en)}</label><p class="help mz-tg-help">${mzT(dz, de)}</p><div class="swatches">${list.map(([id, t]) => swatch(id, t, sel)).join('')}</div></div>`;
    }).join('');
  };
  const pageBefore = appearancePage;
  appearancePage = function (...a) {
    const html = pageBefore.apply(this, a);
    // the original single row: <label>馬卡龍主題</label><div class="swatches"> … </div> (just before its help line)
    return html.replace(/<label>(?:馬卡龍主題|Macaron themes)<\/label><div class="swatches">[\s\S]*?<\/div>(?=<p class="help">)/, (m) => picker() + (m.match(/<div class="card mz-glassfx-card">[\s\S]*$/)?.[0] || "")); // keep the glass-effect card (glass-theme.js puts it in here)
  };

  const N = 'html.mz-neon:not(.mz-dark):root', NA = 'html.mz-neon:root', CI = 'html.mz-city:not(.mz-dark):root';
  const css = document.createElement('style');
  css.textContent = `
.mz-tg{margin:0 0 14px}.mz-tg>label{display:block;margin-bottom:2px}.mz-tg-help{margin:0 0 8px}
/* ---------- neon: only colours and the background change (3.4.2: no size / padding / corner changes) ----------
   the three colours work together: main (n1) on bars, icons and my bubbles; pop (n3) on buttons, switches, the chosen
   tab and unread dots; the background mixes all three over the base (n2) */
${N} body{background:radial-gradient(70% 50% at 0% 0%,color-mix(in srgb,var(--n1) 22%,transparent),transparent 70%),radial-gradient(60% 45% at 100% 100%,color-mix(in srgb,var(--n3) 26%,transparent),transparent 72%),radial-gradient(45% 35% at 100% 8%,color-mix(in srgb,var(--n3) 14%,transparent),transparent 70%),radial-gradient(50% 40% at 0% 100%,color-mix(in srgb,var(--n1) 12%,transparent),transparent 72%),var(--n2)!important;background-attachment:fixed!important}
${N} #app{background:transparent!important}
${N} :is(.unread,.badge,.mz-unread-dot,.nav .dot){background:var(--neon-pop)!important;color:var(--o3)!important}
${N} .nav button.active .nav-icon,${N} .nav button.active svg{color:var(--n1)!important}
${N} :is(a,.link-button:not(.danger)){color:var(--n1)!important}
${N} .search{border-color:color-mix(in srgb,var(--n1) 22%,transparent)!important}
${N}{--bg:var(--n2)!important;--accent:var(--n1)!important}
${N}{--neon-main:linear-gradient(135deg,var(--n1),color-mix(in srgb,var(--n1) 62%,var(--n3)));--neon-pop:linear-gradient(135deg,var(--n3),color-mix(in srgb,var(--n3) 62%,var(--n1)))}
${N} :is(.page>.top,.conversation .top){background:var(--neon-main)!important;color:var(--o1)!important}
${N} :is(.page>.top,.conversation .top) :is(h1,h2,h3,.sub,.eyebrow,small,.small,.icon-button,.top-title){color:var(--o1)!important}
${N} :is(.page>.top,.conversation .top) :is(.icon-button,button:not(.pill):not(.mz-me-head)){background:#ffffff2e!important;color:var(--o1)!important;border:0!important;box-shadow:none!important}
${N} .page>.top .mz-me-head .mz-me-face{background:#ffffff2e!important;color:var(--o1)!important;border-color:#ffffff66!important}
${N} .page>.top .mz-me-head strong{color:var(--o1)!important}
${N} .page>.top .mz-me-head small{color:var(--o1)!important;opacity:.9}
${N} :is(.page>.top,.conversation .top) svg{color:var(--o1)!important;stroke:currentColor}
${N} .primary,${N} .composer button[type=submit]{background:var(--neon-pop)!important;color:var(--o3)!important;border:0!important;box-shadow:0 8px 20px -10px var(--n3)!important}
${N} .switch.on{background:var(--neon-pop)!important}
${N} .mine .bubble{background:var(--neon-main)!important;color:var(--o1)!important}
${N} .selected,${N} .contact-mode>button.selected,${N} .mz-segs>.mz-seg.selected{background:var(--neon-pop)!important;color:var(--o3)!important}
${N} .nav button.active{color:var(--n1)!important}
html.mz-neon.mz-neon-dark:not(.mz-dark):root{--ink:#f4fbff!important;--muted:#9fb6c6!important;--line:#1b2a36!important;--surface:#0c151d!important;--card:#0c151d!important;color:#f4fbff}
html.mz-neon.mz-neon-dark:not(.mz-dark):root body{background:var(--n2)!important}
html.mz-neon.mz-neon-dark:not(.mz-dark):root :is(.card,.wx-menu-group,.chat-entry,.sheet,input,textarea,.search){background:#0c151d!important;color:#f4fbff!important}
${NA} .mine .bubble a{color:inherit}
/* ---------- city: a two-colour gradient, white frosted cards, one ink ---------- */
${CI}{--accent:var(--cink)!important;--accent-deep:var(--cink)!important}
${CI} body{background:linear-gradient(180deg,var(--c1),var(--c2)) fixed!important}
${CI} #app,${CI} .page,${CI} .conversation,${CI} .content{background:transparent!important}
${CI} :is(.card,.wx-menu-group,.chat-entry,.soft-note,.search){background:#ffffff8c!important;border:1px solid #ffffffd9!important;box-shadow:0 10px 24px -16px var(--cink),inset 0 1px 0 #fff!important;border-radius:20px!important}
${CI} .chat-entry>.chat-row{padding:14px 4px 14px 14px!important}
${CI} .chat-entry>.chat-menu-button{margin-right:10px!important}
${CI} :is(.page>.top,.conversation .top,#app>.nav,.conversation>.composer){background:#ffffff73!important;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
${CI} :is(h1,h2,h3){color:var(--cink)!important}
${CI} .primary,${CI} .composer button[type=submit]{background:var(--cink)!important;color:#fff!important;border:0!important;box-shadow:0 10px 22px -12px var(--cink)!important}
${CI} .switch.on{background:var(--cink)!important}
${CI} .mine .bubble{background:linear-gradient(135deg,var(--c1),var(--c2))!important;color:#333!important;border:1px solid #ffffffcc!important}
${CI} .sheet{background:#fffffff2!important}
`;
  document.head.append(css);
  apply();
  window.mzThemeGroups = { groupOf };
}
