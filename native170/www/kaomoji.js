'use strict';
// 3.4.2: 顏文字大總會 (kaomoji library), inspired by emojidb.org's search-and-tap-to-copy (own collection, own design).
//  - Me → 顏文字大總會, or the 顏文字 chip in the sticker panel (there a tap also puts it into the message box).
//  - Search by mood words in Chinese or English, or pick a category; tap = copy; long-press (right-click) = collect
//    several, then copy them together. Recently used ones come first.
//  - AIs can use it too: the prompt names the categories, and a reply may write [顏文字:分類] which becomes a
//    kaomoji from that category. Only characters most phones can show are kept (no Arabic letters or combining marks).
{
  const W = window.WebEngine;
  const CATS = [["happy","開心","Happy","開心 快樂 高興 笑 好耶 happy smile joy glad yay",["(｡•ᴗ•｡)","(◍•ᴗ•◍)","(˶ᵔ ᵕ ᵔ˶)","(๑˃ᴗ˂)","(*^▽^*)","(＾▽＾)","(◕‿◕)","(✿◠‿◠)","(≧▽≦)","(*´▽`*)","(＾ω＾)","(^ᴗ^)","(o^▽^o)","(￣▽￣)","ヽ(・∀・)ﾉ","(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧","(•‿•)","(⌒‿⌒)","(*≧ω≦*)","(˶˃ ᵕ ˂˶)","(๑ᵔᴗᵔ๑)","◝(ᵔᗜᵔ)◜","( ੭ ˙ᗜ˙ )੭","(ﾉ´ヮ`)ﾉ*: ･ﾟ","♪(´▽｀)","(っ˘ω˘ς )"]],["laugh","大笑","Laugh","大笑 哈哈 笑死 爆笑 好好笑 laugh lol haha lmao",["(≧∇≦)ﾉ","(*≧▽≦)ﾉｼ","(ノ≧∀≦)ノ","o(≧▽≦)o","(≧▽≦)/","ʕ≧ᴥ≦ʔ","(*￣▽￣)b","(ﾟ∀ﾟ)","ヽ(＾Д＾)ﾉ","(╯✧▽✧)╯","(ノ∀`*)","(灬╹ω╹灬)","( ´∀｀)σ)∀`)","ε(๑> ₃ <)з","(≧ω≦*)","(ﾉ>ω<)ﾉ"]],["shy","害羞","Shy","害羞 臉紅 不好意思 羞 blush shy embarrassed",["(⸝⸝ᵕᴗᵕ⸝⸝)","(⁄ ⁄•⁄ω⁄•⁄ ⁄)","(*/ω＼*)","(〃▽〃)","(///▽///)","(⸝⸝> ᴗ <⸝⸝)","(〃ω〃)","(*ﾉωﾉ)","(⸝⸝๑﹏๑⸝⸝)","(｡>﹏<｡)","(*ﾉ▽ﾉ)","(〃＞＿＜;〃)","(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)","(ꈍᴗꈍ)","(˶˃⤙˂˶)"]],["love","愛心","Love","愛 愛心 喜歡 心 戀愛 love heart like crush",["(｡♥‿♥｡)","(♡˙︶˙♡)","(´｡• ω •｡`) ♡","(っ˘з(˘⌣˘ ) ♡","♡(˃  ˂ )","(≧◡≦) ♡","(◕‿◕)♡","(*˘︶˘*).｡.:*♡","ʚ♡ɞ","♡","( ˘ ³˘)♥","(´ε｀ )♡","♡＼(￣▽￣)／♡","(灬♥ω♥灬)","(๑♡⌓♡๑)","₊˚⊹♡","♡ ⸝⸝ ♡","(づ￣ ³￣)づ♡"]],["cute","撒嬌","Cute","撒嬌 可愛 拜託 黏 求求 cute please aww uwu",["(｡•︿•｡)","(っ´ω`c)","(๑• ₃ •๑)","(◕ᴗ◕✿)","ʕ•ᴥ•ʔ","(｡･ω･｡)","(*´ω`*)","(っ◔◡◔)っ","(｡ŏ﹏ŏ)","uwu","(⑅˘꒳˘)","(｡U ω U｡)","(˘･_･˘)","(✿╹◡╹)","(*˘︶˘*)","(〃・ω・〃)","(=^･ω･^=)"]],["cry","哭哭","Cry","哭 哭哭 淚 好想哭 嗚嗚 cry tears sob",["(╥﹏╥)","(T▽T)","(っ˘╭╮˘)っ","(；へ：)","(ಥ﹏ಥ)","(〒﹏〒)","(┳Д┳)","(இ﹏இ`｡)","(；ω；)","(T_T)","(ノД`)・゜・。","(´；ω；`)","｡ﾟ(ﾟ´Д｀ﾟ)ﾟ｡","(இ_இ)","(ᗒᗣᗕ)՞","(⋟﹏⋞)"]],["sad","難過","Sad","難過 傷心 失落 沮喪 低落 sad down upset blue",["(´・ω・`)","(｡•︿•｡)","(・へ・)","(◞‸◟)","(´-ι_-｀)","(っ- ‸ – ς)","(ᵕ—ᴗ—)","(´；︵；`)","(◡﹏◡✿)","(っ˘︿˘ς)","( ・﹏・)","(；︵；)","(´._.`)","(｡ŏ_ŏ)"]],["angry","生氣","Angry","生氣 氣 哼 不爽 火大 angry mad grr hmph",["(｀へ´)","(╬ Ò﹏Ó)","(＃`Д´)","(ノ｀Д´)ノ","(╯°□°)╯︵ ┻━┻","(¬`‸´¬)","(｀ε´)","ヽ(`Д´)ﾉ","(눈_눈)","(ꐦ ¬_¬)","(╬≖_≖)","o(￣ヘ￣o＃)","(-`д´-)","(•ˋ _ ˊ•)","凸(｀⌒´メ)凸"]],["surprised","驚訝","Surprised","驚訝 嚇到 什麼 哇 天啊 surprised shock wow omg",["(⊙_⊙)","(°ロ°)","(ﾟДﾟ;)","(・□・;)","Σ(°△°|||)","(⊙o⊙)","(○o○)","w(°ｏ°)w","(O_O)","(◎_◎;)","(°△°)","(ﾟοﾟ人))","∑(O_O；)","(゜゜)","⊙﹏⊙"]],["confused","疑惑","Confused","疑惑 問號 不懂 為什麼 嗯 confused what huh hmm",["(・・？","(゜-゜)","(￢_￢)","( ˘･з･)","(・_・ヾ","(｡･・)ﾉ゛？","(⊙_☉)","(・∧・)？","¯\\_(ツ)_/¯","(◎ ◎)ゞ","(ㆆ_ㆆ)","(￣ω￣;)","ʕ ´•ᴥ•`ʔ","(•_•)?"]],["tired","無奈","Tired","無奈 累 好累 唉 算了 tired sigh meh whatever",["(￣ー￣)","(－_－) zzZ","(ーー;)","(￣～￣;)","(´-ω-`)","(；一_一)","┐(￣ヘ￣)┌","╮(╯_╰)╭","(￣ε￣)","(-_-;)・・・","(ᵕ—ᴗ—)","(︶︹︶)","(´д｀)","(=_=)","(￣■￣;)"]],["sleep","睡覺","Sleep","睡覺 晚安 好睏 想睡 睡 sleep night sleepy zzz",["(－ω－) zzZ","(︶｡︶✽)","(˘ω˘)ｽﾔｧ","(_ _).。o○","(∪｡∪)｡｡｡zzz","(=_=) zzZ","(ᴗ˳ᴗ)","(っ- ‸ - ς) ᶻ 𝗓 𐰁","(´〜｀*) zzz","(-.-)Zzz…","(￣o￣) zzZZ","⋆˚☾ (ᴗ_ ᴗ。)","(˘▾˘~)"]],["cheer","加油","Cheer","加油 衝 可以的 努力 必勝 cheer go fight you can",["(ง •_•)ง","( • ω • )✧","(ง๑ •_•)ง","ᕦ(ò_óˇ)ᕤ","(๑•ㅂ•)✧","(ˊᗜˋ*)","ᕙ(⇀‸↼‶)ᕗ","(ﾉ*ФωФ)ﾉ","\\(￣▽￣)/","ヾ(＠⌒ー⌒＠)ノ","o(*￣▽￣*)ブ","(•ᴗ•)","(っ•ω•)っ✎⁾⁾"]],["hello","打招呼","Hello","打招呼 嗨 你好 哈囉 早安 揮手 hello hi wave morning",["(｡･ω･)ﾉﾞ","ヾ(＾∇＾)","(・ω・)ノ","(＾▽＾)ﾉ","ヾ(•ω•`)o","(*・ω・)ﾉ","(￣▽￣)ノ","( ´ ▽ ` )ﾉ","(=^･ｪ･^=))ﾉ彡☆","ヾ(☆▽☆)","(o´ω`o)ﾉ","( ﾟ▽ﾟ)/","(っ＾▿＾)","(◕‿◕)ﾉ"]],["thanks","謝謝","Thanks","謝謝 感謝 拜託 鞠躬 道謝 thanks thank you bow please",["(人´∀`)","m(_ _)m","(*￣▽￣)人","(｡•ᴗ•｡)♡ thank you","(*ᴗˬᴗ)ꕤ*.ﾟ","(人◕ω◕)","(＿ ＿*) Z z z","ヾ(＾-＾)ノ","(*^人^*)","(_ _)","(シ_ _)シ","(｡-人-｡)","(⁄ ⁄•⁄ω⁄•⁄ ⁄)⁄ ♡"]],["hug","抱抱","Hug","抱抱 抱 秀秀 安慰 陪你 hug comfort pat",["(っ´▽`)っ","(づ｡◕‿‿◕｡)づ","(つ≧▽≦)つ","⊂(・▽・⊂)","(っ˘ω˘ς )","(づ￣ ³￣)づ","(⊃｡•‿•｡)⊃","(っ＾▿＾)(˘◡˘ )","༼ つ ◕_◕ ༽つ","(ノ´ з `)ノ","(*´∀`)ノ(´・ω・`)ヨシヨシ","(˶ᵔ ᵕ ᵔ˶)⊃━☆","(っ´ω`)ﾉ(╥ω╥)"]],["kiss","親親","Kiss","親親 親 啾 mua kiss smooch",["(˘ ³˘)♥","( ˘ ³˘)♥","(っ˘з(˘⌣˘ )","(*˘︶˘*).｡.:*♡ mua","(づ￣ ³￣)づ","(´ε｀ )","(｡・//ε//・｡)","( ˘⌣˘)♡(˘⌣˘ )","(*^3^)/~☆","(っ´з｀)っ","ε(´｡•᎑•`)っ ♡"]],["cat","貓咪","Cat","貓 貓咪 喵 喵喵 cat kitty meow",["ᓚ₍⑅^..^₎♡","≽^⎚˕⎚^≼","≽^•⩊•^≼","₍^. .^₎⟆","ฅ^>⩊<^ ฅ","/ᐠ > ˕ <マ ₊˚⊹♡","(=^･ω･^=)","(=①ω①=)","ᓚᘏᗢ","(•˕ •マ.ᐟ","/ᐠ - ˕ -マ ᶻ 𝗓 𐰁","≽(•⩊ •マ≼","^. .^₎Ⳋ","ฅ^•ω•^ฅ","(^･o･^)ﾉ”","ᓚᘏᗢ ♡ ᗢᘏᓗ","/ᐠ｡ꞈ｡ᐟ\\","(=｀ω´=)","₍^ >⩊< ^₎Ⳋ","ᓚ₍ ^. .^₎"]],["dog","狗狗","Dog","狗 狗狗 汪 汪汪 dog puppy woof",["U・ᴥ・U","૮ ˶ᵔ ᵕ ᵔ˶ ა","૮₍ ˃ ⤙ ˂ ₎ა","(◕ᴥ◕)","V●ᴥ●V","∪･ω･∪","૮ • ᴥ - ა","(ᵔᴥᵔ)","૮꒰ ˶• ༝ •˶꒱ა ♡","U^ェ^U","૮₍ ´ ꒳ `₎ა","▼・ᴥ・▼"]],["bear","小熊","Bear","熊 小熊 熊熊 bear teddy",["ʕ•ᴥ•ʔ","ʕ ᵔᴥᵔ ʔ","ʕっ•ᴥ•ʔっ","ʕ￫ᴥ￩ʔ","ʕ •`ᴥ•´ʔ","ʕ´•ᴥ•`ʔ","(´(ｪ)｀)","ʕ≧ᴥ≦ʔ","ʕ ˵• ₒ •˵ ʔ","ʕ　·ᴥ·ʔ","ʕノ•ᴥ•ʔノ ︵ ┻━┻"]],["bunny","兔兔","Bunny","兔 兔兔 兔子 bunny rabbit",["(・x・)","૮ ˶ᵔ ᵕ ᵔ˶ ა","(\\_/)\n( •_•)\n/ >♡","(๑•ᴗ•๑)ᘏ","(=´ x `=)","/(•ㅅ•)\\","(ﾟ×ﾟ)","૮(˶ㅠ︿ㅠ)ა","(˶ᵔ ᵕ ᵔ˶)ᓗ","ᘏ⑅ᘏ"]],["sea","海洋","Sea","海 海洋 水母 魚 鯨魚 海浪 水 sea ocean jellyfish fish wave water",["˚｡⋆୨୧˚ ≋","｡ﾟ･ ≋≋ ･ﾟ｡","><((((º>","<・ )))><<","~~~ ><(((°>","‧₊˚ 🫧 ⋆｡˚","⋆｡‧˚ʚ 🫧 ɞ˚‧｡⋆","｡°ᐟ ᐟ","~ (˘▽˘~)","≋≋≋ (˘◡˘) ≋≋≋","‧˚₊ 💧 ₊˚‧","₊‧°𐐪 ≋ 𐑂°‧₊"]],["food","吃東西","Food","吃 餓 好吃 吃飯 點心 food eat hungry yummy",["(っ˘ω˘ς)","( ˘▽˘)っ♨","(*´ч`*)","(๑´ω`๑)","(っ●ω●)っ","ψ(｀∇´)ψ","(￣～￣)","(*￣ii￣)","♨(⋆‿⋆)♨","(ﾟ∀ﾟ)ﾉ","ヽ(´ー`)ﾉ ♨","(ﾉ´ヮ´)ﾉ*:･ﾟ✧ ☕"]],["music","音樂","Music","音樂 唱歌 聽歌 歌 跳舞 music song sing dance",["♪(´▽｀)","ヾ(´〇`)ﾉ♪♪♪","♬♩♪♩ ヽ(•‿•)ノ","(ﾉ≧∀≦)ﾉ ‥…━━━★","♪～(￣ε￣；)","┌(・。・)┘♪","└(￣-￣ )┐♪","(〜￣▽￣)〜","〜(￣▽￣〜)","♪♪ ヽ(ˇ∀ˇ )ゞ","ᯓ♪ ılıılı","♫꒰･‿･๑꒱"]],["sparkle","星星裝飾","Sparkles","星星 閃亮 裝飾 花 可愛符號 sparkle star decoration flower",["⋆˚✿˖°","✧˖°","⊹  ˖","₊˚⊹♡","˚₊‧꒰ა ☆ ໒꒱ ‧₊˚","✩°｡⋆⸜ ✮","⋆｡°✩","⋆˙⟡","✮⋆˙","❀","˚✧₊⁎","⋆.˚ ☾⭒.˚","⟡ ݁₊ .","✿","❁","✦","⋆⭒˚.⋆","·˚ ༘ ✩","ᰔ","𖧷"]],["divider","分隔線","Dividers","分隔線 線 裝飾線 divider line border",["────୨ৎ────","⏔⏔⏔ ꒰ ᧔ෆ᧓ ꒱ ⏔⏔⏔","·⁺˚*•✩•*˚⁺‧","˚₊‧꒰ა ୨୧ ໒꒱ ‧₊˚","┈┈┈┈ ⋆ ┈┈┈┈","•┈┈┈┈┈•✿•┈┈┈┈┈•","︶꒦꒷︶꒷꒦︶","⋆｡ﾟ☁︎｡⋆｡ ﾟ☾ ﾟ｡⋆","꒰ ✿ ꒱ ┈┈┈┈┈┈","═══ ⋆★⋆ ═══"]],["scared","害怕","Scared","害怕 怕 好可怕 發抖 scared afraid fear",["(((;ꏿ_ꏿ;)))","(ﾉﾟ0ﾟ)ﾉ~","ヽ(ﾟДﾟ)ﾉ","(;;;*_*)","((╬◣﹏◢))","(ﾉ´･ω･)ﾉ ﾐ ┸━┸","(゜ロ゜)","(｡>﹏<｡)","Σ(っ °Д °;)っ","(；゜○゜)","((((；゜Д゜)))"]],["smug","得意","Smug","得意 嘿嘿 帥 壞笑 smug cool smirk hehe",["(￣ー￣)ｂ","( ° ʖ °)","(￣▽￣)ノ","(▀Ĺ▀ )","(⌐■_■)","(￢‿￢ )","( ˘ ᵕ ˘ )","(￣ω￣)","(｀∀´)Ψ","( ˙꒳˙ )","ᕕ( ᐛ )ᕗ","(•ᴗ•)"]],["sorry","道歉","Sorry","道歉 對不起 抱歉 不好意思 sorry apologize oops",["(シ_ _)シ","m(_ _)m","(｡ŏ﹏ŏ)","(｡•︿•｡)","(っ- ‸ – ς)","(＞人＜;)","(´；ω；`)","(人>_<;)","orz","(>_<)","(；人；)","(⋟﹏⋞)"]]];
  const RKEY = 'mz-kaomoji-recent';
  let recent = []; try { recent = JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch {}
  const remember = (k) => { recent = [k, ...recent.filter((x) => x !== k)].slice(0, 24); try { localStorage.setItem(RKEY, JSON.stringify(recent)); } catch {} };
  let box = null, insertMode = false, cat = 'all', query = '', tray = [];

  const copy = async (text) => {
    try { if (typeof copyChatText === 'function') await copyChatText(text); else await navigator.clipboard.writeText(text); } catch {}
  };
  const insert = (text) => {
    const ta = document.querySelector('#app .composer textarea, #app textarea.composer-input, #app .composer input[type=text]');
    if (!ta) return false;
    const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  const results = () => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hit = CATS.filter((c) => (c[1] + ' ' + c[2] + ' ' + c[3]).toLowerCase().includes(q));
      const direct = CATS.flatMap((c) => c[4]).filter((k) => k.toLowerCase().includes(q));
      return [...new Set([...hit.flatMap((c) => c[4]), ...direct])];
    }
    if (cat === 'recent') return recent;
    if (cat === 'all') return CATS.flatMap((c) => c[4]);
    return CATS.find((c) => c[0] === cat)?.[4] || [];
  };
  const drawList = () => {
    if (!box) return;
    const list = results();
    box.querySelector('.mz-kao-grid').innerHTML = list.length
      ? list.map((k) => `<button type="button" class="mz-kao-item${tray.includes(k) ? ' picked' : ''}" data-kao="${esc(k)}">${esc(k)}</button>`).join('')
      : `<p class="mz-kao-none">${cat === 'recent' && !query ? mzT('還沒有用過的顏文字，按一下就會出現在這裡。', 'Nothing used yet — tap one and it shows up here.') : mzT('找不到，換個字試試看 (・・？', 'Nothing found — try another word (・・？')}</p>`;
    box.querySelectorAll('[data-kaocat]').forEach((b) => b.classList.toggle('on', !query && b.dataset.kaocat === cat));
    const t = box.querySelector('.mz-kao-tray');
    t.hidden = !tray.length;
    t.querySelector('span').textContent = tray.join(' ');
  };
  const open = (asInsert = false) => {
    close(); insertMode = asInsert; query = ''; tray = []; cat = recent.length ? 'recent' : 'all';
    box = document.createElement('section'); box.id = 'mz-kao'; box.setAttribute('role', 'dialog');
    box.innerHTML = `<header class="mz-kao-top"><button type="button" class="mz-kao-x" data-kaoclose aria-label="${mzT('關閉', 'Close')}">✕</button><b>${mzT('顏文字大總會', 'Kaomoji library')}</b><span class="mz-kao-hint">${asInsert ? mzT('按一下放進訊息', 'Tap to add') : mzT('按一下複製', 'Tap to copy')}</span></header>
<label class="mz-kao-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" placeholder="${mzT('搜尋：開心、貓咪、晚安、sorry…', 'Search: happy, cat, night, sorry…')}" enterkeyhint="search"></label>
<div class="mz-kao-cats"><button type="button" data-kaocat="recent">${mzT('最近', 'Recent')}</button><button type="button" data-kaocat="all">${mzT('全部', 'All')}</button>${CATS.map((c) => `<button type="button" data-kaocat="${c[0]}">${mzT(c[1], c[2])}</button>`).join('')}</div>
<p class="mz-kao-tip">${mzT('長按（或右鍵）可以一次選好幾個', 'Long-press (or right-click) to pick several')}</p>
<div class="mz-kao-grid"></div>
<div class="mz-kao-tray" hidden><span></span><button type="button" data-kaotray="clear">${mzT('清除', 'Clear')}</button><button type="button" class="primary" data-kaotray="use">${asInsert ? mzT('放進訊息', 'Add') : mzT('全部複製', 'Copy all')}</button></div>`;
    document.body.append(box);
    box.querySelector('input').addEventListener('input', (e) => { query = e.target.value; drawList(); });
    drawList();
    requestAnimationFrame(() => box?.classList.add('in'));
  };
  const close = () => { if (!box) return; const b = box; box = null; b.classList.remove('in'); setTimeout(() => b.remove(), 180); };
  // 3.4.4: a copied kaomoji shows a tick on itself for two seconds
  const tick = (el) => {
    if (!el) return; el.classList.remove('mz-kao-ok'); void el.offsetWidth; el.classList.add('mz-kao-ok');
    clearTimeout(el._okT); el._okT = setTimeout(() => el.classList.remove('mz-kao-ok'), 2000);
  };
  const use = async (text, el) => {
    remember(text); tick(el);
    copy(text); // don't wait: a clipboard prompt must not hold up putting it in the message
    if (insertMode && insert(text)) { toast(mzT('已放進訊息（也複製了）', 'Added (and copied)'), 1200); close(); return; }
    toast('✓ ' + mzT('已複製 ', 'Copied ') + text, 2000);
  };
  // swipe (finger) or drag (mouse) left / right on the list = next / previous category; the list follows the finger
  // and the category bar keeps the chosen one in view. Only transform moves (no fading: glass stays frosted).
  const ORDER = () => ['recent', 'all', ...CATS.map((c) => c[0])];
  const keepChipInView = () => { const b = box?.querySelector(`[data-kaocat="${cat}"]`); b?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); };
  const step = (dir) => {
    const o = ORDER(), i = Math.max(0, o.indexOf(query ? 'all' : cat)), n = o[i + dir];
    if (!n) return false;
    cat = n; query = ''; const inp = box.querySelector('input'); if (inp) inp.value = '';
    drawList(); box.querySelector('.mz-kao-grid').scrollTop = 0; keepChipInView();
    return true;
  };
  let sw = null, swDragged = false;
  const swStart = (x, y, t) => { if (!box || !t.closest?.('#mz-kao .mz-kao-grid')) return; sw = { x, y, dx: 0, axis: '' }; };
  const swMove = (x, y, ev) => {
    if (!sw) return;
    const dx = x - sw.x, dy = y - sw.y;
    if (!sw.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) { sw.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'; if (sw.axis === 'x') clearTimeout(pressT); }
    if (sw.axis !== 'x') return;
    sw.dx = dx; ev?.cancelable && ev.preventDefault();
    const g = box.querySelector('.mz-kao-grid'); g.style.transition = 'none'; g.style.willChange = 'transform'; g.style.transform = `translateX(${dx}px)`;
  };
  const swEnd = () => {
    if (!sw) return; const d = sw; sw = null;
    const g = box?.querySelector('.mz-kao-grid'); if (!g) return;
    if (d.axis !== 'x') return;
    swDragged = Math.abs(d.dx) > 6;
    const dir = d.dx < 0 ? 1 : -1, o = ORDER(), i = Math.max(0, o.indexOf(query ? 'all' : cat));
    const go = Math.abs(d.dx) > 60 && !!o[i + dir], w = g.clientWidth || innerWidth;
    const done = () => setTimeout(() => { if (g.isConnected) { g.style.transition = ''; g.style.willChange = ''; } }, 340);
    if (!go) { g.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1)'; g.style.transform = ''; return done(); }
    // 3.4.4: the kaomoji themselves slide — this page leaves the way the finger went, the next one comes in behind it
    g.style.transition = 'transform .16s cubic-bezier(.4,0,1,1)'; g.style.transform = `translateX(${-dir * w}px)`;
    setTimeout(() => {
      step(dir);
      const ng = box?.querySelector('.mz-kao-grid'); if (!ng) return;
      ng.style.transition = 'none'; ng.style.willChange = 'transform'; ng.style.transform = `translateX(${dir * w}px)`; void ng.offsetWidth;
      ng.style.transition = 'transform .3s cubic-bezier(.2,.9,.3,1.06)'; ng.style.transform = '';
      setTimeout(() => { if (ng.isConnected) { ng.style.transition = ''; ng.style.willChange = ''; } }, 340);
    }, 150);
  };
  document.addEventListener('touchstart', (e) => { if (e.touches.length === 1) swStart(e.touches[0].clientX, e.touches[0].clientY, e.target); }, { passive: true, capture: true });
  document.addEventListener('touchmove', (e) => { if (sw) swMove(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false, capture: true });
  document.addEventListener('touchend', swEnd, { capture: true });
  document.addEventListener('mousedown', (e) => { if (e.button === 0) { swDragged = false; swStart(e.clientX, e.clientY, e.target); } }, true);
  document.addEventListener('mousemove', (e) => { if (sw) { if (!(e.buttons & 1)) return swEnd(); swMove(e.clientX, e.clientY, e); } }, true);
  document.addEventListener('mouseup', () => { if (sw) swEnd(); }, true);
  // the category bar can be dragged sideways with the mouse too
  let chipDrag = null;
  document.addEventListener('mousedown', (e) => { const bar = e.target.closest?.('#mz-kao .mz-kao-cats'); if (bar && e.button === 0) chipDrag = { bar, x: e.clientX, left: bar.scrollLeft, moved: false }; }, true);
  document.addEventListener('mousemove', (e) => { if (!chipDrag) return; if (!(e.buttons & 1)) { chipDrag = null; return; } const dx = e.clientX - chipDrag.x; if (Math.abs(dx) > 4) chipDrag.moved = true; chipDrag.bar.scrollLeft = chipDrag.left - dx; }, true);
  document.addEventListener('mouseup', () => { if (chipDrag?.moved) swDragged = true; chipDrag = null; }, true);
  document.addEventListener('click', (e) => { if (swDragged && box?.contains(e.target)) { swDragged = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  window.mzKaomoji = { open, close, CATS };
  actions.mzKaomoji = () => open(false);

  // tap = use; long-press / right-click = collect
  let pressT = 0, pressed = null, longDone = false, longFor = null;
  const collect = (k) => { tray = tray.includes(k) ? tray.filter((x) => x !== k) : [...tray, k]; drawList(); };
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('#mz-kao [data-kao]'); if (!b) return;
    pressed = b; longDone = false; longFor = null; clearTimeout(pressT);
    pressT = setTimeout(() => { longDone = true; longFor = b; navigator.vibrate?.(12); collect(b.dataset.kao); }, 480);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => document.addEventListener(t, () => clearTimeout(pressT), true));
  document.addEventListener('contextmenu', (e) => { const b = e.target.closest?.('#mz-kao [data-kao]'); if (!b) return; e.preventDefault(); clearTimeout(pressT); if (longFor !== b) collect(b.dataset.kao); longFor = null; longDone = true; });
  document.addEventListener('click', (e) => {
    if (!box || !box.contains(e.target)) {
      const chip = e.target.closest?.('[data-kaochip]'); if (chip) { e.preventDefault(); e.stopPropagation(); open(true); }
      return;
    }
    const t = e.target;
    if (t.closest('[data-kaoclose]')) return close();
    const c = t.closest('[data-kaocat]'); if (c) { cat = c.dataset.kaocat; query = ''; box.querySelector('input').value = ''; drawList(); box.querySelector('.mz-kao-grid').scrollTop = 0; keepChipInView(); return; }
    const k = t.closest('[data-kao]'); if (k) { if (longDone) { longDone = false; return; } if (tray.length) return collect(k.dataset.kao); return use(k.dataset.kao, k); }
    const tr = t.closest('[data-kaotray]');
    if (tr) { if (tr.dataset.kaotray === 'clear') { tray = []; return drawList(); } const text = tray.join(' '); tray = []; drawList(); return use(text); }
  }, true);
  document.addEventListener('keydown', (e) => { if (box && e.key === 'Escape') { e.preventDefault(); close(); } }, true);
  if (typeof window.goBack === 'function') { const back = window.goBack; window.goBack = function (...a) { if (box) return close(); return back.apply(this, a); }; }

  // Me page row + sticker panel chip
  const renderBefore = render;
  render = function (...a) {
    const r = renderBefore.apply(this, a);
    try {
      if (tab === 'settings' && !page && !chatId && !document.querySelector('[data-action="mzKaomoji"]')) {
        const rows = [...document.querySelectorAll('#app .wx-menu-row')];
        const sticker = rows.find((x) => /sticker|表情/i.test((x.dataset.action || '') + (x.dataset.page || '') + x.textContent));
        const html = `<button class="wx-menu-row" data-action="mzKaomoji"><span class="wx-menu-icon color" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24"><path d="M3.5 8.5 6 12l-2.5 3.5M20.5 8.5 18 12l2.5 3.5M9 10.5h.01M15 10.5h.01M9.5 14.5c1.4 1.2 3.6 1.2 5 0"/></svg></span><b>${mzT('顏文字大總會', 'Kaomoji library')}</b><span class="spacer"></span><small>(｡•ᴗ•｡)</small></button>`;
        if (sticker) sticker.insertAdjacentHTML('afterend', html); else document.querySelector('#app .wx-menu-group')?.insertAdjacentHTML('beforeend', html);
      }
    } catch {}
    return r;
  };
  if (typeof syncComposerPanel === 'function') {
    const panelBefore = syncComposerPanel;
    syncComposerPanel = function (...a) {
      const r = panelBefore.apply(this, a);
      try { const chips = document.querySelector('.sticker-panel .between .flex'); if (chips && !chips.querySelector('[data-kaochip]')) chips.insertAdjacentHTML('beforeend', `<button class="chip mz-kao-chip" type="button" data-kaochip>${mzT('顏文字', 'Kaomoji')}</button>`); } catch {}
      return r;
    };
  }

  // AIs: the categories in the prompt; [顏文字:分類] in a reply becomes one from that category
  const pick = (name) => { const c = CATS.find((x) => x[1] === name || x[2].toLowerCase() === String(name).toLowerCase() || x[0] === name) || CATS.find((x) => x[3].includes(name)); const l = c?.[4] || CATS[0][4]; return l[Math.floor(Math.random() * l.length)]; };
  const MARK = /\[顏文字[:：]\s*([^\]\n]{1,12})\]/g;
  const sysBefore = W.system;
  W.system = function (a, ...rest) {
    const s = sysBefore.call(this, a, ...rest);
    const sample = CATS.slice(0, 18).map((c) => c[4][Math.floor(Math.random() * Math.min(6, c[4].length))]).join(' ');
    return s + `\n顏文字：想用顏文字時，可以自己寫，也可以寫 [顏文字:分類] 讓 App 從顏文字大總會挑一個（分類：${CATS.map((c) => c[1]).join('、')}）。例如 ${sample}。不要每句都用，依個性自然地用。`;
  };
  const completeBefore = W.complete;
  if (typeof completeBefore === 'function') W.complete = async function (...a) {
    const r = await completeBefore.apply(this, a);
    return typeof r === 'string' ? r.replace(MARK, (_, n) => pick(n.trim())) : r;
  };
  window.mzKaomojiFill = (text) => String(text ?? '').replace(MARK, (_, n) => pick(n.trim()));

  const css = document.createElement('style');
  css.textContent = `
[data-kao].mz-kao-ok{position:relative}[data-kao].mz-kao-ok::after{content:'';position:absolute;inset:0;border-radius:inherit;background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E\") center/26px no-repeat,color-mix(in srgb,var(--accent) 88%,transparent);animation:mz-kao-ok 2s ease forwards}
html.mz-jelly [data-kao].mz-kao-ok::after{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='7.5' r='3.6'/%3E%3Ccircle cx='12' cy='16.5' r='3.6'/%3E%3Ccircle cx='7.5' cy='12' r='3.6'/%3E%3Ccircle cx='16.5' cy='12' r='3.6'/%3E%3C/svg%3E\")}
html.mz-glass-pure [data-kao].mz-kao-ok::after{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2Z'/%3E%3C/svg%3E\")}
html.mz-cat [data-kao].mz-kao-ok::after{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cellipse cx='12' cy='15.5' rx='4.2' ry='3.6'/%3E%3Ccircle cx='6.5' cy='10.5' r='1.7'/%3E%3Ccircle cx='9.8' cy='6.5' r='1.7'/%3E%3Ccircle cx='14.2' cy='6.5' r='1.7'/%3E%3Ccircle cx='17.5' cy='10.5' r='1.7'/%3E%3C/svg%3E\")}
html.mz-cyber [data-kao].mz-kao-ok::after{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4'/%3E%3Cpath d='M8 12.5l3 3 5-6'/%3E%3C/svg%3E\")}
@keyframes mz-kao-ok{0%{opacity:0;transform:scale(.6)}10%{opacity:1;transform:scale(1.06)}18%{transform:scale(1)}85%{opacity:1}100%{opacity:0}}
#mz-kao{overflow:hidden;position:fixed;inset:0;z-index:2147482900;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);opacity:0;transform:translateY(12px);transition:opacity .18s,transform .18s}
#mz-kao.in{opacity:1;transform:none}
.mz-kao-top{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 10px) 16px 6px}
.mz-kao-top b{flex:1;font-size:18px}.mz-kao-hint{font-size:12px;color:var(--muted)}
.mz-kao-x{width:40px;height:40px;border:0;border-radius:50%;background:color-mix(in srgb,var(--ink) 8%,transparent);color:inherit;font-weight:700;padding:0}
.mz-kao-search{display:flex;align-items:center;gap:8px;margin:6px 16px;padding:0 14px;height:44px;border-radius:22px;background:var(--surface,#fff);border:1px solid var(--line)}
.mz-kao-search svg{width:18px;height:18px;flex:none;fill:none;stroke:var(--muted);stroke-width:1.8;stroke-linecap:round}
#mz-kao .mz-kao-search input{flex:1;border:0!important;outline:0;background:transparent!important;box-shadow:none!important;border-radius:0!important;color:inherit;font:inherit;min-height:0;height:auto;padding:0!important;-webkit-appearance:none;appearance:none}
.mz-kao-cats{display:flex;gap:6px;overflow-x:auto;padding:6px 16px 4px;scrollbar-width:none}
.mz-kao-cats::-webkit-scrollbar{display:none}
.mz-kao-cats button{flex:none;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:13px;white-space:nowrap}
.mz-kao-cats button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.mz-kao-tip{margin:2px 16px 4px;font-size:12px;color:var(--muted)}
.mz-kao-grid{flex:1;overflow-y:auto;touch-action:pan-y;padding:6px 16px calc(var(--mz-bottom-safe, env(safe-area-inset-bottom)) + 90px);display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px;align-content:start}
.mz-kao-item{min-height:54px;padding:8px 6px;border-radius:14px;border:1px solid var(--line);background:var(--surface,#fff);color:var(--ink);font-size:15px;line-height:1.3;white-space:pre-wrap;overflow-wrap:anywhere;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;transition:transform .12s}
.mz-kao-item:active{transform:scale(.95)}
.mz-kao-item.picked{outline:2px solid var(--accent);outline-offset:-2px;background:color-mix(in srgb,var(--accent) 12%,var(--surface,#fff))}
.mz-kao-none{grid-column:1/-1;text-align:center;color:var(--muted);padding:30px 0}
.mz-kao-tray{position:absolute;left:12px;right:12px;bottom:calc(var(--mz-bottom-safe, env(safe-area-inset-bottom)) + 12px);display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:18px;background:var(--surface,#fff);box-shadow:0 10px 28px -12px #0006;border:1px solid var(--line)}
.mz-kao-tray[hidden]{display:none}
.mz-kao-tray span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mz-kao-tray button{flex:none;border:0;border-radius:12px;padding:8px 12px;background:color-mix(in srgb,var(--ink) 8%,transparent);color:inherit}
.mz-kao-tray button.primary{background:var(--accent);color:#fff}
`;
  document.head.append(css);
}
