# 單字卡 · English Flashcards

把一篇英文文章交給 Claude → 自動整理成單字卡 → 在手機上左右滑動複習。
認得的字逐漸剃除，只留下陌生的字用**間隔複習（SRS）**反覆練習。純靜態網頁、免費、可離線。

- **右滑** = 認得　**左滑** = 陌生　**點卡片** = 翻面看解釋　🔊 = 發音
- 認得的字間隔越拉越長，最後「畢業」不再出現；陌生的字更常回來。
- 全英文卡片：英英解釋 + 例句 + IPA 音標 + 發音。

## 怎麼餵文章（新增字卡）

在電腦上用 Claude Code，把文章貼給 Claude 說「把這篇整理成字卡」。
Claude 會依 [`CLAUDE.md`](./CLAUDE.md) 產生 `decks/<日期-主題>.json`、追加到 `decks/index.json`、
commit 並 push。手機重新整理網頁就會看到新卡。（舊文章與你的學習進度都不會被動到。）

## 本機預覽

```bash
# 需透過 http 伺服器開啟（不能直接用 file:// 開，fetch 會被擋）
python -m http.server 8000
# 然後開 http://localhost:8000
```

桌機測試快捷鍵：`→` 認得、`←` 陌生、`空白鍵` 翻面。

## 部署到 GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
# 建 GitHub repo 後：
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo>.git
git push -u origin main
```

然後到 GitHub → repo **Settings → Pages → Source** 選 `main` 分支、`/ (root)`，儲存。
幾分鐘後網址 `https://<你的帳號>.github.io/<repo>/` 上線，用手機打開 → 「加到主畫面」即可像 App 使用。

## 學習進度存哪 / 備份

- 進度（哪些字認得/陌生、複習排程）**存在你手機瀏覽器的 localStorage**，離線、每台裝置各自記錄。
- **不會**因為 push 新文章而遺失；但**換手機或清除瀏覽器資料會不見**。
- 到 **設定 ⚙️ → 匯出進度** 可存成 JSON 備份，換裝置時用「匯入進度」還原。
- 目前不自動跨裝置同步（零後端的取捨）。

## 檔案結構

```
index.html            入口
css/style.css         手機優先樣式
js/srs.js             SM-2 間隔複習 + localStorage + 匯出/匯入
js/swipe.js           手勢滑動
js/app.js             主流程與 UI
decks/index.json      deck 索引（append-only）
decks/*.json          每篇文章一副字卡
manifest.webmanifest  PWA
sw.js                 離線快取
CLAUDE.md             給 Claude 的產卡規則
```
