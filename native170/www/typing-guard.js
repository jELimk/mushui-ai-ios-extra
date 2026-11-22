'use strict';
// Defer sync redraws during active typing. The chat frame updates in place, keeping the input attached.
{
  const field = '.composer textarea[data-input="message"]';
  const pause = 650;
  let lastKey = 0, waiting;
  const markInput = event => { if (event.target.matches?.(field)) lastKey = performance.now(); };
  document.addEventListener('input', markInput, true);
  document.addEventListener('compositionupdate', markInput, true);
  const inner = render;
  const chatArt = new WeakMap();
  const sizeArt = () => {
    const chat = document.querySelector('.conversation.with-chat-backdrop');
    if (!chat) return;
    const editing = document.activeElement?.matches('textarea,input,[contenteditable="true"]');
    if (editing && chatArt.has(chat)) return;
    const height = chat.clientHeight;
    if (height && chatArt.get(chat) !== height) {
      chatArt.set(chat,height);
      chat.style.setProperty('--mz-chat-art-height',height + 'px');
    }
  };
  window.addEventListener('resize', () => requestAnimationFrame(sizeArt), { passive:true });
  window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(sizeArt), { passive:true });
  render = function (...args) {
    clearTimeout(waiting);
    const box = document.activeElement;
    const remaining = pause - (performance.now() - lastKey);
    if (remaining > 0 && box?.matches(field) && box.closest('.conversation').querySelector('.message-scroll')?.dataset.chatId === chatId &&
        (chatDrafts[chatId] || '') === box.value && box.value) {
      waiting = setTimeout(() => render(...args), remaining + 10);
      return;
    }
    const result = inner.apply(this, args);
    sizeArt();
    return result;
  };
}
