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
 }
];
