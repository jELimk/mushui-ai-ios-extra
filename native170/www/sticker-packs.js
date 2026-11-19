'use strict';
// 3.4.1: built-in stickers come in named packs. 沐水卡哇-1 is the original set (stickers/jelee): the 41 still ones
// first, the 8 moving ones at the bottom. A new pack later (沐水卡哇-2…) gets its own folder and ids, an entry in
// PACKS, and its own chip in the sticker panel. Sticker ids stay the same, so old messages still show their sticker.
{
  const PACKS = [
    { id: 'kawa-1', name: '沐水卡哇-1', has: (s) => s.type === 'png' || s.type === 'gif' },
  ];
  for (const s of stickerCatalog) s.pack = s.pack || PACKS.find((p) => p.has(s))?.id;
  const order = { png: 0, gif: 1 };
  const list = (pack) => stickerCatalog.filter((s) => s.pack === pack).sort((a, b) => (order[a.type] ?? 2) - (order[b.type] ?? 2));
  const current = () => (PACKS.some((p) => p.id === stickerFilter) ? stickerFilter : (stickerFilter = PACKS[0].id));

  const before = syncComposerPanel;
  syncComposerPanel = function (...a) {
    const r = before.apply(this, a);
    const panel = document.querySelector('.sticker-panel');
    if (!panel) return r;
    const pack = current();
    const grid = panel.querySelector('.sticker-grid:not(.custom-sticker-grid)');
    if (grid?.dataset.pack === pack) return r;
    const chips = panel.querySelector('.between .flex');
    if (chips) chips.innerHTML = PACKS.map((p) => `<button class="chip ${p.id === pack ? 'selected' : ''}" data-stickerfilter="${p.id}">${mzT(p.name, p.name.replace('沐水卡哇', 'Mushui Kawa'))}</button>`).join('');
    if (grid) grid.dataset.pack = pack, grid.innerHTML = list(pack).map((s) => `<button data-selectsticker="${s.id}" aria-label="${esc(s.name)}">${stickerImage(s, 'loading="lazy"')}<span>${esc(s.name)}</span></button>`).join('');
    return r;
  };
  window.mzStickerPacks = { PACKS, list };
}
