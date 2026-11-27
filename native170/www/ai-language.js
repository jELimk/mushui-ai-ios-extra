'use strict';
// 3.4.2: AIs answer in the user's language. The base prompt says 繁體中文; this line (added last, so it wins) tells the
// AI to reply in whatever language the user writes in — English, Japanese, Korean, anything — and to lean to English
// when the app itself is in English. Traditional Chinese stays the default for Chinese speakers.
{
  const W = window.WebEngine;
  const appEnglish = () => /^en/i.test(document.documentElement.lang || '') || /^en/i.test(state?.settings?.language || '');
  const line = () => '\n語言：用使用者說話的語言回覆。使用者寫繁體中文就用繁體中文；寫英文、日文、韓文或其他語言，就用同一種語言自然地回覆，不必限定繁體中文（顏文字照常使用）。' +
    (appEnglish() ? '使用者的 App 是英文介面：還不確定時用英文（English）。' : '');
  if (W && typeof W.system === 'function') {
    const before = W.system;
    W.system = function (a, ...rest) { return before.call(this, a, ...rest) + line(); };
  }
  window.mzReplyLanguageLine = line;
}
