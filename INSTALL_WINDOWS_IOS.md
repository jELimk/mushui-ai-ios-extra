# Windows 安裝沐水 AI 額外版

1. 下載真正的 Mushui-AI-Extra-unsigned.ipa。這是已編譯 iPhone App 的安裝包，不是原始碼 ZIP；仍需簽章才能安裝。
2. 從 https://sideloadly.io/ 下載 Windows 版 Sideloadly，依其官網要求安裝 Apple 裝置驅動／iTunes／iCloud；不要使用非官方下載站。
3. 以 USB 接上 iPhone／iPad、解鎖並選擇信任此電腦。在 Sideloadly 選取裝置，將 IPA 拖入視窗。
4. 在自己的 Sideloadly 視窗輸入你要用於側載的 Apple 帳號，按 Start，依 Apple 提示完成登入及雙因素驗證。請不要把密碼／驗證碼傳給我，也不要寫進 GitHub。
5. 按裝置系統提示前往「設定 → 一般 → VPN 與裝置管理」信任開發者；若要求 Developer Mode，在「設定 → 隱私權與安全性 → 開發者模式」開啟並重新啟動。
6. 開啟「沐水AI」，會直接進入本機 App，不用輸入伺服器。設定 AI API 金鑰與模型，再匯入角色 JSON／TXT。
7. 免費 Apple 帳號側載簽章通常 7 天有效，需在有效期內透過 Sideloadly 自動刷新或重新簽章安裝；付費 Apple 開發者帳號條件不同，依 Apple 與工具實際結果為準。保留相同 Bundle ID 重新簽章覆蓋前先匯出 JSON 備份，不要先刪 App，刪 App 會清除本機資料。
8. 如果 Sideloadly 顯示登入／簽章／裝置限制，依工具訊息處理；這與 AI API 設定無關。沒有任何普通 IPA 可以繞過 iOS 的簽章要求。

官方來源：https://sideloadly.io/faq 、https://developer.apple.com/help/account/basics/about-your-developer-account

此為額外版，不納入主線更新。主線版本仍為 1.6.1。
