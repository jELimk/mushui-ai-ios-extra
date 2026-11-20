'use strict';
// 3.4.4: 賽博朋克 (Cyberpunk) — a special theme after the user's reference video (a neon-night AI companion app). Own
// code and own drawings (that project's licence doesn't allow commercial use, so nothing is copied):
//  - follows the dark-mode setting (dark look / light look), three neon colours (pink for actions and your bubbles, cyan for lines and the
//    other side, violet for fades), 1 px lines, panels with cut corners, HUD corner brackets, a faint grid floor and
//    scan lines behind everything, small labels in a monospace face
//  - its own icon set (special-icons.js / settings-icons.js 'cyber'), a HUD target where you tap
//  - the background is drawn once (CSS gradients); only the scan line moves (transform), paused in popups, calls,
//    swipes and with reduce motion
{
  themes.cyber = { name: '賽博朋克', accent: '#ff2e88', deep: '#ff8cc2', soft: '#1b1436', pink: '#2b1640', bg: '#0a0918', bubble: '#1d1338', cover: 'linear-gradient(160deg,#120a2e,#2a0d3a 55%,#06202b)' };
  const root = document.documentElement;
  const cur = () => { try { return (typeof draft !== 'undefined' && draft) || state.settings; } catch { return {}; } };
  // one cyber theme: light or dark follows the dark-mode setting (深色模式); old 'cyberLight' saves migrate to it
  const on = () => cur().theme === 'cyber' || cur().theme === 'cyberLight';
  const light = () => on() && !root.classList.contains('mz-dark');
  const migrate = () => { try { for (const s of [typeof draft !== 'undefined' && draft, typeof state !== 'undefined' && state.settings]) if (s && s.theme === 'cyberLight') s.theme = 'cyber'; } catch {} };
  let layer = null;
  const build = () => {
    layer = document.createElement('div'); layer.id = 'mz-cyber-bg'; layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<i class="cy-glow"></i><i class="cy-floor"></i><i class="cy-scan"></i>';
    document.body.prepend(layer);
  };
  let lastDark = null;
  const sync = () => {
    migrate();
    const v = on();
    lastDark = root.classList.contains('mz-dark');
    root.classList.toggle('mz-cyber', v);
    root.classList.toggle('mz-cyber-light', v && light());
    if (v) { root.classList.remove('mz-glass', 'mz-glass-fx', 'mz-glass-pure', 'mz-cat'); if (!layer) build(); }
    if (layer) layer.hidden = !v;
  };
  // dark-mode flips (button, system) restyle cyber without a full render
  new MutationObserver(() => { if (root.classList.contains('mz-dark') !== lastDark) sync(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
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
${R} :is(.section-label,.small,.help,time,.chat-time,.value,.mz-cal-w,.wx-menu-row small){letter-spacing:.04em}
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
/* square corners everywhere, spaced buttons, crisp mechanical motion, clear switch states */
html.mz-cyber:root:root *,html.mz-cyber:root:root *::before,html.mz-cyber:root:root *::after{border-radius:0!important}
html.mz-cyber{--mz-duang:cubic-bezier(.2,.7,.2,1)}
html.mz-cyber *,html.mz-cyber *::before,html.mz-cyber *::after{transition-timing-function:cubic-bezier(.16,1,.3,1)!important;animation-timing-function:cubic-bezier(.16,1,.3,1)!important}
${R} :is(.pill,.chip,.mz-seg,.icon-button){margin:3px 6px 3px 0}
${R} :is(.flex,.sheet-actions,.provider-grid,.model-grid,.mz-segs,.contact-tools,.composer-tools,.mz-alarm-top){gap:12px!important}
${R} .switch{background:#2b2752!important;border:1px solid #22e4ff55}
${R} .switch.on{background:${P}!important;box-shadow:0 0 10px ${P}88}

/* light cyber: same cut-corner HUD, daylight colours */
html.mz-cyber-light{--bg:#eef0ff!important;--ink:#1c1838!important;--muted:#5a5490!important;--line:#b9b3e8!important;--accent:#e0186e!important;--accent-deep:#c2145c!important;--soft:#dde2ff!important;--surface:#f7f6ff!important;--glass:#f7f6ffd9!important;color-scheme:light}
html.mz-cyber-light body{background:#eef0ff!important;color:var(--ink)}
html.mz-cyber-light #mz-cyber-bg .cy-glow{background:radial-gradient(60% 40% at 85% 8%,#8a5cff26,transparent 70%),radial-gradient(55% 35% at 8% 30%,#ff2e881f,transparent 70%),radial-gradient(70% 40% at 50% 100%,#22e4ff26,transparent 70%)}
html.mz-cyber-light #mz-cyber-bg .cy-floor{background:linear-gradient(transparent 0 calc(100% - 1px),#e0186e30 0) 0 0/100% 44px,linear-gradient(90deg,transparent 0 calc(100% - 1px),#0aa8c733 0) 0 0/44px 100%}
html.mz-cyber-light #mz-cyber-bg::after{background:repeating-linear-gradient(transparent 0 2px,#1c183806 2px 3px)}
html.mz-cyber.mz-cyber-light:root:root body :is(.card,.chat-entry,.mz-cgroup,.contact-favorites,.wx-menu-group,.search,.setting-choice,.moment,.mz-todo-item,.wx-profile,.profile-card,.account-connection-notice){background-color:#f7f6ffe6!important;background-image:linear-gradient(#0aa8c7,#0aa8c7),linear-gradient(#0aa8c7,#0aa8c7),linear-gradient(#e0186e,#e0186e),linear-gradient(#e0186e,#e0186e)!important}
html.mz-cyber.mz-cyber-light:root:root body .sheet{background:#f4f3fff5!important}
html.mz-cyber.mz-cyber-light:root:root body :is(.top,.page>.top,.conversation>.top,.composer){background:#eef0ffe6!important}
html.mz-cyber.mz-cyber-light:root:root body :is(.pill:not(.primary),.icon-button,.chip,.mz-seg){background:#e6e9ff!important;color:var(--ink)!important}
html.mz-cyber.mz-cyber-light:root:root body :is(input,textarea,select){background:#fbfaff!important;color:var(--ink)!important}
html.mz-cyber.mz-cyber-light:root:root body .message .bubble:not(.sticker-only):not(.photo-only){background:#ffffffcc!important;color:var(--ink)!important}
html.mz-cyber.mz-cyber-light:root:root body .message.me .bubble:not(.sticker-only):not(.photo-only),html.mz-cyber.mz-cyber-light:root:root body .message.mine .bubble:not(.sticker-only):not(.photo-only){background:#ffd7eacc!important}
html.mz-cyber.mz-cyber-light:root:root body #app>.nav{background:#f2f1fff0!important}
html.mz-cyber.mz-cyber-light:root:root body h1,html.mz-cyber.mz-cyber-light:root:root body h2{text-shadow:1px 0 #e0186e55,-1px 0 #0aa8c755}
html.mz-cyber.mz-cyber-light:root:root body .switch{background:#b9b3e8!important}
html.mz-cyber.mz-cyber-light:root:root body .switch.on{background:#e0186e!important}
/* its swatch: the light look */
.swatch[data-theme=cyber] span{background:linear-gradient(160deg,#dfe6ff,#ffd7ea 55%,#c8f4ff)!important;border:1px solid #e0186e!important;box-shadow:0 0 8px #e0186e66}
/* contacts AI / 人類 indicator: neon cut-corner bar, not a plain white strip */
html.mz-cyber .contact-mode::after{background:linear-gradient(90deg,${P},${V},${C})!important;height:3px;border-radius:0!important;clip-path:polygon(0 0,calc(100% - 6px) 0,100% 100%,6px 100%);box-shadow:0 0 8px ${P}88}
html.mz-cyber .contact-mode::before{background:#22e4ff14!important;border-radius:0!important;clip-path:${cut(10)};box-shadow:inset 0 0 0 1px #22e4ff40}
html.mz-cyber.mz-cyber-light .contact-mode::after{background:linear-gradient(90deg,#e0186e,#8a5cff,#0aa8c7)!important}
html.mz-cyber.mz-cyber-light .contact-mode::before{background:#0aa8c714!important;box-shadow:inset 0 0 0 1px #0aa8c740}
`;
  document.head.append(css);
}
