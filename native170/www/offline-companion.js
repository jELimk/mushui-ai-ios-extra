'use strict';
// Generate once from the character profile. Match lightweight local replies without a model or a network request.
{
  const W = WebEngine;
  const groups = ['greeting', 'goodbye', 'affection', 'sadness', 'happy', 'tired', 'question', 'daily'];
  const key = id => 'mz-offline-replies:' + id;
  const get = id => { try { return JSON.parse(localStorage.getItem(key(id)) || 'null'); } catch { return null; } };
  const last = new Map();
  const intent = text => {
    if (/再見|晚安|掰掰|bye|good ?night/i.test(text)) return 'goodbye';
    if (/早安|午安|你好|嗨|^hi\b|hello|good morning/i.test(text)) return 'greeting';
    if (/難過|傷心|哭|焦慮|孤單|sad|upset|lonely/i.test(text)) return 'sadness';
    if (/喜歡你|愛你|想你|miss you|love you/i.test(text)) return 'affection';
    if (/開心|高興|太棒|happy|excited|great news/i.test(text)) return 'happy';
    if (/好累|疲倦|想睡|tired|exhausted/i.test(text)) return 'tired';
    if (/[？?]/.test(text)) return 'question';
    return 'daily';
  };
  W.prepareOfflineReplies = async (settings, character) => {
    let timeout;
    try {
      const result = await Promise.race([
        W.complete(settings, W.system(character) + '\nWrite reusable in-character chat replies for later. No tools, actions, or claims about current events. Make them natural in Traditional Chinese and English. Return only JSON with zh and en objects, each containing arrays of 6 distinct short plain-text replies for these categories: ' + groups.join(', ') + '.',
          [{ role: 'user', content: 'Generate the bilingual reply collection now.' }]),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(Error(mzT('生成離線回覆逾時', 'Offline reply generation timed out'))), 45000); }),
      ]);
      const bank = W.json(result);
      for (const lang of ['zh', 'en']) {
        for (const group of groups) {
          const values = bank?.[lang]?.[group];
          if (!Array.isArray(values)) throw Error(mzT('離線回覆不完整', 'The offline reply collection is incomplete'));
          bank[lang][group] = [...new Set(values.filter(v => typeof v === 'string')
            .map(v => v.trim().replace(/[\[\]<>]/g, '').slice(0, 240))
            .filter(v => v && !W.harmfulReply(v) && !W.deathWord(v)))].slice(0, 8);
          if (bank[lang][group].length < 2) throw Error(mzT('離線回覆不完整', 'The offline reply collection is incomplete'));
        }
      }
      localStorage.setItem(key(character.id), JSON.stringify({ zh: bank.zh, en: bank.en }));
    } finally { clearTimeout(timeout); }
  };
  W.hasOfflineReplies = id => !!get(id);
  W.offlineReply = (character, text) => {
    const bank = get(character.id);
    if (!bank) return '';
    if (W.crisisText(text)) return W.crisisFallback(character).join('\n');
    const english = /[A-Za-z]/.test(text) && !/[\u3400-\u9fff]/.test(text);
    if (/是.{0,5}(真人|人類|AI|機器人)|are you.{0,12}(human|an? ai|a bot)/i.test(text)) return english ? 'I’m an AI companion.' : '我是 AI 夥伴。';
    const pool = bank[english ? 'en' : 'zh']?.[intent(text)];
    if (!pool?.length) return '';
    const choices = pool.filter(v => v !== last.get(character.id));
    const answer = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length || pool.length))];
    last.set(character.id, answer);
    return answer;
  };
  W.isOfflineError = e => navigator.onLine === false || (!e?.status && /failed to fetch|network(?:error| request failed)|internet disconnected|err_internet_disconnected|load failed|無法連線|網路連線/i.test(e?.message || ''));
}
