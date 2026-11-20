'use strict';
// 3.4.2: what 小獅 Lion, 屁屁 Lapis and 玉米 Teddy do — written out in the app, no AI. Every reaction from the user's
// list has several wordings; cat-friends.js picks one and adds a random cat kaomoji, so it never reads as canned.
// window.mzCatReply(catId, lastLine, { state: 'sleep' | 'eat' | 'drink' | 'awake', streak }) → [zh, en] or null
// (null = fall back to cat-friends.js's everyday personality lines). Questions with no answer get 「本喵答不上這題」-style lines.
{
  const L = 'mz-cat-orange', P = 'mz-cat-siamese', T = 'mz-cat-tabby';
  // what the user did, most specific first
  const ACT = [
    ['belly', /肚|belly|tummy/i],
    ['pickup', /抱|摟|撈起|hug|cuddle|pick (him )?up|hold/i],
    ['head', /摸頭|拍頭|揉頭|摸摸頭|摸他的頭|頭頂|head ?pat|pat (his |the )?head/i],
    ['poke', /戳|點點|碰一下|poke|boop|nudge/i],
    ['other', /擼|摸|揉|撫|梳毛|順毛|拍拍|撓|搔|pet|stroke|rub|scratch|brush/i],
  ];
  const actOf = (t) => ACT.find(([, re]) => re.test(t))?.[0] || '';
  const SAD = /難過|傷心|想哭|哭了|好累|好煩|心情不好|不開心|心情差|好難受|崩潰|孤單|寂寞|委屈|壓力好大|sad|cry|crying|upset|lonely|depressed|stressed|tired of/i;
  const BDAY = /生日快樂|生日|happy birthday|birthday/i;
  const MEOW = /^[\s,，。.!！?？~～]*((喵|咪|meow|mew|nya|miao|mrr?ow)[\s,，。.!！?？~～嗚嗷]*)+$/i;
  const R = {
    // ---------- 喝水 ----------
    drink: {
      head: {
        [L]: [['（繼續低頭喝水，舔舔舔）', '(keeps drinking, lap lap lap)'], ['（被摸頭也照喝不誤）', '(lets you pat his head and keeps drinking)'], ['舔…舔…（繼續喝水）', 'Lap… lap… (still drinking)']],
        [P]: [['（繼續喝水）', '(keeps drinking)'], ['（耳朵動一下，繼續喝）', '(an ear twitches, keeps drinking)'], ['舔舔…（沒理你，繼續喝水）', 'Lap lap… (ignores you, keeps drinking)']],
        [T]: [['喵？（以為你要玩，伸手扒拉你的手）', 'Mew? (thinks you want to play, paws at your hand)'], ['（抬頭用肉球扒拉你）喵～', '(looks up and paws at you) mew~'], ['（水也不喝了，扒拉你的手要玩）', '(forgets the water, paws at your hand to play)']],
      },
      poke: {
        [L]: [['（繼續喝水）', '(keeps drinking)'], ['舔舔舔…', 'Lap lap lap…'], ['（完全不理你，繼續喝）', '(ignores you completely, keeps drinking)']],
        [P]: [['（繼續喝水）', '(keeps drinking)'], ['舔…（尾巴甩了一下）', 'Lap… (flicks his tail)'], ['（假裝沒感覺，繼續喝）', '(pretends not to notice, keeps drinking)']],
        [T]: [['（繼續喝水）', '(keeps drinking)'], ['舔舔～', 'Lap lap~'], ['（認真喝水中）', '(busy drinking)']],
      },
      pickup: {
        [L]: [['喵！（不爽地叫了一聲）', 'Mew! (an annoyed little meow)'], ['嗯喵…（不爽）', 'Mrrm-mew… (not pleased)'], ['喵。（臉很臭）', 'Mew. (grumpy face)']],
        [P]: [['喵嗷！（生氣地叫，一直掙扎）', 'MRAOW! (angry meow, wriggling hard)'], ['喵！喵！（扭來扭去要下去）', 'Mew! Mew! (squirms to get down)'], ['（生氣地喵一聲，用力掙脫）', '(an angry meow, struggles free)']],
        [T]: [['喵…（小小聲）', 'mew… (a tiny little meow)'], ['咪…（小小聲抗議）', 'mew… (a tiny protest)'], ['（小小聲喵了一下）', '(gives the smallest mew)']],
      },
      belly: {
        [L]: [['喵！喵！喵！（生氣一直叫，但還是繼續喝水）', 'Mew! Mew! Mew! (keeps complaining, but keeps drinking)'], ['喵嗷——喵——（邊抱怨邊喝）', 'Mraow— mew— (complains while drinking)'], ['（一直生氣地喵，舌頭沒停）', '(angry meows nonstop, tongue never stops lapping)']],
        [P]: [['哈——！（用貓拳頭揍你）', 'Hhhh! (punches you with his paw)'], ['（啪！貓拳頭揍下去）哈！', '(whap! a cat punch) Hah!'], ['哈——（生氣地連揍你兩拳）', 'Hhhh— (two angry cat punches)']],
        [T]: [['喵…（抬頭不喜歡地叫一聲，小小掙扎）', 'Mew… (looks up, not liking it, wriggles a little)'], ['咪！（扭一扭身體）', 'Mew! (squirms a bit)'], ['（抬起頭不開心地喵一下）', '(lifts his head and gives an unhappy mew)']],
      },
      other: {
        [L]: [['（繼續喝水）', '(keeps drinking)'], ['舔…舔…', 'Lap… lap…'], ['（隨你擼，水照喝）', '(pet him all you like, he keeps drinking)']],
        [P]: [['喵！喵！喵！（不爽地一直叫，繼續喝水）', 'Mew! Mew! Mew! (grumbles nonstop, keeps drinking)'], ['喵——喵——（抱怨中，但沒停下來喝水）', 'Meow— meow— (complaining, still drinking)'], ['（一直不爽地喵，舔舔舔）', '(annoyed meows, lap lap lap)']],
        [T]: [['（繼續喝水）', '(keeps drinking)'], ['舔舔舔～', 'Lap lap lap~'], ['（喝得很專心）', '(drinking very seriously)']],
      },
    },
    // ---------- 吃飯 ----------
    eat: {
      head: {
        [L]: [['（繼續吃飯，喀滋喀滋）', '(keeps eating, crunch crunch)'], ['（頭被摸也照吃）', '(head patted, still eating)'], ['喀滋…喀滋…', 'Crunch… crunch…']],
        [P]: [['（扭過頭，不讓你碰）', '(turns his head away, no touching)'], ['（把頭別開，繼續吃）', '(moves his head away and keeps eating)'], ['（躲開你的手）', '(dodges your hand)']],
        [T]: [['呼嚕呼嚕…（一邊吃一邊呼嚕）', 'Purr purr… (purring while he eats)'], ['（喀滋喀滋＋呼嚕呼嚕）', '(crunch crunch + purr purr)'], ['呼嚕～（吃得好開心）', 'Purr~ (happily eating)']],
      },
      poke: {
        [L]: [['（繼續吃飯）', '(keeps eating)'], ['喀滋喀滋…', 'Crunch crunch…'], ['（頭也不抬）', '(doesn’t even look up)']],
        [P]: [['喵。（不爽地叫一下）', 'Mew. (one annoyed meow)'], ['喵！（別吵）', 'Mew! (don’t bother me)'], ['（不爽地喵了一聲，繼續吃）', '(an annoyed meow, then back to eating)']],
        [T]: [['（繼續吃飯）', '(keeps eating)'], ['喀滋…', 'Crunch…'], ['（專心吃飯中）', '(focused on dinner)']],
      },
      pickup: {
        [L]: [['喵！（不爽）', 'Mew! (annoyed)'], ['喵嗚…（不爽地叫）', 'Mrrow… (grumbles)'], ['喵。（我還沒吃完）', 'Mew. (I wasn’t done)']],
        [P]: [['喵嗷！哈——！（生氣地掙扎）', 'MRAOW! Hhhh! (struggles angrily)'], ['哈！喵！（扭來扭去要下去）', 'Hah! Mew! (twists to get down)'], ['（生氣地叫、哈氣、拼命掙扎）', '(angry meows, hissing, struggling hard)']],
        [T]: [['呼嚕…（伸出爪爪想回去吃飯）', 'Purr… (reaches his paws back toward the bowl)'], ['（一邊呼嚕一邊伸手要碗）', '(purring and reaching for his bowl)'], ['喵～（爪爪朝碗的方向揮）', 'Mew~ (paws waving at the bowl)']],
      },
      belly: {
        [L]: [['（啪！用貓拳頭揍你一下）', '(whap! one cat punch)'], ['喵！（一拳打過來）', 'Mew! (a quick punch)'], ['（貓拳頭揍了你一下，繼續吃）', '(punches you once, back to eating)']],
        [P]: [['哈——！（生氣地用力咬你）', 'Hhhh! (bites you hard, angry)'], ['（狠狠咬了你一口）', '(bites you really hard)'], ['喵嗷！（用力咬下去）', 'MRAOW! (a hard bite)']],
        [T]: [['喵！（以為要一起玩，咬你一下）', 'Mew! (thinks it’s play time, bites you)'], ['（撲過來咬你一口）喵～', '(pounces and bites) mew~'], ['（抱住你的手咬咬）', '(grabs your hand and bites)']],
      },
      other: {
        [L]: [['（繼續吃飯）', '(keeps eating)'], ['喀滋喀滋～', 'Crunch crunch~'], ['（隨便你擼，繼續吃）', '(lets you pet, keeps eating)']],
        [P]: [['喵。（不爽地叫一下）', 'Mew. (an annoyed meow)'], ['喵！（別摸我）', 'Mew! (stop touching me)'], ['（尾巴不耐煩地甩）喵', '(tail lashing) mew']],
        [T]: [['（看你一眼，繼續吃飯，呼嚕呼嚕）', '(glances at you, keeps eating, purring)'], ['呼嚕…（瞄你一下又低頭吃）', 'Purr… (a quick look, then back to the bowl)'], ['（呼嚕呼嚕地繼續吃）', '(keeps eating, purring away)']],
      },
    },
    // ---------- 睡覺 ----------
    sleep: {
      head: {
        [L]: [['（抬頭看了你一下，被擼得開心，嘴巴微微張開）', '(lifts his head to look at you, so happy his mouth falls a little open)'], ['（瞇眼抬頭，舒服到嘴巴開開的）', '(squints up at you, so comfy his mouth is slightly open)'], ['…（看你一眼，開心地微張嘴）', '… (one look at you, mouth a little open in bliss)']],
        [P]: [['（翻成肚肚朝上給你擼）', '(rolls belly-up for you to pet)'], ['（開心地翻來翻去）呼嚕～', '(rolls around happily) purr~'], ['（翻肚肚，擼了就一直開心地翻滾）', '(belly up, and rolls and rolls as you pet him)']],
        [T]: [['zzz…（繼續睡）', 'zzz… (sleeps on)'], ['（睡得很熟）', '(fast asleep)'], ['呼…呼…', 'Huu… huu…']],
      },
      poke: {
        [L]: [['（抬頭看你一下，又繼續睡）', '(looks up at you, then goes back to sleep)'], ['…（看一眼，倒頭繼續睡）', '… (one look, back to sleep)'], ['（睜一隻眼看你，又閉上）', '(opens one eye at you, closes it again)']],
        [P]: [['（翻成肚肚朝上給你擼）', '(rolls belly-up for you)'], ['（開心地翻滾）呼嚕～', '(rolls happily) purr~'], ['（翻肚肚等你擼）', '(belly up, waiting for pets)']],
        [T]: [['zzz…（繼續睡）', 'zzz… (sleeps on)'], ['（完全沒醒）', '(doesn’t wake at all)'], ['呼…（翻身繼續睡）', 'Huu… (rolls over, still asleep)']],
      },
      pickup: {
        [L]: [['……（還沒反應過來，正在開機中）', '…… (hasn’t worked it out yet — still booting up)'], ['（愣住，開機中……）', '(frozen — booting up…)'], ['…？（腦袋還沒醒，正在開機）', '…? (brain still asleep, loading)']],
        [P]: [['（拼命掙扎）', '(struggles hard)'], ['（扭來扭去要下去）', '(wriggles to get down)'], ['（掙扎著跳下去）', '(squirms free and jumps down)']],
        [T]: [['喵…（不喜歡地叫一下）', 'Mew… (an unhappy little meow)'], ['咪！（不要抱）', 'Mew! (no carrying)'], ['（迷迷糊糊不喜歡地喵）', '(a sleepy, unhappy mew)']],
      },
      belly: {
        [L]: [['zzz…（繼續睡）', 'zzz… (sleeps on)'], ['（肚肚被擼也照睡）', '(belly rubs, still asleep)'], ['呼嚕…zzz', 'Purr… zzz']],
        [P]: [['喵！（不開心，咬你一口）', 'Mew! (unhappy, bites you)'], ['（不開心地喵，然後咬你）', '(an unhappy meow, then a bite)'], ['哈…（咬住你的手）', 'Hhh… (bites your hand)']],
        [T]: [['zzz…（繼續睡）', 'zzz… (sleeps on)'], ['（睡得超熟）', '(sound asleep)'], ['呼…呼…', 'Huu… huu…']],
      },
      other: {
        [L]: [['（抬頭看你一下，開始咬被子、踩被子）', '(looks up, then starts biting and kneading the blanket)'], ['（踩踩踩，咬著被子）', '(knead knead, chewing the blanket)'], ['呼嚕…（邊咬被子邊踩奶）', 'Purr… (kneading and nibbling the blanket)']],
        [P]: [['（翻成肚肚朝上給你擼）', '(rolls belly-up for you)'], ['（開心地翻滾）', '(rolls around happily)'], ['（翻肚肚，擼了就翻來翻去）', '(belly up, rolling as you pet)']],
        [T]: [['zzz…（繼續睡）', 'zzz… (sleeps on)'], ['（睡得很香）', '(sleeping sweetly)'], ['呼…', 'Huu…']],
      },
    },
  };
  const SADR = {
    [L]: [['（默默走過來給你擼）', '(quietly comes over to be petted)'], ['（假裝咬被子、踩被子，其實是來陪你的）', '(pretends to knead the blanket — really he came to keep you company)'], ['……（什麼都不說，靜靜地靠在你身邊）', '…… (says nothing, just leans against you)'], ['（窩在你腳邊陪著你）', '(curls up by your feet to stay with you)']],
    [P]: [['（不理你）', '(ignores you)'], ['（覺得你很煩，走開）', '(finds you annoying, walks off)'], ['（瞄你一眼，繼續舔毛）', '(glances at you, keeps grooming)']],
    [T]: [['喵？（不懂，以為你要玩，用爪爪跟你玩）', 'Mew? (doesn’t get it, thinks you want to play, paws at you)'], ['（拍拍你的手，要你陪他玩）', '(pats your hand, wants to play)'], ['喵～（用爪爪逗你玩）', 'Mew~ (plays with you with his paws)']],
  };
  const MEOWR = {
    [L]: [['嗯嗯嗯嗯……（生氣的聲音）', 'Mmm-mmm-mmm… (his cross little growl)'], ['嗯——嗯嗯嗯…', 'Mmmm— mm-mm-mm…'], ['嗯嗯嗯嗯嗯！（不准學我）', 'Mm-mm-mm-mm! (no copying me)']],
    [P]: [['（不理你，走掉）', '(ignores you and walks away)'], ['（瞪你一眼，走了）', '(gives you a look and leaves)'], ['……（轉身離開）', '…… (turns and leaves)']],
    [T]: [['喵！喵喵！', 'Mew! Mew mew!'], ['喵～喵～喵～（跟著你叫）', 'Mew~ mew~ mew~ (meows along with you)'], ['喵喵喵！', 'Mew mew mew!']],
  };
  const BDAYR = [['？（不懂，只顧著吃零食）', '? (doesn’t get it, busy eating his treats)'], ['（埋頭吃零食，喀滋喀滋）', '(face in the treats, crunch crunch)'], ['喵？（零食比較重要）', 'Mew? (treats come first)'], ['（叼著零食跑走）', '(runs off with a treat)']];
  // a question the cats can't answer (only while awake — asleep they just snore): each says so in its own way
  const ASK = /[?？]|嗎|呢$|什麼|為什麼|怎麼|哪裡|哪個|幾點|多少|是不是|可不可以|能不能|how|what|why|where|when|which|who|can you|do you/i;
  const ASKR = {
    [L]: [['喵？（歪頭）本喵沒有辦法答上這題', 'Mew? (tilts head) this cat can’t answer that one'], ['（眨眨眼）本喵答不出來啦，摸摸本喵就好', '(blinks) this cat has no answer — just pet me instead'], ['喵嗚…本喵不懂，可是本喵會陪著你', 'Mrrow… this cat doesn’t know, but this cat will stay with you']],
    [P]: [['（甩甩尾巴）本喵才懶得回答', '(flicks tail) this cat can’t be bothered to answer'], ['喵。本喵不知道，也不想知道', 'Mew. This cat doesn’t know and doesn’t care'], ['（打個哈欠）這題本喵答不上來', '(yawns) this cat can’t answer that']],
    [T]: [['喵？本喵不知道耶，要不要來玩？', 'Mew? This cat doesn’t know — wanna play?'], ['（歪頭）這題太難了，本喵答不出來喵～', '(head tilt) too hard, this cat can’t answer~'], ['喵喵？本喵只知道逗貓棒在哪裡', 'Mew mew? All this cat knows is where the feather toy is']],
  };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  window.mzCatReply = (id, last, ctx = {}) => {
    const t = String(last || '').trim(), state = ctx.state || 'awake', act = actOf(t);
    if (act && state !== 'awake') {
      // 屁屁 at dinner: petting somewhere else for long → a cat punch
      if (state === 'eat' && act === 'other' && id === P && (ctx.streak || 0) >= 3) return pick([['（不爽到用貓拳頭揍你）', '(fed up — punches you with his paw)'], ['喵嗷！（啪！貓拳頭）', 'MRAOW! (whap! cat punch)']]);
      return pick(R[state]?.[act]?.[id] || [['喵。', 'Mew.']]);
    }
    if (BDAY.test(t)) return pick(BDAYR);
    if (MEOW.test(t)) return pick(MEOWR[id]);
    if (SAD.test(t) && !act) return pick(SADR[id]);
    if (state === 'awake' && !act && ASK.test(t)) return pick(ASKR[id]);
    return null;
  };
  window.mzCatAction = actOf;
}
