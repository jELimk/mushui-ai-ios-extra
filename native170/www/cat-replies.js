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
  // ---------- awake: the cats' personalities (the user's own words, 3.4.4) ----------
  //  小獅 Lion   comes to you when you don't go to him; likes a pet now and then, petted too long he gets cross and bites; knows he's
  //              cute and often acts cute for treats; clever but cheeky (does what he's told not to); eats / drinks only when he
  //              needs to; one big poop, always in the litter box, even a dirty one
  //  屁屁 Lapis  a princess: the boss of the house, humans are servants; lazy and wilful; doesn't care if treats are stolen,
  //              won't walk to a far one; knows "shake" but won't do it, and sulks if then given the treat (not a pet);
  //              rarely acts cute; loves food (angry or happy, he eats); hates water (a sip to stay alive; forced → loud
  //              angry meows); picky litter: one or two poops in the box or sand not changed → goes on the floor
  //  玉米 Teddy  playful, thinks everything is play; a kitten with sharp teeth that hurt by accident; a bit slow (took ages to
  //              learn his name); eats purring and kneading; loves water, drinks often and splashes everywhere; tapped for
  //              being naughty he thinks it's play and bites / paws back
  const TOPIC = [
    ['shake', /握手|手手|伸手|給手|shake|paw please|give (me )?(a |your )?paw/i],
    ['snack', /零食|罐罐|肉泥|貓條|點心|小魚乾|凍乾|treat|snack|churu/i],
    ['litter', /貓砂|廁所|便便|大便|尿尿|上廁所|拉屎|poop|pee|litter|toilet/i],
    ['water', /喝水|喝點水|水碗|飲水|drink|water/i],
    ['food', /吃飯|飯飯|飼料|餓|吃東西|晚餐|早餐|food|hungry|dinner|breakfast|eat/i],
    ['hit', /打你|打他|揍|拍你一下|拍一下|教訓|hit|smack|spank|slap/i],
    ['no', /不可以|不准|不行|不要這樣|住手|下來|別再|stop it|don'?t|no!|no no/i],
    ['play', /玩|逗貓棒|逗你|球球|追|雷射|play|toy|chase|laser/i],
    ['name', /小獅|玉米|屁屁|\blion\b|\bteddy\b|\blapis\b|你的名字|叫你|過來|come here/i],
  ];
  const topicOf = (t) => TOPIC.find(([, re]) => re.test(t))?.[0] || '';
  const AW = {
    shake: {
      [L]: [['（很聰明地伸出手手）喵～零食呢？', '(cleverly holds out his paw) mew~ where’s the treat?'], ['（手手放到你手上，眼睛盯著零食袋）', '(paw in your hand, eyes on the treat bag)'], ['（握完手立刻翻肚撒嬌）喵嗚～快給零食', '(shakes, then flops belly-up being cute) mrrow~ treat now']],
      [P]: [['（明明知道怎麼做，就是不伸手）', '(knows exactly how, just won’t do it)'], ['（看著你的手，再看著你）……不要。', '(looks at your hand, then at you)… no.'], ['（把頭轉開）本喵才不握手', '(turns his head away) this cat doesn’t do “shake”']],
      [T]: [['喵？（不懂，咬住你的手指）', 'Mew? (doesn’t get it, bites your finger)'], ['（以為要玩，抱住你的手咬咬踢踢）', '(thinks it’s play, grabs your hand and bunny-kicks)'], ['（伸手……打你一下）喵！', '(raises a paw… and bops you) mew!']],
    },
    snack: {
      [L]: [['喵～（睜大眼睛裝可愛）', 'Meow~ (huge cute eyes)'], ['（蹭你的腿，翻肚肚，喵喵叫討零食）', '(rubs your leg, rolls belly-up, meows for treats)'], ['（坐得端端正正，歪頭）喵？本喵很乖吧', '(sits up nice and straight, tilts head) mew? good cat, right?'], ['（知道自己很可愛，一直喵喵叫）', '(knows he’s adorable, meows and meows)']],
      [P]: [['奴才，還不快拿過來', 'Servant. Bring it here. Now.'], ['（零食離太遠，懶得走過去）', '(the treat is too far — can’t be bothered to walk over)'], ['（零食被搶走也懶得管，吃自己手邊的）', '(someone stole a treat — doesn’t care, eats the one in front of him)'], ['……喵～（難得裝可愛一下）', '… mew~ (a rare moment of acting cute)']],
      [T]: [['喵喵喵！（撲過來，差點咬到你的手）', 'Mew mew mew! (pounces, nearly bites your hand)'], ['（一邊吃一邊呼嚕呼嚕）', '(eating and purring at once)'], ['（叼著零食跑走，又跑回來要）', '(runs off with a treat, comes back for more)']],
    },
    litter: {
      [L]: [['（去貓砂盆上了一大坨，很滿意）', '(does one huge poop in the litter box, very pleased)'], ['（貓砂盆很髒也照樣進去上）', '(goes in the litter box even though it’s dirty)'], ['（上完一大坨，跑酷三圈）', '(one enormous poop, then three zoomies laps)']],
      [P]: [['（看了一眼貓砂盆裡有一坨……轉身上在地板上）', '(sees one poop in the box… turns and goes on the floor)'], ['（貓砂太久沒換，本喵拒絕）上在地板。', '(the sand hasn’t been changed — this cat refuses) floor it is.'], ['（嫌棄地看著貓砂盆）奴才，換。', '(eyes the litter box with disgust) servant. change it.']],
      [T]: [['（在貓砂盆裡挖挖挖，砂噴得到處都是）', '(dig dig dig — sand flies everywhere)'], ['（上完以為是遊戲，在砂裡打滾）', '(done, thinks it’s a game, rolls in the sand)'], ['喵！（埋了好久，自己也忘了在埋什麼）', 'Mew! (buries it for ages, forgets what he was burying)']],
    },
    water: {
      [L]: [['（不渴，不喝）', '(not thirsty, not drinking)'], ['（渴了，去喝了幾口）', '(thirsty, goes for a few laps)'], ['喵。（看了一眼水碗，走掉）', 'Mew. (glances at the water bowl, walks away)']],
      [P]: [['（舔了一下，好了，活著就好）', '(one lick. done. enough to stay alive)'], ['（喝了一小口就走了，像是為了活著才喝）', '(one tiny sip and off he goes — drinking only to stay alive)'], ['（看著水碗，一臉嫌棄）', '(stares at the water bowl, disgusted)']],
      [T]: [['（舔舔舔，水濺得到處都是）', '(lap lap lap — water everywhere)'], ['喵～（又去喝水了，下巴濕濕的）', 'Mew~ (off to drink again, wet chin)'], ['（用手手撈水玩，地板都濕了）', '(scoops the water with his paw, the floor is soaked)']],
    },
    food: {
      [L]: [['（不餓，不吃）', '(not hungry, not eating)'], ['（餓了，喀滋喀滋吃幾口）', '(hungry, crunches a few bites)'], ['喵？（現在不餓啦）', 'Mew? (not hungry right now)']],
      [P]: [['（開心，吃一下）', '(happy — eats a bit)'], ['（生氣，也吃一下）', '(angry — eats a bit too)'], ['奴才，飯呢？本喵要吃飯', 'Servant, where’s dinner? This cat wants to eat'], ['（全家最愛吃飯的就是本喵）喀滋喀滋', '(the biggest foodie in the house) crunch crunch']],
      [T]: [['（呼嚕呼嚕，邊踩踩邊吃飯）', '(purring, kneading as he eats)'], ['喵喵！（衝到碗前面，呼嚕呼嚕）', 'Mew mew! (dashes to the bowl, purring)'], ['（吃一口踩一下，呼嚕～）', '(a bite, a knead, purr~)']],
    },
    hit: {
      [L]: [['喵嗷！（被拍一下，不爽地咬回來）', 'MRAOW! (tapped — bites back, annoyed)'], ['（瞪你一眼，然後咬你）', '(glares, then bites)'], ['（尾巴甩甩，假裝沒事，等等再來）', '(flicks tail, pretends nothing happened, will be back)']],
      [P]: [['哈——！（大小姐生氣了，轉身就走）', 'Hhhh! (her majesty is offended, walks off)'], ['（不可置信地看著你）奴才竟敢……', '(stares in disbelief) the servant dares…'], ['（炸毛哈氣，三天不理你）', '(fur up, hissing — you’re ignored for three days)']],
      [T]: [['喵！（以為你要跟他玩，撲上來咬你、用手手打你）', 'Mew! (thinks you want to play — pounces, bites and paws at you)'], ['（抱住你的手，咬咬咬，踢踢踢）', '(hugs your hand, bite bite, kick kick)'], ['喵喵！（再來再來！）', 'Mew mew! (again! again!)']],
    },
    no: {
      [L]: [['（看著你，慢慢把杯子推下桌）', '(looks right at you and slowly pushes the cup off the table)'], ['喵？（聽懂了，但還是要做）', 'Mew? (understood perfectly — doing it anyway)'], ['（停了一秒，又繼續）', '(stops for one second, then carries on)']],
      [P]: [['哼。本喵想做什麼就做什麼', 'Hmph. This cat does as this cat pleases'], ['（假裝沒聽到）', '(pretends not to hear)'], ['（瞄你一眼）奴才管太多了', '(a sideways look) the servant talks too much']],
      [T]: [['喵？（以為是在跟他玩，更起勁了）', 'Mew? (thinks it’s a game, gets even more excited)'], ['（歪頭，然後繼續）', '(head tilt — and keeps going)'], ['（跑走又跑回來）喵～', '(runs off, runs back) mew~']],
    },
    play: {
      [L]: [['（玩了兩下，假裝不感興趣，又偷偷撲一下）', '(plays a little, acts bored, then sneaks a pounce)'], ['喵！（很聰明地從旁邊包抄）', 'Mew! (cleverly flanks it from the side)'], ['（玩夠了，走過來找你擼）', '(done playing, comes over for pets)']],
      [P]: [['（躺著看你玩，懶得動）', '(lies there watching you play, too lazy to move)'], ['（手手動了一下……算了）', '(a paw twitches… nah)'], ['奴才自己玩吧', 'Play by yourself, servant']],
      [T]: [['喵喵喵！（撲撲撲，超興奮）', 'Mew mew mew! (pounce pounce pounce, so excited)'], ['（衝來衝去，撞到桌腳）喵！', '(zooms around, bonks into the table leg) mew!'], ['（咬住逗貓棒不放，不小心咬到你的手）', '(won’t let go of the toy, accidentally bites your hand)']],
    },
    name: {
      [L]: [['喵～（馬上跑過來）', 'Meow~ (comes running right away)'], ['（你沒找本喵，本喵也會來找你）喵', '(even if you don’t call, this cat comes to you) mew'], ['（豎起尾巴走過來蹭你）', '(tail up, comes over to rub against you)']],
      [P]: [['（耳朵動了一下，沒過來）', '(an ear twitches. he doesn’t come)'], ['……（假裝沒聽到）', '… (pretends not to hear)'], ['（慢慢眨眼）有事嗎，奴才', '(slow blink) yes, servant?']],
      [T]: [['（左看右看，不知道在叫誰）', '(looks left, looks right — who’s that for?)'], ['喵？（想了好久……喔！是在叫我！）', 'Mew? (thinks for ages… oh! that’s me!)'], ['（跑過來，跑錯方向）喵～', '(runs over — the wrong way) mew~']],
    },
  };
  const PETR = {
    [L]: [[['呼嚕嚕～（剛好想被擼）', 'Purrr~ (just in the mood for pets)'], ['（主動把頭頂過來）喵～', '(pushes his head into your hand) mew~'], ['（瞇眼享受）呼嚕…', '(eyes half shut, enjoying it) purr…']],
      [['嗯……（尾巴開始甩）', 'Mmm… (tail starts lashing)'], ['喵。（有點不開心了）', 'Mew. (getting a bit cross)'], ['（耳朵往後壓）嗯嗯嗯…', '(ears flattening) mm-mm-mm…']],
      [['嘶——！（擼太久，咬你一口）', 'Hssss! (petted too long — bites you)'], ['喵嗷！（狠狠咬住你的手）', 'MRAOW! (bites your hand hard)'], ['（咬完就跑）', '(bites, then bolts)']]],
    [P]: [[['（准你擼一下）', '(you may pet this cat. briefly)'], ['呼嚕…（大小姐心情好）', 'Purr… (her majesty is in a good mood)'], ['（抬起下巴）這裡，奴才', '(lifts his chin) here, servant']],
      [['好了，奴才，夠了', 'That’s enough, servant'], ['（尾巴甩甩）本喵累了', '(tail flick) this cat is tired'], ['喵。（停。）', 'Mew. (stop.)']],
      [['哈——！（不准再碰）', 'Hhhh! (no more touching)'], ['（一掌拍開你的手）', '(swats your hand away)'], ['（起身換個地方睡）', '(gets up and goes to sleep somewhere else)']]],
    [T]: [[['呼嚕呼嚕～（踩踩）', 'Purr purr~ (kneading)'], ['喵～（翻肚肚）', 'Mew~ (belly up)'], ['（蹭蹭你的手）', '(nuzzles your hand)']],
      [['（以為要玩，抱住你的手）', '(thinks it’s play, grabs your hand)'], ['喵！（咬咬，牙齒好尖）', 'Mew! (nibble — such sharp little teeth)'], ['（後腳踢踢）', '(bunny-kicks)']],
      [['喵嗚！（玩太嗨，不小心咬痛你了）', 'Mrrow! (too wound up — bites a bit too hard by accident)'], ['（撲上來咬咬咬）', '(pounces, bite bite bite)'], ['（咬完舔舔你，好像知道錯了）', '(bites, then licks you like he knows he overdid it)']]],
  };
  const HUGR = {
    [L]: [['喵！（從你手裡溜走）', 'Mew! (slips out of your arms)'], ['（扭來扭去，跳下去又自己回來蹭你）', '(wriggles free, then comes back to rub against you on his own)'], ['嗯嗯嗯…（不想被抱，但想被擼）', 'Mm-mm-mm… (no holding, but pets are fine)']],
    [P]: [['放本喵下來，奴才', 'Put this cat down, servant'], ['喵嗷！（大聲抗議，拼命掙扎）', 'MRAOW! (loud protest, struggling hard)'], ['（全身僵硬，一臉不可置信）', '(goes stiff, utterly unimpressed)']],
    [T]: [['喵～（以為要玩，在你懷裡咬咬踢踢）', 'Mew~ (thinks it’s play — bites and kicks in your arms)'], ['（抱著也不安分，一直扭）', '(won’t stay still in your arms)'], ['（咬住你的袖子）', '(grabs your sleeve in his teeth)']],
  };
  const IDLE = {
    [L]: [['喵～（你不找本喵，本喵來找你了）', 'Meow~ (you didn’t come to this cat, so this cat came to you)'], ['（跳上桌子，看你一眼，把東西推下去）', '(jumps on the table, looks at you, knocks something off)'], ['喵喵！（一直跟著你）', 'Mew mew! (follows you everywhere)'], ['（蹭蹭你）擼本喵一下嘛', '(rubs against you) pet this cat a little?']],
    [P]: [['奴才，本喵渴了……算了，本喵餓了', 'Servant, this cat is thirsty… never mind, this cat is hungry'], ['（坐在最高的地方俯視你）', '(sits in the highest spot, looking down on you)'], ['喵。（這個家本喵最大）', 'Mew. (this cat runs this house)'], ['（懶洋洋地躺著，一動也不動）', '(lazing about, not moving an inch)']],
    [T]: [['喵喵喵！（衝過來撲你的腳）', 'Mew mew mew! (charges over and pounces on your feet)'], ['（追自己的尾巴）', '(chasing his own tail)'], ['喵？（來玩嘛）', 'Mew? (play with me?)'], ['（咬你的拖鞋）', '(attacking your slipper)']],
  };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  // 屁屁 refused to shake; given the treat anyway soon after, he sulks and won't eat it
  const SHAKE = 'mz-lapis-shake';
  const awake = (id, t, ctx) => {
    const act = actOf(t), topic = topicOf(t), n = ctx.streak || 1;
    if (id === P && topic === 'shake') { try { localStorage.setItem(SHAKE, String(Date.now())); } catch {} }
    if (id === P && topic === 'snack') {
      let at = 0; try { at = Number(localStorage.getItem(SHAKE) || 0); localStorage.removeItem(SHAKE); } catch {}
      if (Date.now() - at < 10 * 60000) return pick([['（扭頭不吃）本喵又不是寵物', '(turns his nose up) this cat is not a pet'], ['哼。（鬧脾氣，看都不看零食）', 'Hmph. (sulking, won’t even look at the treat)']]);
    }
    if (id === P && topic === 'water' && /逼|強迫|硬要|灌|force|make (him|you) drink/i.test(t)) return pick([['喵嗷！喵嗷！喵嗷！（很生氣地大叫，拼命掙扎）', 'MRAOW! MRAOW! MRAOW! (furious yowling, struggling hard)'], ['（扭來扭去大聲抗議，一滴都不喝）', '(squirms, protests loudly, won’t drink a drop)']]);
    if (topic && topic !== 'name' && topic !== 'play' || (topic && !act)) return pick(AW[topic][id]);
    if (act === 'pickup') return pick(HUGR[id]);
    if (act) return pick(PETR[id][n >= 4 ? 2 : n >= 2 ? 1 : 0]);
    if (topic) return pick(AW[topic][id]);
    return null;
  };
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
    if (state === 'awake') { const a = awake(id, t, ctx); if (a) return a; }
    if (state === 'awake' && !act && ASK.test(t)) return pick(ASKR[id]);
    if (state === 'awake') return pick(IDLE[id]);
    return null;
  };
  window.mzCatAction = actOf;
}
