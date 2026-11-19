'use strict';
// 3.4.1: 液態玻璃 (Glassmorphism) theme, also usable as a 玻璃效果 switch on any other theme (外觀). A grey-white background (dark in dark mode); every surface is clear frosted
// glass with a bright top-left edge and a soft deep shadow.
// The mouse over something tilts it toward the pointer with a glare that follows (like a tilting glass card);
// pressing tilts a little more. On a phone, a long press does the same while the finger stays down.
{
  themes.glass = { name: '液態玻璃', accent: '#26262b', deep: '#111114', soft: '#f1f1f3', pink: '#e7e7ea', bg: '#ececec', bubble: '#ffffff', cover: 'linear-gradient(135deg,#f4f4f6,#dcdce0)' };

  const root = document.documentElement;
  // Two ways in: the 液態玻璃 theme itself (grey-white, "pure" glass), or the 玻璃效果 switch on top of any colour theme.
  const cur = () => { try { return (typeof draft !== 'undefined' && draft) || state.settings; } catch { return {}; } };
  const pure = () => cur().theme === 'glass';
  // 水母 (jelly) is built on the glass interface too, with its own sea colours (jelly-theme.js).
  const jelly = () => cur().theme === 'jelly';
  const on = () => pure() || jelly() || !!cur().glassEffect;
  const sync = () => { root.classList.toggle('mz-glass', on()); root.classList.toggle('mz-glass-pure', pure()); root.classList.toggle('mz-glass-fx', on() && !pure() && !jelly()); };
  // mz-glass-fx: the switch on a normal theme — glass UI only, the theme's own background stays (no aurora).
  // The pearl backdrop follows the theme: 芋泥紫's pearl stops turned by (theme hue − 芋泥紫 hue), lightness and
  // saturation kept. The 液態玻璃 theme itself (no hue of its own) keeps 芋泥紫's pearl.
  const LIGHT = ['f7c8e4', 'd2c2fb', 'bfeae2', 'c9cffb', 'fbc4dc', 'bdd9fb', 'c8efd8', 'fbdcc4'];
  const DARK = ['3a2140', '2b2350', '17393a', '242a55', '42213a', '1a2f52', '1a3a2c', '3d2a22'];
  const hsl = (h) => { const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn), hue = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [hue / 6, sat, l]; };
  const hex = (h, sat, l) => { const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q, f = (t) => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return '#' + [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); };
  let pearlFor = null;
  const pearl = () => {
    const t = themes[cur().theme] || themes.lilac, src = (pure() ? themes.lilac : t).accent.slice(1);
    if (pearlFor === src) return;
    pearlFor = src;
    const turn = hsl(src)[0] - hsl(themes.lilac.accent.slice(1))[0];
    LIGHT.forEach((c, i) => { const [h, sa, l] = hsl(c); root.style.setProperty('--mz-p' + (i + 1), hex(h + turn, sa, l)); });
    DARK.forEach((c, i) => { const [h, sa, l] = hsl(c); root.style.setProperty('--mz-d' + (i + 1), hex(h + turn, sa, l)); });
  };
  const before = applyTheme;
  applyTheme = function (...a) { const r = before.apply(this, a); try { sync(); pearl(); } catch {} return r; };

  const GLASS = '.setting-choice,.wx-menu-group,.chat-menu-button,.card,.bubble,.pill:not(.primary):not(.hangup),.icon-button,.chip,.swatch,.search,.soft-note,.provider-grid button,.model-grid button,.memory-grid button,.save,.sheet,.login-gate-card,.setting-row .setting-icon';
  const BIG = '.wx-menu-group,.card,.sheet,.soft-note,.login-gate-card';
  const sel = (s, pre) => s.split(',').map((x) => pre + ' ' + x).join(',');
  const css = document.createElement('style');
  css.id = 'mz-glass-css';
  css.textContent = `
html.mz-glass{--glass:#ffffff4d;--glass-strong:#ffffffa6;--glass-edge:#1e1e3c1f;--glass-hi:#ffffff;--glass-line:#1e1e3c14;--glass-shade:0 2px 6px #1e1e3c12,inset 0 0 0 1px #ffffff80;--glass-deep:20px 20px 50px #1e1e3c26,inset 0 0 0 1px #ffffff80}
html.mz-glass.mz-dark{--glass:#ffffff17;--glass-strong:#1d1d30b3;--glass-edge:#ffffff24;--glass-hi:#ffffff6b;--glass-line:#ffffff1a;--glass-shade:0 3px 8px #0000004d,inset 0 0 0 1px #ffffff12;--glass-deep:20px 20px 50px #00000080}
/* the backdrop: pearlescent white like an iridescent figure — mostly white and the theme's palest tint, with very
   soft neighbouring tints flowing through it, plus gentle white highlights; fixed behind everything.
   The stops (--mz-p1…8) are 芋泥紫's pearl turned to the current theme's hue by pearl() below. */
html.mz-glass{--mz-iri-base:#f4f2f7}
html.mz-glass.mz-dark{--mz-iri-base:#1a1920}
html.mz-glass:not(.mz-glass-fx){background:var(--mz-iri-base)!important}
/* soft aurora: big pastel patches with real colour (so the white glass on top clearly floats), one gentle light
   in the middle, drawn once as its own layer */
html.mz-glass:not(.mz-glass-fx)::before{content:"";position:fixed;inset:-10%;z-index:-1;pointer-events:none;transform:translateZ(0);background:
 radial-gradient(55% 45% at 10% 8%,var(--mz-p2,#d2c2fb) 0,transparent 70%),
 radial-gradient(50% 42% at 92% 12%,var(--mz-p6,#bdd9fb) 0,transparent 70%),
 radial-gradient(48% 40% at 6% 52%,var(--mz-p5,#fbc4dc) 0,transparent 72%),
 radial-gradient(50% 45% at 96% 58%,var(--mz-p3,#bfeae2) 0,transparent 72%),
 radial-gradient(55% 45% at 30% 96%,var(--mz-p7,#c8efd8) 0,transparent 72%),
 radial-gradient(50% 42% at 82% 96%,var(--mz-p8,#fbdcc4) 0,transparent 72%),
 radial-gradient(40% 30% at 50% 42%,#ffffff8c 0,transparent 75%),
 linear-gradient(160deg,var(--mz-p4,#c9cffb),var(--mz-p1,#f7c8e4))}
html.mz-glass.mz-dark:not(.mz-glass-fx)::before{background:
 radial-gradient(55% 45% at 10% 8%,var(--mz-d2,#2b2350) 0,transparent 70%),
 radial-gradient(50% 42% at 92% 12%,var(--mz-d6,#1a2f52) 0,transparent 70%),
 radial-gradient(48% 40% at 6% 52%,var(--mz-d5,#42213a) 0,transparent 72%),
 radial-gradient(50% 45% at 96% 58%,var(--mz-d3,#17393a) 0,transparent 72%),
 radial-gradient(55% 45% at 30% 96%,var(--mz-d7,#1a3a2c) 0,transparent 72%),
 radial-gradient(50% 42% at 82% 96%,var(--mz-d8,#3d2a22) 0,transparent 72%),
 linear-gradient(160deg,var(--mz-d4,#242a55),var(--mz-d1,#3a2140))}
html.mz-glass:not(.mz-glass-fx):root body{background:transparent!important}
/* pure glass (light): black text everywhere, grey for the quieter text */
html.mz-glass-pure:not(.mz-dark){--ink:#111114!important;--muted:#55555e!important;--accent-deep:#111114!important;color:#111114}
html.mz-glass-pure:not(.mz-dark) body,html.mz-glass-pure:not(.mz-dark) .eyebrow,html.mz-glass-pure:not(.mz-dark) .letter,html.mz-glass-pure:not(.mz-dark) .chevron,html.mz-glass-pure:not(.mz-dark) .typing,html.mz-glass-pure:not(.mz-dark) .footer-note{color:#111114!important}
html.mz-glass-pure.mz-dark{--accent:#d9d9df!important;--accent-deep:#f2f2f5!important}
html.mz-glass-pure.mz-dark .eyebrow,html.mz-glass-pure.mz-dark .nav button.active,html.mz-glass-pure.mz-dark .account-connection-notice{color:#f2f2f5!important}
html.mz-glass-pure.mz-dark .account-connection-notice{background:#ffffff14!important}
html.mz-glass-pure:not(.mz-dark) .nav button{color:#55555e!important}html.mz-glass-pure:not(.mz-dark) .nav button.active{color:#111114!important}
/* pure glass: every control is black and white — filled buttons and the send button black with white text, the rest white glass */
html.mz-glass-pure:root .primary,html.mz-glass-pure:root .composer button[type=submit],html.mz-glass-pure:root .switch.on,html.mz-glass-pure:root .save.saved{background:#111114!important;color:#fff!important;border-color:#111114!important;box-shadow:0 3px 10px #0000002e!important}
html.mz-glass-pure:root .selected{background:#ffffffe6!important;color:#111114!important;border-color:transparent!important;box-shadow:0 2px 10px #1e1e3c1f,inset 0 0 0 1px #ffffffcc!important}
html.mz-glass-pure.mz-dark:root .primary,html.mz-glass-pure.mz-dark:root .composer button[type=submit],html.mz-glass-pure.mz-dark:root .switch.on{background:#fff!important;color:#111114!important;border-color:#fff!important}
html.mz-glass-pure.mz-dark:root .selected{background:#ffffff2b!important;color:#fff!important;border-color:transparent!important;box-shadow:0 2px 10px #0000004d,inset 0 0 0 1px #ffffff26!important}
/* 我 page: the grey band between the profile and the menu isn't needed when the menu cards float; the status bubble is glass */
html.mz-glass:root .wx-divider{background:transparent!important}
html.mz-glass:root .wx-my-profile{background:transparent!important}
html.mz-glass:root .wx-status-bubble{background:var(--glass)!important;border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;box-shadow:var(--glass-shade)!important}
/* 我 page icons keep their own colours; 收藏 follows the theme hue elsewhere, so give it back its purple here */
html.mz-glass-pure:root .wx-menu-icon.color{color:#a274c0!important}
/* pure glass: avatars without a photo are white too (group faces and their tiles included) */
html.mz-glass-pure:root .avatar,html.mz-glass-pure:root .avatar.mizuki-group-face i{background:#fff!important;border-color:#fff!important;box-shadow:0 2px 8px #1e1e3c1a}
html.mz-glass-pure:root .avatar.mizuki-group-face{background:#ffffffb3!important}
html.mz-glass-pure:root .avatar.mizuki-group-face i{box-shadow:inset 0 0 0 1px #1e1e3c0f}
html.mz-glass-pure.mz-dark:root .avatar,html.mz-glass-pure.mz-dark:root .avatar.mizuki-group-face i{background:#ffffffe6!important;color:#2a2440!important}
html.mz-glass:root{--surface:var(--glass)!important}
html.mz-glass:root .page,html.mz-glass:root .conversation,html.mz-glass #app{background-color:transparent!important}
html.mz-glass #app{border-color:transparent!important}
${sel(GLASS, 'html.mz-glass:root')}{background:var(--glass)!important;border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;box-shadow:var(--glass-shade)!important}
${sel(BIG, 'html.mz-glass:root')}{box-shadow:var(--glass-deep)!important}
html.mz-glass:root .sheet{background:#ffffff8c!important;-webkit-backdrop-filter:blur(28px) saturate(140%);backdrop-filter:blur(28px) saturate(140%)}
html.mz-glass.mz-dark:root .sheet{background:#1d1d30a6!important}
/* popups are one even sheet of glass: their title strip has no fill of its own */
html.mz-glass:root .sheet .sheet-title,html.mz-glass:root .sheet>.top,html.mz-glass:root .sheet header{background:transparent!important;box-shadow:none!important;border-color:transparent!important}
html.mz-glass:root .sheet .sheet-title::after,html.mz-glass:root .sheet .sheet-title::before{display:none!important}
html.mz-glass:root .mine .bubble{background:color-mix(in srgb,var(--accent) 28%,var(--glass))!important}
html.mz-glass:root .top,html.mz-glass:root .conversation .top,html.mz-glass:root .nav,html.mz-glass:root .composer{background:var(--glass)!important;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border-color:var(--glass-line)!important}
html.mz-glass:root .composer textarea,html.mz-glass input:not([type=checkbox]):not([type=radio]):not([type=range]),html.mz-glass textarea,html.mz-glass select{background:var(--glass)!important;border:1px solid var(--glass-line)!important}
html.mz-glass:root .search input:not([type=checkbox]):not([type=radio]):not([type=range]){background:transparent!important;border:0!important;box-shadow:none!important}
html.mz-glass:root .chat-row,html.mz-glass:root .setting-row,html.mz-glass:root .contact-row,html.mz-glass:root .letter,html.mz-glass:root .moment{border-color:var(--glass-line)!important}
/* everything floats: panels are rounded glass with a gap and a shadow, the grey-white shows between them */
html.mz-glass:root .desktop-shell{background:transparent!important;padding:12px;gap:0 12px;box-sizing:border-box}
html.mz-glass:root .desktop-workspace{background:transparent!important;min-height:0}
html.mz-glass:root .desktop-workspace>.conversation{height:100%!important}
html.mz-glass:root .desktop-rail,html.mz-glass:root .desktop-sidebar{background:var(--glass)!important;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;border-radius:24px;box-shadow:var(--glass-deep)!important;overflow:hidden;height:auto!important;min-height:0}
html.mz-glass:root .desktop-rail .nav{background:transparent!important;-webkit-backdrop-filter:none;backdrop-filter:none;border-color:transparent!important;box-shadow:none!important}
html.mz-glass:root .conversation .top,html.mz-glass:root .conversation>.composer,html.mz-glass:root #app>.nav{background:var(--glass)!important;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;box-shadow:var(--glass-deep)!important}
html.mz-glass:root .conversation .top{margin:10px 10px 0;border-radius:20px}
html.mz-glass:root .conversation>.composer{margin:0 10px 10px;border-radius:22px}
html.mz-glass:root #app>.nav{left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));border-radius:24px;padding-bottom:12px}
/* page headers: the page's own colour, no blur — a blur edge on a clear header showed as a flickering white line while scrolling */
/* page headers: the same bar as 朋友圈 — full width, see-through frosted glass with a blur, no frame */
html.mz-glass:root .page>.top:not(.moment-top),html.mz-glass:root .desktop-sidebar .top{background:var(--glass)!important;-webkit-backdrop-filter:blur(20px)!important;backdrop-filter:blur(20px)!important;border:0!important;border-radius:0;box-shadow:none!important;margin:0 0 16px}
/* computer: the sync notice is a rounded see-through glass bar (phones keep the plain full-width strip) */
html.mz-glass:root .desktop-shell .account-connection-notice{background:var(--glass)!important;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;border-radius:16px;margin:0 0 10px;width:100%;box-shadow:var(--glass-shade)!important}
/* computer: the right-hand area's headers (and the 朋友圈 bar there) are floating rounded glass, like the panels beside them */
html.mz-glass:root .desktop-workspace .page>.top,html.mz-glass:root .desktop-workspace .moment-top{border-radius:22px!important;margin:0 0 16px!important;border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;box-shadow:var(--glass-shade)!important}
html.mz-glass:root .desktop-workspace .moment-top{left:0!important;right:0!important;top:0!important;margin:0!important;width:auto!important}
html.mz-glass:root .composer button[type=submit]{background:var(--accent)!important;color:#fff!important;border-color:#ffffff59!important}
html.mz-glass.mz-dark:root .composer button[type=submit]{background:#fff!important;color:#2a2440!important}
html.mz-glass:root .search,html.mz-glass:root .desktop-shell .search{background:#ffffff38!important;box-shadow:none!important}
html.mz-glass.mz-dark:root .search,html.mz-glass.mz-dark:root .desktop-shell .search{background:#ffffff0d!important}
/* home chat list: every chat is its own floating glass card */
html.mz-glass:root .chat-entry,html.mz-glass:root .content>.chat-row{background:var(--glass)!important;border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;border-radius:20px;box-shadow:var(--glass-shade)!important;margin:0 0 11px;align-items:center}
html.mz-glass:root .chat-entry{padding:0 10px 0 0}
html.mz-glass:root .chat-entry>.chat-row{background:transparent!important;border:0!important;box-shadow:none!important;padding:13px 4px 13px 14px}
html.mz-glass:root .content>.chat-row{padding:13px 14px}
html.mz-glass:root .chat-entry:has(.desktop-selected-chat),html.mz-glass:root .content>.chat-row.desktop-selected-chat{background:color-mix(in srgb,var(--accent) 16%,var(--glass))!important}
/* composer: the + and sticker buttons are flat glass with dark icons (they were white on white) */
html.mz-glass:root .composer .icon-button:not([type=submit]){background:#ffffff38!important;color:var(--ink)!important;box-shadow:none!important;border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important}
html.mz-glass:root .icon-button,html.mz-glass:root .pill:not(.primary):not(.hangup),html.mz-glass:root .chip{color:var(--ink)}
html.mz-glass.mz-dark:root .composer .icon-button:not([type=submit]){background:#ffffff14!important}
/* the + menu and the sticker panel: a floating glass sheet with a gap above the input bar (not a solid block on it) */
html.mz-glass:root .conversation>.sticker-panel,html.mz-glass:root .conversation>.composer-menu{background:var(--glass-strong)!important;-webkit-backdrop-filter:blur(24px) saturate(150%);backdrop-filter:blur(24px) saturate(150%);border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;border-radius:22px;box-shadow:var(--glass-shade)!important;margin:0 10px 10px;padding-bottom:14px}
/* a sticker on its own is just the sticker: no bubble, glass or shadow behind it */
html.mz-glass:root .message .bubble:is(.sticker-only,.photo-only),html.mz-glass:root .bubble.sticker-only,html.mz-glass:root .bubble:has(>.chat-sticker:only-child){background:transparent!important;border-color:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none;backdrop-filter:none;padding:0}
html.mz-glass:root .composer textarea{background:#ffffff38!important;box-shadow:none!important}
html.mz-glass.mz-dark:root .composer textarea{background:#ffffff0d!important}
html.mz-glass:root .nav .active .nav-icon{background:var(--glass-strong)!important}
html.mz-glass:root .primary{background:color-mix(in srgb,var(--accent) 85%,transparent)!important;color:#fff!important;border:1px solid #ffffff59!important;box-shadow:0 5px 15px color-mix(in srgb,var(--accent) 30%,transparent),inset 0 1px 0 #ffffff66!important}
html.mz-glass.mz-dark:root .primary{background:#fff!important;color:#2a2440!important;border:0!important;box-shadow:0 5px 15px #00000033!important}
/* selected things: a bright white frosted pill with a soft shadow (theme-coloured text), instead of a grey wash */
html.mz-glass:root .selected{background:#ffffffe6!important;color:var(--accent-deep)!important;border-color:transparent!important;box-shadow:0 2px 10px #1e1e3c1f,inset 0 0 0 1px #ffffffcc!important}
html.mz-glass.mz-dark:root .selected{background:#ffffff2b!important;color:#fff!important;box-shadow:0 2px 10px #0000004d,inset 0 0 0 1px #ffffff26!important}
/* segmented choices (AI / 人類, 深色模式…): a glass track with the white pill riding on it */
html.mz-glass:root .contact-mode,html.mz-glass:root .mz-segs{background:var(--glass)!important;border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;border-radius:16px!important;padding:4px!important;box-shadow:var(--glass-shade)!important}
html.mz-glass:root .contact-mode>button,html.mz-glass:root .mz-segs>.mz-seg{border-radius:12px!important;color:var(--muted)!important;background:transparent!important;box-shadow:none!important}
html.mz-glass:root .contact-mode>button.selected,html.mz-glass:root .mz-segs>.mz-seg.selected{background:#fff!important;color:var(--accent-deep)!important;font-weight:650;box-shadow:0 2px 10px #1e1e3c24,inset 0 0 0 1px #ffffffcc!important}
html.mz-glass.mz-dark:root .contact-mode>button.selected,html.mz-glass.mz-dark:root .mz-segs>.mz-seg.selected{background:#ffffff2e!important;color:#fff!important;box-shadow:0 2px 10px #00000059,inset 0 0 0 1px #ffffff26!important}
html.mz-glass:root .modal-backdrop{background:#16162344}
.swatch[data-theme=glass] span{background:linear-gradient(135deg,#ffffffd9,#ffffff59)!important;border:1px solid #ffffff!important;box-shadow:inset 0 0 0 1px #ffffff80,2px 3px 8px #1e1e3c26,0 0 0 1px #1e1e3c14!important}
/* things that tilt and shine need round corners, or the glow shows as a square */
html.mz-glass:root .nav button,html.mz-glass:root .profile-card{border-radius:16px}
/* rows with a divider stay straight (a rounded row bends its divider into a ring); only their glow is rounded */
html.mz-glass:root :is(.setting-row,.contact-row,.moment,.wx-menu-row).mz-tilt::after{border-radius:14px}
.mz-glassfx-card{margin-top:18px!important}
.mz-tilt{transition:transform .4s cubic-bezier(.03,.98,.52,.99);transform:perspective(1000px) rotateX(var(--mz-rx,0deg)) rotateY(var(--mz-ry,0deg)) scale(var(--mz-sc,1))!important;will-change:transform}
.mz-tilt.mz-live{transition:transform .12s ease-out;z-index:2}
/* the glare is the element's own ::after layer, not an extra child, so :last-child / :first-child rules (like the
   last row having no divider) keep working while something is hovered or held */
.mz-tilt:not(.mz-photo-more)::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:3;opacity:0;transition:opacity .3s;background:linear-gradient(var(--mz-ga,180deg),#ffffff 0%,#ffffff00 75%)}
.mz-tilt.mz-glare:not(.mz-photo-more)::after{opacity:var(--mz-glare,.25)}
@media(prefers-reduced-motion:reduce){.mz-tilt{transform:none!important}}
`;
  document.head.append(css);

  // ---- tilt and glare (only in this theme) ----
  const TARGET = '.card,.bubble,.pill,.icon-button,.chip,.swatch,.chat-row,.contact-row,.setting-row,.wx-menu-row,.moment,.profile-card,.provider-grid button,.model-grid button,.memory-grid button,.photos button,.nav button,.save';
  const MAX = 12;
  // A card or group that holds rows is the base layer: it stays still, and only the rows on it tilt and shine.
  const BASE = '.card,.wx-menu-group,.sheet,.soft-note,.login-gate-card';
  const ITEM = TARGET + ',.wx-menu-row,button,a,[data-page],[data-action]';
  const pick = (t) => {
    let el = t.closest?.(TARGET) || null;
    if (el && el.parentElement?.matches('.chat-entry')) el = el.parentElement;
    if (el && el.matches(BASE) && el.querySelector(ITEM)) return null;
    return el;
  };
  let held = null, hover = null, frame = 0, last = null, timer = 0, start = null;
  // Show the glare (the ::after layer needs a positioned element to sit on).
  const glare = (el) => {
    if (!el.dataset.mzPos && getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.dataset.mzPos = '1'; }
    el.classList.add('mz-glare');
  };
  // Let go of an element: it springs back flat, the glare fades, and the helpers are removed afterwards.
  const settle = (el) => {
    if (!el) return;
    el.classList.remove('mz-live');
    for (const p of ['--mz-rx', '--mz-ry', '--mz-sc']) el.style.removeProperty(p);
    el.classList.remove('mz-glare');
    setTimeout(() => {
      if (el === held || el === hover) return;
      el.classList.remove('mz-tilt');
      for (const p of ['--mz-ga', '--mz-glare']) el.style.removeProperty(p);
      if (el.dataset.mzPos) { el.style.position = ''; delete el.dataset.mzPos; }
    }, 420);
  };
  const paint = () => {
    frame = 0;
    const el = held || hover; if (!el || !last || !el.isConnected) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const x = Math.min(1, Math.max(0, (last.x - r.left) / r.width)), y = Math.min(1, Math.max(0, (last.y - r.top) / r.height));
    // Bigger things tilt less, so a wide card or chat row doesn't swing its far edge too much.
    const k = Math.min(1, 260 / Math.max(r.width, r.height)) * 0.6 + 0.4, press = el === held ? 1.25 : 1;
    el.style.setProperty('--mz-ry', ((x - 0.5) * 2 * MAX * k * press).toFixed(2) + 'deg');
    el.style.setProperty('--mz-rx', ((0.5 - y) * 2 * MAX * k * press).toFixed(2) + 'deg');
    el.style.setProperty('--mz-sc', el === held ? '1.04' : '1.025');
    // The glare comes from the side the pointer is on, brighter toward the top.
    el.style.setProperty('--mz-ga', (Math.atan2(x - 0.5, -(y - 0.5)) * 180 / Math.PI + 180).toFixed(0) + 'deg');
    el.style.setProperty('--mz-glare', (0.12 + (1 - y) * 0.33).toFixed(2));
  };
  const move = (e) => { last = { x: e.clientX, y: e.clientY }; if (!frame) frame = requestAnimationFrame(paint); };
  const lift = (el, e) => { el.classList.add('mz-tilt', 'mz-live'); glare(el); move(e); };
  const release = () => {
    clearTimeout(timer); timer = 0; start = null;
    const el = held; held = null;
    if (!el) return;
    if (el === hover) move(last ? { clientX: last.x, clientY: last.y } : { clientX: 0, clientY: 0 }); else settle(el);
  };
  const active = () => root.classList.contains('mz-glass');

  document.addEventListener('pointerdown', (e) => {
    if (!active() || e.button > 0) return;
    const el = pick(e.target); if (!el || el.closest('.mz-lock')) return;
    if (e.pointerType === 'mouse') { held = el; lift(el, e); return; }
    // Finger: only after a long press, so normal taps and scrolling stay the same.
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => { timer = 0; if (start && el.isConnected) { held = el; lift(el, { clientX: start.x, clientY: start.y }); } }, 320);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!active()) return;
    if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) { clearTimeout(timer); timer = 0; start = null; }
    if (held) { move(e); return; }
    if (e.pointerType !== 'mouse') return;
    const el = pick(e.target);
    if (el !== hover) { const old = hover; hover = el; settle(old); if (el) lift(el, e); }
    else if (el) move(e);
  }, { passive: true });
  // While a finger is holding something, keep the page still so the tilt follows the finger.
  document.addEventListener('touchmove', (e) => { if (held && e.cancelable) e.preventDefault(); }, { passive: false });
  for (const t of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(t, release, true);
  document.documentElement.addEventListener('mouseleave', () => { const old = hover; hover = null; settle(old); });

  const appearanceBefore = appearancePage;
  appearancePage = function () {
    const html = appearanceBefore();
    const isPure = pure() || jelly(), fx = isPure || !!cur().glassEffect;
    const card = `<div class="card mz-glassfx-card"><div class="toggle-row"><div><h3>${mzT('玻璃效果', 'Glass effect')}</h3><p>${isPure ? (jelly() ? mzT('「海月水母」主題本身就是玻璃。', 'The Moon Jelly theme is already glass.') : mzT('「液態玻璃」主題本身就是玻璃。', 'The Liquid Glass theme is already glass.')) : mzT('把毛玻璃、浮起的卡片和傾斜反光加到現在的主題上，背景和顏色維持原本的主題。', 'Adds frosted glass, floating cards and the tilt-and-shine to the current theme, keeping its background and colours.')}</p></div><button class="switch ${fx ? 'on' : ''}" type="button" data-mzglassfx ${isPure ? 'disabled' : ''} aria-label="${mzT('玻璃效果', 'Glass effect')}"></button></div></div>`;
    // Right under the colour themes.
    const sw = html.indexOf('class="swatches"'), at = sw < 0 ? -1 : html.indexOf('<p class="help">', sw);
    return at > 0 ? html.slice(0, at) + card + html.slice(at) : html + card;
  };
  // used by the day / night lens switch (day-night-switch.js), which is this switch's face now
  window.mzSetGlassFx = (v) => { if (typeof draft === 'undefined' || !draft || pure() || jelly()) return; draft.glassEffect = !!v; dirty = true; sync(); render(); };
  window.mzGlassLocked = () => pure() || jelly();
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-mzglassfx]');
    if (!b || b.disabled || typeof draft === 'undefined' || !draft) return;
    draft.glassEffect = !draft.glassEffect;
    dirty = true;
    sync();
    render();
  });

  sync();
  try { pearl(); } catch {}
  try { new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['style'] }); } catch {}
  window.mzGlass = { on, sync, held: () => !!held && !start };
}
// 3.4.2: glass needs a frosted base, not plain see-through (the user: 「玻璃界面上有點模糊底的效果」). Large glass
// surfaces get a soft blur; small buttons stay blur-free (many small blurs made phones lag), and every blur is still
// paused while swiping (swipe-nav.js). Full-screen panels (reader, kaomoji) are nearly solid frosted sheets.
{
  const css = document.createElement('style');
  css.textContent = `
html.mz-glass:not(.mz-jelly):root :is(.card,.wx-menu-group,.chat-entry,.soft-note,.login-gate-card,.search,.setting-choice,.swatch,.chip,.pill:not(.primary):not(.hangup),.icon-button,.chat-menu-button){-webkit-backdrop-filter:blur(6px) saturate(140%);backdrop-filter:blur(6px) saturate(140%)}
html.mz-glass:root :is(#mz-reader,#mz-kao){background:color-mix(in srgb,var(--mz-iri-base,#f4f2f7) 62%,transparent)!important;-webkit-backdrop-filter:blur(16px) saturate(140%);backdrop-filter:blur(16px) saturate(140%)}
html.mz-glass:root :is(.mz-rd-panel,.mz-kao-tray){background:#ffffff99!important;-webkit-backdrop-filter:blur(14px) saturate(150%);backdrop-filter:blur(14px) saturate(150%);border:1px solid #ffffffcc}
html.mz-glass.mz-dark:root :is(.mz-rd-panel,.mz-kao-tray){background:#1d1d30c7!important;border-color:#ffffff24}
html.mz-glass:root .sheet{background:#ffffff8c!important}
html.mz-glass.mz-dark:root .sheet{background:#1d1d30c2!important}
`;
  document.head.append(css);
}
