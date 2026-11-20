'use strict';
// 3.4.4: 賽博朋克 (Cyberpunk) — a special theme after the user's reference video (a neon-night AI companion app). Own
// code and own drawings (that project's licence doesn't allow commercial use, so nothing is copied):
//  - always night: deep indigo-black, three neon colours (pink for actions and your bubbles, cyan for lines and the
//    other side, violet for fades), 1 px lines, panels with cut corners, HUD corner brackets, a faint grid floor and
//    scan lines behind everything, small labels in a monospace face
//  - its own icon set (special-icons.js / settings-icons.js 'cyber'), a HUD target where you tap
//  - the background is drawn once (CSS gradients); only the scan line moves (transform), paused in popups, calls,
//    swipes and with reduce motion
{
  themes.cyber = { name: '賽博朋克', accent: '#ff2e88', deep: '#ff8cc2', soft: '#1b1436', pink: '#2b1640', bg: '#0a0918', bubble: '#1d1338', cover: 'linear-gradient(160deg,#120a2e,#2a0d3a 55%,#06202b)' };
  const root = document.documentElement;
  const cur = () => { try { return (typeof draft !== 'undefined' && draft) || state.settings; } catch { return {}; } };
  const on = () => cur().theme === 'cyber';

  // always dark while it's on (dark mode stays the user's own choice for every other theme)
  if (typeof mzApplyDark === 'function') {
    const darkBefore = mzApplyDark;
    mzApplyDark = function (...a) { const r = darkBefore.apply(this, a); if (on()) root.classList.add('mz-dark'); return r; };
  }
  let layer = null;
  const build = () => {
    layer = document.createElement('div'); layer.id = 'mz-cyber-bg'; layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<i class="cy-glow"></i><i class="cy-floor"></i><i class="cy-scan"></i>';
    document.body.prepend(layer);
  };
  const sync = () => {
    const v = on();
    root.classList.toggle('mz-cyber', v);
    if (v) { root.classList.add('mz-dark'); root.classList.remove('mz-glass', 'mz-glass-fx', 'mz-glass-pure', 'mz-cat'); if (!layer) build(); }
    else if (typeof mzApplyDark === 'function') mzApplyDark();
    if (layer) layer.hidden = !v;
  };
  const before = applyTheme;
  applyTheme = function (...a) { const r = before.apply(this, a); try { sync(); } catch {} return r; };
  setTimeout(() => { try { sync(); } catch {} }, 0);

  // a HUD target where you tap
  document.addEventListener('pointerdown', (e) => {
    if (!root.classList.contains('mz-cyber') || matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('mz-swiping')) return;
    const t = document.createElement('i'); t.className = 'mz-cy-tap'; t.style.left = e.clientX + 'px'; t.style.top = e.clientY + 'px';
    document.body.append(t);
    const a = t.animate([{ transform: 'translate(-50%,-50%) scale(.4) rotate(0deg)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.25) rotate(45deg)', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' });
    a.onfinish = a.oncancel = () => t.remove();
  }, { capture: true, passive: true });

  const P = '#ff2e88', C = '#22e4ff', V = '#8a5cff';
  const cut = (n) => `polygon(0 0,calc(100% - ${n}px) 0,100% ${n}px,100% 100%,${n}px 100%,0 calc(100% - ${n}px))`;
  const R = 'html.mz-cyber:root:root body';
  const css = document.createElement('style');
  css.id = 'mz-cyber-css';
  css.textContent = `
html.mz-cyber{--bg:#0a0918!important;--ink:#e9e6ff!important;--muted:#8d88bd!important;--line:#2b2752!important;--accent:${P}!important;--accent-deep:#ff8cc2!important;--soft:#1b1436!important;--surface:#120f27!important;--glass:#120f27d9!important;--cy-p:${P};--cy-c:${C};--cy-v:${V};color-scheme:dark}
html.mz-cyber body{background:#0a0918!important;color:var(--ink)}
html.mz-cyber::before{display:none!important}
#mz-cyber-bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
#mz-cyber-bg[hidden]{display:none}
#mz-cyber-bg .cy-glow{position:absolute;inset:0;background:radial-gradient(60% 40% at 85% 8%,#8a5cff33,transparent 70%),radial-gradient(55% 35% at 8% 30%,#ff2e8826,transparent 70%),radial-gradient(70% 40% at 50% 100%,#22e4ff1f,transparent 70%)}
#mz-cyber-bg .cy-floor{position:absolute;left:-50%;right:-50%;bottom:0;height:42%;transform:perspective(320px) rotateX(62deg);transform-origin:50% 100%;
  background:linear-gradient(transparent 0 calc(100% - 1px),#ff2e8840 0) 0 0/100% 44px,linear-gradient(90deg,transparent 0 calc(100% - 1px),#22e4ff33 0) 0 0/44px 100%;-webkit-mask:linear-gradient(transparent,#000 70%);mask:linear-gradient(transparent,#000 70%)}
#mz-cyber-bg::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(transparent 0 2px,#ffffff06 2px 3px)}
#mz-cyber-bg .cy-scan{position:absolute;left:0;right:0;top:-12%;height:12%;background:linear-gradient(transparent,#22e4ff12,transparent);animation:cy-scan 7s linear infinite}
@keyframes cy-scan{to{transform:translateY(960%)}}
html.mz-cyber:has(#overlay .sheet) #mz-cyber-bg .cy-scan,html.mz-cyber.mz-swiping #mz-cyber-bg .cy-scan{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){#mz-cyber-bg .cy-scan{animation:none;display:none}}
${R} #app{position:relative;z-index:1}
/* panels: dark, 1 px neon line, cut corners */
${R} :is(.card,.chat-entry,.mz-cgroup,.contact-favorites,.wx-menu-group,.search,.setting-choice,.moment,.mz-todo-item,.wx-profile,.profile-card,.account-connection-notice){background:#120f27d9!important;border:1px solid #22e4ff40!important;border-radius:0!important;clip-path:${cut(12)};box-shadow:inset 0 0 22px #8a5cff14!important;-webkit-backdrop-filter:blur(6px)!important;backdrop-filter:blur(6px)!important}
${R} :is(.card,.chat-entry,.mz-cgroup,.wx-menu-group,.wx-profile,.profile-card){background-image:linear-gradient(${C},${C}),linear-gradient(${C},${C}),linear-gradient(${P},${P}),linear-gradient(${P},${P})!important;background-size:14px 1.5px,1.5px 14px,14px 1.5px,1.5px 14px!important;background-position:0 0,0 0,100% 100%,100% 100%!important;background-repeat:no-repeat!important;background-color:#120f27d9!important}
${R} .sheet{background:#0e0c22f2!important;border:1px solid #22e4ff55!important;border-radius:0!important;clip-path:${cut(18)};box-shadow:0 0 40px #8a5cff33!important}
${R} .sheet-title,${R} .sheet h2{letter-spacing:.06em}
${R} :is(.top,.page>.top,.conversation>.top,.composer){background:#0a0918e6!important;border:0!important;border-bottom:1px solid transparent!important;border-image:linear-gradient(90deg,transparent,${P},${V},${C},transparent) 1!important;border-radius:0!important;box-shadow:none!important}
${R} .composer{border-bottom:0!important;border-top:1px solid transparent!important}
${R} h1,${R} h2{text-shadow:1px 0 #ff2e8899,-1px 0 #22e4ff99}
${R} :is(.section-label,.small,.help,time,.chat-time,.value,.mz-cal-w,.wx-menu-row small){font-family:ui-monospace,"Cascadia Mono",Consolas,"Roboto Mono",monospace!important;letter-spacing:.04em}
${R} .section-label{text-transform:uppercase;color:${C}!important;opacity:.85}
/* buttons */
${R} .pill.primary,${R} .send,${R} [data-action="send"]{background:linear-gradient(90deg,${P},${V})!important;color:#fff!important;border:0!important;border-radius:0!important;clip-path:${cut(8)};text-shadow:0 0 8px #fff8;box-shadow:none!important}
${R} :is(.pill:not(.primary),.icon-button,.chip,.mz-seg){background:#140f2c!important;border:1px solid #22e4ff55!important;border-radius:0!important;clip-path:${cut(7)};color:var(--ink)!important;box-shadow:none!important}
${R} :is(.mz-seg.selected,.chip.selected,.swatch.selected){border-color:${P}!important;color:${P}!important}
${R} input,${R} textarea,${R} select{background:#0d0b20!important;border:1px solid #22e4ff40!important;border-radius:0!important;color:var(--ink)!important;caret-color:${P}}
${R} input:focus,${R} textarea:focus{border-color:${P}!important;box-shadow:0 0 0 1px ${P}66,0 0 14px ${P}44!important;outline:0}
/* chat bubbles: yours pink line, theirs cyan line */
${R} .message .bubble:not(.sticker-only):not(.photo-only){background:#140f2ccc!important;border:1px solid #22e4ff66!important;border-radius:0!important;clip-path:${cut(9)};color:var(--ink)!important;box-shadow:none!important}
${R} .message.me .bubble:not(.sticker-only):not(.photo-only),${R} .message.mine .bubble:not(.sticker-only):not(.photo-only){background:#2a0f2bcc!important;border-color:${P}aa!important}
/* bottom bar */
${R} #app>.nav{background:#0b0920f0!important;border:1px solid #22e4ff44!important;border-radius:0!important;clip-path:${cut(14)};box-shadow:0 0 24px #8a5cff22!important}
${R} #app>.nav button{color:var(--muted)!important}
${R} #app>.nav button.active{color:${P}!important}
${R} #app>.nav button.active svg{filter:drop-shadow(0 0 5px ${P})}
${R} .desktop-rail{background:#0b0920f0!important;border-right:1px solid #22e4ff33!important}
${R} .avatar,${R} .avatar img{border-radius:0!important;clip-path:${cut(8)}}
${R} .wx-menu-icon{background:transparent!important;color:${C}!important}
${R} .setting-icon{color:${C}!important}
${R} :is(.setting-row,.contact-row,.chat-row,.wx-menu-row):not(:last-child){border-color:#2b2752!important}
${R} .mz-cdivider{display:none}
${R} ::selection{background:${P}66}
.mz-cy-tap{position:fixed;width:46px;height:46px;pointer-events:none;z-index:2147483500;border:1.5px solid ${C};box-shadow:0 0 10px ${C}88;
  -webkit-mask:linear-gradient(#000 0 0) top left/12px 12px no-repeat,linear-gradient(#000 0 0) top right/12px 12px no-repeat,linear-gradient(#000 0 0) bottom left/12px 12px no-repeat,linear-gradient(#000 0 0) bottom right/12px 12px no-repeat;
  mask:linear-gradient(#000 0 0) top left/12px 12px no-repeat,linear-gradient(#000 0 0) top right/12px 12px no-repeat,linear-gradient(#000 0 0) bottom left/12px 12px no-repeat,linear-gradient(#000 0 0) bottom right/12px 12px no-repeat}
/* its swatch: a neon city at night */
.swatch[data-theme=cyber] span{background:linear-gradient(transparent 62%,${P}55 62% 64%,transparent 64%),linear-gradient(90deg,transparent 30%,${C}88 30% 33%,transparent 33% 62%,${C}66 62% 64%,transparent 64%),linear-gradient(160deg,#120a2e,#2a0d3a 55%,#06202b)!important;border:1px solid ${P}!important;box-shadow:0 0 8px ${P}88}
`;
  document.head.append(css);
}
