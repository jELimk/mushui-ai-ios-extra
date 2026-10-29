'use strict';
// Meanings describe the visible expression rather than claiming unseen image details.
window.StickerMeanings={
 'png-1':'害羞、喜歡、愛心滿滿', 'png-2':'眼睛發亮，非常期待或崇拜', 'png-3':'舉手打招呼、想發言',
 'png-4':'開心大笑、活力滿滿', 'png-5':'偷偷探頭觀察', 'png-6':'被小動物碰頭，驚訝又開心',
 'png-7':'大聲喊叫、震驚', 'png-8':'不滿、哼一聲', 'png-9':'舉起紅色牌子表示支持',
 'png-10':'眨眼，送上心意或驚喜', 'png-11':'捧著禮物，開心分享', 'png-12':'仰頭期待、張嘴歡呼',
 'png-13':'拿著有火光的物品，緊張冒汗', 'png-14':'吐彩虹，誇張的受不了', 'png-15':'流汗、尷尬、慌張',
 'png-16':'露齒大笑，得意開心', 'png-17':'裹在被子裡，想休息或取暖', 'png-18':'皺眉思考、不太認同',
 'png-19':'拿著書，認真看或學習', 'png-20':'盯著電腦螢幕，疲憊或無奈', 'png-21':'氣到拍桌、非常生氣',
 'png-22':'抱著西瓜，吃東西或圍觀', 'png-23':'攤手哈哈大笑', 'png-24':'一臉問號、困惑',
 'png-25':'手放嘴邊，認真思考', 'png-26':'托腮笑、期待或小得意', 'png-27':'攤手問為什麼，不明白',
 'png-28':'震驚，張嘴愣住', 'png-29':'頭變成蝦子，誇張搞怪', 'png-30':'小水母在頭上，好奇、可愛的陪伴',
 'png-31':'大哭，眼淚流下來', 'png-32':'一大滴汗，尷尬又無奈', 'png-33':'躺進被窩，晚安、想睡覺',
 'png-34':'揮舞應援棒，加油、支持你', 'png-35':'彩虹背景，搞怪慶祝', 'png-36':'掩嘴打呵欠，睏了',
 'png-37':'拿起容器喝水或喝飲料', 'png-38':'閉眼微笑，滿足、放鬆', 'png-39':'紅心眼睛，喜歡得不得了',
 'png-40':'眼前發黑，暈眩、崩潰', 'png-41':'拿著電話，喂、想通話',
 'gif-1':'趴著探頭，可愛地等你注意', 'gif-2':'趴著生氣，表達不滿', 'gif-3':'趴著吐彩虹，誇張地受不了',
 'gif-4':'灰白失落，沒精神、崩潰', 'gif-5':'趴著哭泣，委屈、難過', 'gif-6':'突然注意到，驚訝或有發現',
 'gif-7':'沉默無語，不知道說什麼', 'gif-8':'趴著打瞌睡，晚安、累了'
};
for(const s of stickerCatalog){s.name=StickerMeanings[s.id];s.meaning=s.name;}
{const W=WebEngine,original=W.sticker;W.sticker=value=>{const s=original(value);return s?{...s,name:StickerMeanings[s.id]||s.name,meaning:StickerMeanings[s.id]||s.name}:null;};}
