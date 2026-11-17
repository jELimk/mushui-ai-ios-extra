'use strict';
// 3.4.1: 海月水母 (Moon Jelly) theme. Built on the glass interface (glass-theme.js turns mz-glass on for it), with its
// own sea colours:
//  - dark (深色模式 on): the deep sea — near-black blue water, navy frosted glass with a thin cyan→violet rim, cyan /
//    mint glow on what matters (bioluminescence), glowing jellyfish and drifting specks behind everything;
//  - light: the sunlit shallows — cool white water with a soft mesh of sky / lilac / coral light, jelly-like
//    white glass with a bright rim and a coloured shadow, deep-sea navy text.
// Dividers are soft waves, the bottom bar is a floating capsule whose active tab sends out a ring like spreading
// tentacles, and a press sends a ripple and a short squeeze-and-release (like a jellyfish bell).
// Only transforms and opacity move, so the sea costs almost nothing while scrolling.
{
  themes.jelly = { name: '海月水母', accent: '#38bdf8', deep: '#0f2942', soft: '#e3f2fc', pink: '#f3e4fb', bg: '#f4f8fb', bubble: '#dcefff', cover: 'linear-gradient(135deg,#d9effc,#ece2fb 55%,#fbe3ef)' };

  const root = document.documentElement;
  const cur = () => { try { return (typeof draft !== 'undefined' && draft) || state.settings; } catch { return {}; } };
  const on = () => cur().theme === 'jelly';
  let sea = null;
  const sync = () => {
    const v = on();
    root.classList.toggle('mz-jelly', v);
    if (v && !sea) build();
    if (sea) sea.hidden = !v;
  };
  const before = applyTheme;
  applyTheme = function (...a) { const r = before.apply(this, a); try { sync(); } catch {} return r; };

  // One moon jelly (海月水母): a wide, flat see-through saucer with a soft inner light, the four ring-shaped
  // "clover" in its middle, a fringe of short fine tentacles all round the rim, and four frilly oral arms hanging
  // from the centre. Its colours come from CSS variables, so the same drawing serves the light and dark sea.
  let n = 0;
  const fringe = (() => { let d = ''; for (let k = 0; k <= 26; k++) { const t = k / 26, x = 10 + t * 120, y = 55 + Math.sin(t * Math.PI) * 5, len = 9 + (k % 3) * 4, sway = (k % 2 ? 2.5 : -2.5); d += `M${x.toFixed(1)} ${y.toFixed(1)} q${sway} ${(len / 2).toFixed(1)} 0 ${len}`; } return d; })();
  const jellySvg = () => {
    const i = ++n, g = (s) => s + i;
    return `<svg viewBox="0 0 140 150" aria-hidden="true"><defs>
<radialGradient id="${g('h')}" cx="50%" cy="40%" r="50%"><stop offset="0" style="stop-color:var(--jl-halo)" stop-opacity=".5"/><stop offset="1" style="stop-color:var(--jl-halo)" stop-opacity="0"/></radialGradient>
<radialGradient id="${g('b')}" cx="50%" cy="15%" r="80%"><stop offset="0" style="stop-color:var(--jl-top)" stop-opacity=".9"/><stop offset=".5" style="stop-color:var(--jl-mid)" stop-opacity=".45"/><stop offset="1" style="stop-color:var(--jl-rim)" stop-opacity=".15"/></radialGradient>
<linearGradient id="${g('t')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--jl-rim)" stop-opacity=".75"/><stop offset="1" style="stop-color:var(--jl-mid)" stop-opacity="0"/></linearGradient>
</defs>
<ellipse cx="70" cy="44" rx="70" ry="48" fill="url(#${g('h')})"/>
<g fill="none" stroke="url(#${g('t')})" stroke-linecap="round">
<path d="${fringe}" stroke-width=".9"/>
<path d="M62 56 C56 72 66 82 58 96 C52 108 60 118 55 132" stroke-width="3.2" stroke-opacity=".7"/>
<path d="M68 57 C66 76 74 88 68 104 C64 116 70 126 67 142" stroke-width="2.6" stroke-opacity=".6"/>
<path d="M74 57 C78 74 70 86 76 100 C80 112 74 122 78 136" stroke-width="2.6" stroke-opacity=".6"/>
<path d="M79 56 C86 70 78 82 85 94 C90 104 84 114 88 128" stroke-width="3.2" stroke-opacity=".7"/>
</g>
<path d="M8 54 C8 26 36 10 70 10 C104 10 132 26 132 54 C122 59 110 60 98 59 C88 58 80 61 70 60 C60 61 52 58 42 59 C30 60 18 59 8 54Z" fill="url(#${g('b')})"/>
<g fill="none" style="stroke:var(--jl-gonad)" stroke-width="2.6" stroke-opacity=".8">
<ellipse cx="70" cy="28" rx="7" ry="4.2"/><ellipse cx="57" cy="36" rx="7" ry="4.6"/><ellipse cx="83" cy="36" rx="7" ry="4.6"/><ellipse cx="70" cy="44" rx="7.5" ry="4.6"/>
</g>
<g style="fill:var(--jl-gonad)" fill-opacity=".18"><ellipse cx="70" cy="28" rx="7" ry="4.2"/><ellipse cx="57" cy="36" rx="7" ry="4.6"/><ellipse cx="83" cy="36" rx="7" ry="4.6"/><ellipse cx="70" cy="44" rx="7.5" ry="4.6"/></g>
<path d="M26 34 C34 22 50 16 66 16" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" stroke-linecap="round"/>
<path d="M10 54 C20 58 30 59 42 58 C52 57 60 60 70 59 C80 60 88 57 98 58 C110 59 120 58 130 54" fill="none" style="stroke:var(--jl-rim)" stroke-opacity=".75" stroke-width="1.2"/>
</svg>`;
  };
  // Where the jellyfish swim (left/top in %, size in px, colour set, how long their drift and pulse take).
  const JELLIES = [
    { x: 6, y: 58, s: 120, c: 'a', d: 46, p: 6.5 },
    { x: 74, y: 14, s: 90, c: 'b', d: 58, p: 7.5 },
    { x: 80, y: 66, s: 150, c: 'c', d: 52, p: 8.5 },
    { x: 34, y: 4, s: 64, c: 'a', d: 64, p: 6 },
    { x: 46, y: 80, s: 76, c: 'b', d: 70, p: 7 },
  ];
  const build = () => {
    sea = document.createElement('div');
    sea.id = 'mz-jelly-sea';
    sea.setAttribute('aria-hidden', 'true');
    sea.innerHTML = '<i class="mz-jl-orb o1"></i><i class="mz-jl-orb o2"></i><i class="mz-jl-orb o3"></i><div class="mz-jl-par"><i class="mz-jl-specks s1"></i><i class="mz-jl-specks s2"></i>'
      + JELLIES.map((j, k) => `<div class="mz-jl-swim c${j.c}" style="left:${j.x}%;top:${j.y}%;width:${j.s}px;--d:${j.d}s;--p:${j.p}s;--k:${k}"><div class="mz-jl-pulse">${jellySvg()}</div></div>`).join('')
      + '</div>';
    document.body.prepend(sea);
  };

  // Parallax: when a page scrolls, the creatures behind drift a little the other way, slower than the page.
  let fr = 0, top = 0;
  document.addEventListener('scroll', (e) => {
    if (!sea || sea.hidden) return;
    const t = e.target; top = t && t.scrollTop != null ? t.scrollTop : (document.scrollingElement?.scrollTop || 0);
    if (!fr) fr = requestAnimationFrame(() => { fr = 0; sea.style.setProperty('--jl-y', (-Math.min(top * 0.06, 90)).toFixed(1) + 'px'); });
  }, { capture: true, passive: true });

  // Every tap on the screen sends water ripples out from the finger / pointer: a glowing ring plus a thinner
  // one just after, like a drop on water. A button sizes its ripple to itself; anywhere else gets a medium one.
  // The rings live in their own layer (not inside the button), so they never change which child is :last-child.
  let fx = null;
  const PRESS = 'button,.pill,.chip,.icon-button,.swatch,.setting-row,.contact-row,.chat-row,.wx-menu-row,[data-action],[data-page],a';
  const ring = (x, y, size, cls, life) => {
    const i = document.createElement('i');
    if (cls) i.className = cls;
    i.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px`;
    fx.append(i);
    setTimeout(() => i.remove(), life);
  };
  document.addEventListener('pointerdown', (e) => {
    if (!on() || e.button > 0) return;
    if (!fx || !fx.isConnected) { fx = document.createElement('div'); fx.id = 'mz-jelly-fx'; document.body.append(fx); }
    const b = e.target.closest?.(PRESS), r = b && !b.disabled ? b.getBoundingClientRect() : null;
    const size = r ? Math.min(220, Math.max(70, Math.max(r.width, r.height) * 1.4)) : 120;
    ring(e.clientX, e.clientY, size, '', 700);
    ring(e.clientX, e.clientY, size * 1.5, 'mz-jl-wave2', 1000);
    // Tap a jellyfish (on the open water, not on a button or card) and it jiggles: squashes, springs up, wobbles.
    if (sea && !sea.hidden && !e.target.closest?.(PRESS + ',.card,.moment,.chat-entry,.bubble,input,textarea')) {
      for (const j of sea.querySelectorAll('.mz-jl-swim')) {
        const jr = j.getBoundingClientRect();
        if (e.clientX < jr.left || e.clientX > jr.right || e.clientY < jr.top || e.clientY > jr.top + jr.height * 0.75) continue;
        const svg = j.querySelector('svg');
        svg.classList.remove('mz-jl-boing'); void svg.getBoundingClientRect(); svg.classList.add('mz-jl-boing');
        clearTimeout(svg._boing); svg._boing = setTimeout(() => svg.classList.remove('mz-jl-boing'), 900);
        break;
      }
    }
  }, { capture: true, passive: true });

  const WAVE = (c, o) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='6'%3E%3Cpath d='M0 3 C10 0 22 0 32 3 S54 6 64 3' fill='none' stroke='%23${c}' stroke-opacity='${o}' stroke-width='1.2'/%3E%3C/svg%3E")`;
  const ROWS = ':is(.setting-row,.contact-row,.wx-menu-row,.letter)';
  const J = 'html.mz-jelly:root', JL = 'html.mz-jelly:not(.mz-dark):root', JD = 'html.mz-jelly.mz-dark:root';
  const css = document.createElement('style');
  css.id = 'mz-jelly-css';
  css.textContent = `
/* ---------- light: the sunlit shallows ---------- */
${JL}{--bg:#f4f8fb!important;--ink:#0f2942!important;--muted:#52718d!important;--accent:#38bdf8!important;--accent-deep:#0f2942!important;--line:#d6e6f2!important;--soft:#e3f2fc!important;--pink:#f3e4fb!important;--bubble:#dcefff!important;
 --mz-iri-base:#eef5fa;--glass:#ffffff8c;--glass-strong:#ffffffc2;--glass-edge:#ffffffb3;--glass-hi:#ffffffcc;--glass-line:#0f29421a;
 --glass-shade:0 8px 22px -10px #38bdf833,inset 0 1px 2px #ffffffe6;--glass-deep:0 12px 32px -8px #38bdf82e,inset 0 1px 2px #ffffffe6;
 --jl-wave:${WAVE('38bdf8', '.45')};color:#0f2942}
/* ---------- dark: the deep sea ---------- */
${JD}{--bg:#050814!important;--ink:#e0f7fa!important;--muted:#80deea!important;--accent:#00e5ff!important;--accent-deep:#e0f7fa!important;--line:#14244a!important;--soft:#0b132b!important;--pink:#1a1440!important;--bubble:#10224a!important;--surface:#0b132ba6!important;--card:#0b132ba6!important;
 --mz-iri-base:#050814;--glass:#0b132ba6;--glass-strong:#0b132bd9;--glass-edge:#7c4dff2e;--glass-hi:#00ffff66;--glass-line:#00ffff1f;
 --glass-shade:0 4px 14px #00000066,inset 0 0 0 1px #00ffff0d;--glass-deep:0 14px 40px #000000a6,0 0 24px -6px #00ffff26;
 --jl-wave:${WAVE('00ffff', '.35')};color:#e0f7fa}
${JD} .eyebrow,${JD} .sub,${JD} small,${JD} .help{color:#4dd0e1}
${JD} h1,${JD} h2,${JD} h3{color:#e0f7fa}
/* the water behind everything */
html.mz-jelly.mz-glass::before{background:
 radial-gradient(52% 40% at 12% 10%,#d4ecfc 0,transparent 70%),
 radial-gradient(46% 38% at 92% 18%,#e9ddfb 0,transparent 70%),
 radial-gradient(48% 40% at 8% 62%,#fbe1ee 0,transparent 72%),
 radial-gradient(50% 44% at 94% 70%,#d6f3f6 0,transparent 72%),
 radial-gradient(60% 40% at 50% 104%,#dcecfb 0,transparent 72%),
 radial-gradient(36% 26% at 50% 36%,#ffffffb3 0,transparent 75%),
 linear-gradient(180deg,#f4f8fb,#ebf3fa)!important}
html.mz-jelly.mz-glass.mz-dark::before{background:
 radial-gradient(60% 40% at 50% -6%,#0e2a4a 0,transparent 70%),
 radial-gradient(44% 36% at 6% 40%,#1a0f3d 0,transparent 72%),
 radial-gradient(46% 38% at 96% 60%,#071f33 0,transparent 72%),
 radial-gradient(50% 40% at 40% 104%,#160b33 0,transparent 72%),
 linear-gradient(180deg,#070c1d,#050814 60%,#03050d)!important}
#mz-jelly-sea{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;contain:strict}
#mz-jelly-sea[hidden]{display:none}
.mz-jl-par{position:absolute;inset:-10% 0;transform:translate3d(0,var(--jl-y,0px),0);transition:transform .6s cubic-bezier(.22,1,.36,1)}
/* jellyfish colours: light = translucent moon jellies (lilac, coral, sky); dark = glowing cyan / violet / magenta */
#mz-jelly-sea .ca{--jl-gonad:#c084fc;--jl-halo:#b9e3fb;--jl-top:#ffffff;--jl-mid:#c7e7fb;--jl-rim:#7cc8f2}
#mz-jelly-sea .cb{--jl-gonad:#f472b6;--jl-halo:#e6d2fb;--jl-top:#ffffff;--jl-mid:#e4d3fb;--jl-rim:#c084fc}
#mz-jelly-sea .cc{--jl-gonad:#a78bfa;--jl-halo:#fbd3e6;--jl-top:#ffffff;--jl-mid:#fbd6e7;--jl-rim:#f472b6}
html.mz-dark #mz-jelly-sea .ca{--jl-gonad:#e040fb;--jl-halo:#00ffff;--jl-top:#e0ffff;--jl-mid:#00e5ff;--jl-rim:#00ffff}
html.mz-dark #mz-jelly-sea .cb{--jl-gonad:#00ffff;--jl-halo:#7c4dff;--jl-top:#efe6ff;--jl-mid:#9b72ff;--jl-rim:#7c4dff}
html.mz-dark #mz-jelly-sea .cc{--jl-gonad:#7c4dff;--jl-halo:#e040fb;--jl-top:#ffe6ff;--jl-mid:#e040fb;--jl-rim:#e040fb}
.mz-jl-swim{position:absolute;opacity:.72;will-change:transform;animation:mz-jl-drift var(--d) ease-in-out infinite alternate;animation-delay:calc(var(--k) * -9s)}
html.mz-dark .mz-jl-swim{opacity:.5}
.mz-jl-pulse{transform-origin:50% 30%;will-change:transform;animation:mz-jl-pulse var(--p) cubic-bezier(.22,1,.36,1) infinite;animation-delay:calc(var(--k) * -1.3s)}
.mz-jl-pulse svg{display:block;width:100%;height:auto;overflow:visible}
@keyframes mz-jl-drift{0%{transform:translate3d(0,0,0) rotate(-6deg)}50%{transform:translate3d(18px,-46px,0) rotate(4deg)}100%{transform:translate3d(-14px,-92px,0) rotate(-3deg)}}
/* the bell squeezes in, pushes, then glides */
@keyframes mz-jl-pulse{0%,100%{transform:scale(1,1)}18%{transform:scale(.9,1.07) translateY(-4px)}40%{transform:scale(1.04,.96) translateY(-10px)}}
/* light orbs (sunlight through water) and drifting specks (marine snow) */
.mz-jl-orb{position:absolute;border-radius:50%;will-change:transform;animation:mz-jl-bob 18s ease-in-out infinite alternate}
.mz-jl-orb.o1{width:260px;height:260px;left:-60px;top:18%;background:radial-gradient(circle,#bfe6fb99,transparent 70%)}
.mz-jl-orb.o2{width:220px;height:220px;right:-50px;top:44%;background:radial-gradient(circle,#ead9fb99,transparent 70%);animation-duration:23s}
.mz-jl-orb.o3{width:200px;height:200px;left:30%;bottom:-60px;background:radial-gradient(circle,#fbd9e999,transparent 70%);animation-duration:27s}
html.mz-dark .mz-jl-orb.o1{background:radial-gradient(circle,#00ffff1c,transparent 70%)}
html.mz-dark .mz-jl-orb.o2{background:radial-gradient(circle,#7c4dff24,transparent 70%)}
html.mz-dark .mz-jl-orb.o3{background:radial-gradient(circle,#e040fb1a,transparent 70%)}
@keyframes mz-jl-bob{to{transform:translate3d(0,-40px,0)}}
.mz-jl-specks{position:absolute;inset:0 0 -40% 0;will-change:transform;animation:mz-jl-snow 60s linear infinite;
 background-image:radial-gradient(circle,#38bdf866 0 1.2px,transparent 2px),radial-gradient(circle,#c084fc55 0 1px,transparent 1.8px),radial-gradient(circle,#ffffffcc 0 1.4px,transparent 2.2px);
 background-size:170px 210px,230px 190px,290px 260px;background-position:20px 40px,110px 130px,60px 10px}
.mz-jl-specks.s2{animation-duration:95s;opacity:.7;background-size:260px 300px,190px 240px,330px 280px;background-position:140px 80px,30px 200px,200px 160px}
html.mz-dark .mz-jl-specks{background-image:radial-gradient(circle,#00ffffaa 0 1.1px,transparent 2px),radial-gradient(circle,#e040fb88 0 1px,transparent 1.8px),radial-gradient(circle,#64ffda99 0 1.2px,transparent 2px)}
@keyframes mz-jl-snow{to{transform:translate3d(0,-30%,0)}}
@media(prefers-reduced-motion:reduce){.mz-jl-swim,.mz-jl-pulse,.mz-jl-orb,.mz-jl-specks{animation:none!important}}
/* while swiping between pages, the sea keeps still so the slide stays smooth */
html.mz-swiping #mz-jelly-sea *{animation-play-state:paused!important}

/* ---------- glass, the jelly way ---------- */
${J} :is(.card,.wx-menu-group,.sheet,.soft-note,.login-gate-card,.chat-entry,.setting-choice),${J} .content>.chat-row{border-radius:22px!important}
${JL} .sheet{background:#ffffffb3!important}
${JD} .sheet{background:#0b132be0!important}
${JD} :is(.card,.wx-menu-group,.chat-entry,.setting-choice,.sheet,.soft-note),${JD} .content>.chat-row{border-right-color:#7c4dff1f!important;border-bottom-color:#7c4dff1f!important}
${J} .page>.top:not(.moment-top),${J} .desktop-sidebar .top{-webkit-backdrop-filter:blur(16px)!important;backdrop-filter:blur(16px)!important}
${JD} .page>.top:not(.moment-top),${JD} .desktop-sidebar .top{background:#050814a6!important}
${JD} .conversation .top,${JD} .conversation>.composer,${JD} #app>.nav{background:#0b132bb3!important}
/* chat bubbles */
${JL} .mine .bubble{background:linear-gradient(135deg,#d6efff,#e9e0ff)!important;color:#0f2942}
${JD} .mine .bubble{background:linear-gradient(135deg,#7c4dff59,#00e5ff2e)!important;color:#e0f7fa;border-color:#00ffff40!important}
${JD} .bubble{color:#e0f7fa}
/* the main buttons glow */
${JL} .primary,${JL} .composer button[type=submit]{background:linear-gradient(135deg,#0ea5e9,#8b5cf6)!important;color:#fff!important;border:1px solid #ffffff99!important;box-shadow:0 12px 26px -10px #38bdf8b3,inset 0 1px 1px #ffffff80!important}
${JD} .primary,${JD} .composer button[type=submit]{background:linear-gradient(135deg,#64ffda,#00e5ff)!important;color:#050814!important;border:0!important;box-shadow:0 0 15px #00ffff66!important}
${JL} .switch.on{background:#38bdf8!important;box-shadow:0 0 0 1px #ffffffb3,0 4px 12px -2px #38bdf880}
${JD} .switch.on{background:#00e5ff!important;box-shadow:0 0 15px #00ffff66}
/* selected things: a jelly pill (light) or a mint glow (dark) */
${JL} .selected,${JL} .contact-mode>button.selected,${JL} .mz-segs>.mz-seg.selected{background:#ffffffeb!important;color:#0f2942!important;box-shadow:0 6px 16px -6px #38bdf880,inset 0 1px 2px #fff!important}
${JD} .selected,${JD} .contact-mode>button.selected,${JD} .mz-segs>.mz-seg.selected{background:#64ffda1f!important;color:#64ffda!important;box-shadow:0 0 15px #64ffda33,inset 0 0 0 1px #64ffda59!important}
/* text and icons */
${JL} .nav button{color:#52718d}${JL} .nav button.active{color:#0f2942}
${JD} .nav button{color:#80deea}${JD} .nav button.active{color:#64ffda}
${JD} .icon-button,${JD} .pill:not(.primary):not(.hangup),${JD} .chip{color:#e0f7fa}
${JD} .search{background:#0b132b80!important}
${JD} :is(.composer textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select){background:#0b132b99!important;color:#e0f7fa;border-color:#00ffff26!important}
${JD} .avatar{box-shadow:0 0 12px -2px #00ffff40}
/* progress and volume: a violet → cyan glow instead of a flat line */
${J} input[type=range]{accent-color:#38bdf8}
${JD} input[type=range]{accent-color:#00e5ff}
${J} progress::-webkit-progress-value{background:linear-gradient(90deg,#c084fc,#38bdf8)}
${JD} progress::-webkit-progress-value{background:linear-gradient(90deg,#7c4dff,#00ffff);box-shadow:0 0 10px #00ffff80}

/* ---------- dividers are soft waves ---------- */
${J} ${ROWS}{border-bottom-color:transparent!important;background-image:var(--jl-wave)!important;background-repeat:repeat-x!important;background-position:left 14px bottom 0!important;background-size:64px 6px!important}
${J} ${ROWS}:last-child,${J} ${ROWS}:only-child{background-image:none!important}

/* ---------- the bottom bar: a floating capsule; the active tab sends out rings ---------- */
${J} #app>.nav{border-radius:34px!important}
${J} .nav .nav-icon{position:relative}
${J} .nav .active .nav-icon{background:#ffffffd9!important;box-shadow:0 6px 16px -6px #38bdf8a6}
${JD} .nav .active .nav-icon{background:#64ffda1f!important;box-shadow:0 0 15px #00ffff59,inset 0 0 0 1px #64ffda4d}
${J} .nav .active .nav-icon::after{content:"";position:absolute;inset:-2px;border-radius:inherit;border:1.5px solid #38bdf8;opacity:0;pointer-events:none;animation:mz-jl-ring 2.8s cubic-bezier(.22,1,.36,1) infinite}
${JD} .nav .active .nav-icon::after{border-color:#00ffff}
@keyframes mz-jl-ring{0%{transform:scale(.92);opacity:.7}70%,100%{transform:scale(1.55,1.9);opacity:0}}

/* ---------- press: squeeze in, then spring back out ---------- */
${J} :is(button,.pill,.chip,.icon-button,.swatch){transition:transform .45s cubic-bezier(.22,1.6,.36,1),box-shadow .3s,background-color .3s}
${J} :is(button,.pill,.chip,.icon-button,.swatch):active{transform:scale(.93);transition-duration:.12s}
${J} .mz-tilt:active{--mz-sc:.95!important}
#mz-jelly-fx{position:fixed;inset:0;pointer-events:none;z-index:2147483600;overflow:hidden}
#mz-jelly-fx i{position:absolute;border-radius:50%;background:radial-gradient(circle,#ffffff00 40%,#38bdf826 62%,#c084fc33 70%,transparent 72%);border:2px solid #38bdf8b3;box-shadow:0 0 12px #38bdf866,inset 0 0 10px #c084fc4d;animation:mz-jl-ripple .65s cubic-bezier(.22,1,.36,1) forwards}
html.mz-dark #mz-jelly-fx i{background:radial-gradient(circle,#00ffff33 0,#7c4dff22 45%,transparent 70%);border-color:#00ffff80;box-shadow:0 0 15px #00ffff66}
#mz-jelly-fx i.mz-jl-wave2{background:none;border-width:1px;box-shadow:none;opacity:0;animation:mz-jl-ripple .9s cubic-bezier(.22,1,.36,1) .12s forwards}
.mz-jl-pulse svg.mz-jl-boing{transform-origin:50% 35%;animation:mz-jl-boing .85s cubic-bezier(.3,1.6,.5,1)}
@keyframes mz-jl-boing{0%{transform:scale(1,1)}15%{transform:scale(1.28,.72)}35%{transform:scale(.82,1.22) translateY(-10px)}55%{transform:scale(1.1,.92)}72%{transform:scale(.96,1.05)}100%{transform:scale(1,1)}}
@keyframes mz-jl-ripple{0%{transform:scale(.2);opacity:1}100%{transform:scale(1);opacity:0}}

/* the theme's swatch: a little jellyfish pool */
.swatch[data-theme=jelly] span{background:radial-gradient(circle at 50% 35%,#ffffff 0 18%,transparent 40%),radial-gradient(circle at 30% 80%,#c084fc 0,transparent 55%),linear-gradient(135deg,#38bdf8,#7c4dff 60%,#0b132b)!important;border:1px solid #ffffffb3!important;box-shadow:0 0 10px #00ffff55!important}
`;
  document.head.append(css);

  sync();
  try { new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['style'] }); } catch {}
  window.mzJelly = { on, sync };
}
