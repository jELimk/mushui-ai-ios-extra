'use strict';
// 3.4.1: small UI details from the user's two UI-review videos, applied everywhere at once.
//  - tabular-nums: times, counts, durations and percentages keep the same width as they change (no jiggle)
//  - the typing caret and selected text use the theme colour
//  - photos and avatars get a faint inner ring, so white pictures don't melt into a white page
//  - Chinese line breaking: no 「，。」 at the start of a line; long words / links wrap instead of widening the page
//  - press feedback on buttons (a small shrink), except in the glass and Moon Jelly themes, which have their own
{
  const css = document.createElement('style');
  css.textContent = `
.stamp,.message-time,time,.badge,.unread,.unread-badge,.chat-entry small,.chat-info small,.mz-wl-text,.mz-listen-clock,
.call-time,.call-duration,[class*="-count"],[class*="duration"],progress,.small{font-variant-numeric:tabular-nums}
input,textarea,[contenteditable]{caret-color:var(--accent)}
::selection{background:color-mix(in srgb,var(--accent) 26%,transparent)}
.avatar img,.bubble img:not(.sticker),.moment-photo img,.moment-photos img,.wx-moment img,.photo-grid img{outline:1px solid rgba(40,30,60,.08);outline-offset:-1px}
html.mz-dark .avatar img,html.mz-dark .bubble img:not(.sticker),html.mz-dark .moment-photo img,html.mz-dark .moment-photos img{outline-color:rgba(255,255,255,.1)}
body{line-break:strict}
.bubble,.chat-line,.help,.small,.moment-text,.wx-moment-text{overflow-wrap:anywhere}
h1,h2,h3,.sheet-title h2{text-wrap:balance}
@media (prefers-reduced-motion:no-preference){
  html:not(.mz-glass):not(.mz-jelly) :is(.pill,.icon-button,.setting-choice,.contact-row,.chat-entry,.nav button):active{transform:scale(.97);transition:transform .08s ease-out}
  html:not(.mz-glass):not(.mz-jelly) :is(.pill,.icon-button,.setting-choice,.contact-row,.chat-entry,.nav button){transition:transform .18s ease-out}
}`;
  document.head.append(css);
}
