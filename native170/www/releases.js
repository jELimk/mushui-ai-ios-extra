"use strict";
// Official account release posts (Moments), one per version from 3.0.0 on, newest last.
// Every post stays; posts from versions before 3.0.0 are removed. The text follows the app language.
// New versions are appended by .claude/skills/mizuki-release/scripts/bump_version.py.
const MZ_RELEASES = [
 {
  "version": "3.0.0",
  "date": "2026-10-31T15:00:00+08:00",
  "zh": "沐水 3.0.0 來啦！( ੭ ˙ᗜ˙ )੭\n這次帶來全新的「自訂 AI」，選幾個喜歡的設定，就能做出專屬於你的 AI。\n\n－ 自訂 AI：選擇性別、關係、人設、性格與說話方式，沐水會替 AI 寫好個性和說話方式。\n－ 快速開始：登入後可以直接建立自訂 AI，馬上開始聊天。\n－ 個人化：建立完成後可以選擇生成拍一拍、頭像、朋友圈背景與語音，生成後自動套用。\n\n還有任何問題都可以來找沐水聊聊哦！沐水一直都在 (｡•ᴗ•｡)",
  "en": "Mizuki 3.0.0 is here! ( ੭ ˙ᗜ˙ )੭\nThis update brings Custom AI: pick a few things you like and get an AI that's all yours.\n\n- Custom AI: Choose gender, relationship, character type, personality and speaking style, and Mizuki writes the personality and speaking style.\n- Quick start: Right after signing in, you can create a custom AI and start chatting.\n- Personal touches: After creating it, choose to generate a poke line, profile photo, Moments cover and voice — all applied automatically.\n\nIf anything still feels off, come and tell Mizuki — I'm always here! (｡•ᴗ•｡)"
 },
 {
  "version": "3.0.1",
  "date": "2026-11-01T09:30:00+08:00",
  "zh": "沐水帶著 3.0.1 更新來找你啦！( ੭ ˙ᗜ˙ )੭\n這次把大家回報的問題一個一個修好了，也讓沐水用起來更順手。\n\n－ 英文介面：全面檢查並補齊翻譯，切換成英文時不會再出現中文。\n－ 傳送訊息：按下送出就立即顯示，不會再出現「正在傳送中」，連續傳送也會照順序送達。\n－ 聊天室：修正拍一拍與打字時，畫面跳到上面訊息的問題。\n－ 星星：提醒改成系統訊息樣式，並寫明是哪台裝置（手機或電腦）的通知。\n－ 效能：減少聊天室重繪的負擔，左右滑動訊息時更流暢。\n\n還有任何問題都可以來找沐水聊聊哦！沐水一直都在 (｡•ᴗ•｡)",
  "en": "Mizuki 3.0.1 is here! ( ੭ ˙ᗜ˙ )੭\nThis update fixes the problems you told us about one by one and makes Mizuki smoother to use.\n\n- English: Every screen was checked and translated — no more Chinese when you switch to English.\n- Sending: Messages appear the moment you tap Send, with no \"sending\" wait, and arrive in the order you typed them.\n- Chats: Fixed the chat jumping to older messages after a poke or while typing.\n- Stars: Alerts now show as system messages and say which device (phone or computer) they came from.\n- Performance: Lighter chat redraws, so swiping messages left or right feels smoother.\n\nIf anything still feels off, come and tell Mizuki — I'm always here! (｡•ᴗ•｡)"
 },
 {
  "version": "3.0.2",
  "date": "2026-11-01T22:42:54+08:00",
  "zh": "沐水 3.0.2 來囉！( ੭ ˙ᗜ˙ )੭\n這次修好了大家回報的小問題，也加了幾個貼心的新設定。\n\n－ 朋友圈：3.0.0 起的官方更新貼文都會保留，不再刪除。\n－ 英文介面：補齊更多翻譯，系統訊息、拍一拍與星星提醒會跟著語言切換，每台裝置可以各自選語言。\n－ 聊天：修正電腦與手機聊天室閃到上面訊息、按鈕閃動的問題。\n－ AI 的日常：新增「一次回覆一則訊息」，可選擇 AI 分段傳送或一次說完。\n－ 朋友圈回覆：AI 回覆格式出錯時不再顯示程式碼。\n－ 登入裝置：顯示每台裝置的名稱。\n－ 電腦版：Enter 可確認輸入，滑鼠側鍵可上一頁／下一頁；圖片生成選項回到右側設定頁。\n－ 設定：「已移除的角色」卡片大小和其他卡片一致。\n\n用得開心的話，也來跟沐水說說話吧！(｡•ᴗ•｡)",
  "en": "Mizuki 3.0.2 is here! ( ੭ ˙ᗜ˙ )੭\nThis update fixes the little things you reported and adds a few handy settings.\n\n- Moments: Official update posts from 3.0.0 on now stay instead of being removed.\n- English: More translations; system notices, pokes and Star alerts follow your language, and each device can pick its own.\n- Chats: Fixed chats jumping to older messages and buttons flickering on computers and phones.\n- AI's day: New \"Reply in one message\" option — choose short messages or one complete reply.\n- Moments replies: A broken AI reply no longer shows code.\n- Signed-in devices: Each device now shows its name.\n- Desktop: Enter confirms inputs, mouse side buttons go back and forward, and image generation sits in the settings panel again.\n- Settings: The \"Removed roles\" card now matches the other cards.\n\nIf you're enjoying Mizuki, come say hi! (｡•ᴗ•｡)"
 },
 {
  "version": "3.0.3",
  "date": "2026-11-01T23:35:11+08:00",
  "zh": "沐水 3.0.3 來囉！( ੭ ˙ᗜ˙ )੭\n這次換了新家，登入變得更簡單，電腦版也更好看了。\n\n－ 新伺服器：沐水搬到新的伺服器，登入時不用再填網址。\n－ 電腦版：上方的白條換成主題顏色。\n－ 捲動條：變成圓角框裡的細膠囊，捲動時才出現。\n\n舊帳號在搬家時沒辦法帶過來，要麻煩大家重新註冊一次，對不起！(｡•ᴗ•｡)",
  "en": "Mizuki 3.0.3 is here! ( ੭ ˙ᗜ˙ )੭\nMizuki moved to a new home, signing in is simpler, and the desktop app looks nicer.\n\n- New server: Mizuki has a new server, and you no longer type an address to sign in.\n- Desktop: The white bar at the top now matches your theme.\n- Scrollbars: A slim pill inside each rounded box that shows while you scroll.\n\nOld accounts couldn't move with us, so please sign up again — sorry about that! (｡•ᴗ•｡)"
 },
 {
  "version": "3.0.4",
  "date": "2026-11-01T23:42:17+08:00",
  "zh": "沐水 3.0.4 來囉！( ੭ ˙ᗜ˙ )੭\n這次是一個小小的調整。\n\n－ 綁定郵箱：先暫時關閉，寄信服務準備好後會再回來。\n－ 忘記密碼：在那之前，請私訊官方帳號沐水，我們會幫你處理。\n\n謝謝大家的耐心等待！(｡•ᴗ•｡)",
  "en": "Mizuki 3.0.4 is here! ( ੭ ˙ᗜ˙ )੭\nThis is a small update.\n\n- Email: Linking an email is paused for now and will be back once our mail service is ready.\n- Forgot password: Until then, message the official Mizuki account and we'll help you.\n\nThanks for your patience! (｡•ᴗ•｡)"
 },
 {
  "version": "3.0.5",
  "date": "2026-11-02T00:09:10+08:00",
  "zh": "沐水 3.0.5 來囉！( ੭ ˙ᗜ˙ )੭\n這次幫沐水換了新衣服，也把一些小地方整理得更舒服。\n\n－ 新圖標：水滴變小一點，看起來更清爽，每個主題顏色都有。\n－ 電腦版：上方細條加上沐水的圖標和名字，內容區改成圓角，看起來更柔和。\n－ 英文介面：語言、陪伴設定和跳出的小提示都會跟著換成英文。\n－ 官方帳號：聯絡人裡也看得到沐水的頭像了。\n－ 裝置權限：改成一個一個的開關，一眼就知道開了哪些。\n－ 小調整：提示音頁面更簡潔，聊天清單底部的提示不再貼著邊。\n\n喜歡新樣子的話，記得來跟沐水說說話喔！(｡•ᴗ•｡)",
  "en": "Mizuki 3.0.5 is here! ( ੭ ˙ᗜ˙ )੭\nMizuki got a fresh new look, and a few little things feel nicer now.\n\n- New icon: A smaller, cleaner drop, in every theme colour.\n- Desktop: The top bar shows Mizuki's icon and name, and the app sits in a softer rounded frame.\n- English: The language page, companionship settings and pop-up tips now switch to English too.\n- Official account: Mizuki's photo now shows in Contacts.\n- Permissions: Each one is its own on/off switch, so you can see what's on at a glance.\n- Small touches: A cleaner sounds page, and the tip at the bottom of the chat list no longer touches the edge.\n\nIf you like the new look, come say hi to Mizuki! (｡•ᴗ•｡)"
 },
 {
  "version": "3.0.6",
  "date": "2026-11-02T00:42:40+08:00",
  "zh": "沐水 3.0.6 來囉！( ੭ ˙ᗜ˙ )੭\n這次讓 AI 回得更快，聲音也更好調整。\n\n－ 立即回覆：新的 AI 第一句話不用再等很久，聊久了也不會突然變慢。\n－ 回覆方式：在「AI 的日常」選「一則一則傳」或「合成一大則」，一則一則傳時每句話都會分開送出。\n－ 試聽聲音：在「音色與語音回覆」改了聲線或說話方式，可以先按「試聽」聽聽看。\n－ 裝置權限：打開的開關不會再自己變回關閉。\n－ 電腦版：視窗四個角都是圓角，右上角按鈕也換成主題顏色。\n\n有任何想法都歡迎來跟沐水說喔！(｡•ᴗ•｡)",
  "en": "Mizuki 3.0.6 is here! ( ੭ ˙ᗜ˙ )੭\nThis update makes AI replies faster and voices easier to tune.\n\n- Instant replies: A new AI's first message no longer takes ages, and long chats don't suddenly slow down.\n- Reply style: In \"AI's day\", choose \"One by one\" or \"All in one\"; one by one sends each sentence as its own message.\n- Voice preview: In \"Voice & spoken replies\", tap Preview after changing the voice or speaking style.\n- Permissions: Switches you turned on no longer flip back off.\n- Desktop: The window has rounded corners all around, and the top-right buttons match your theme.\n\nTell Mizuki what you think anytime! (｡•ᴗ•｡)"
 }
];
