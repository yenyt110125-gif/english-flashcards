# CLAUDE.md — 產卡指南（給未來的 Claude session 讀）

這是一個部署在 GitHub Pages 的英文單字卡網頁。使用者會**貼一篇英文文章**給你，
你的工作是把它整理成一副字卡（deck），存成 JSON、更新索引、commit 並 push。
手機端會自動載入新字卡。

## ⛔ 最重要的規則：append-only，絕不覆蓋

- **每篇文章 = 一個新的 `decks/<slug>.json` 檔**。檔名務必唯一（用日期＋主題）。
- **`decks/index.json` 只能「追加」一筆**到 `decks` 陣列。
  **絕不可刪除、覆蓋、或重排既有項目** —— 那會讓使用者失去舊文章。
- 不要修改使用者的學習進度（那存在他手機的 localStorage，不在 repo 裡，你也碰不到）。

## 產卡步驟

1. 讀使用者貼的文章，挑出**值得學的單字**：
   - 略過極簡單的字（the, is, good…）與純專有名詞。
   - 以中高階、對學習者有價值的字為主。**每篇約 15–25 個**（可依文章長度調整）。
   - 儘量選文章裡實際出現的字；例句盡量取材／改寫自原文語境。
2. 每個字產生一張卡，欄位如下（**全英文**，不要中文）：
   ```json
   {
     "word": "resilient",
     "ipa": "/rɪˈzɪliənt/",
     "pos": "adjective",
     "definition": "able to recover quickly from difficulty; tough and flexible",
     "example": "Coral reefs are surprisingly resilient and can regrow after damage.",
     "synonyms": ["tough", "hardy", "adaptable"]
   }
   ```
   - `word`：小寫原形（除非本身是專有名詞）。app 以小寫 `word` 當進度 key，
     所以同一個字在不同文章會共用學習進度、認得後自動不再出現。
   - `ipa`：IPA 音標，前後加斜線。
   - `pos`：詞性（noun / verb / adjective / adverb…）。
   - `definition`：簡明英英解釋，用學習者能懂的字。
   - `example`：一句自然的英文例句（優先呼應原文情境）。
   - `synonyms`：2–4 個同義字陣列（可留空陣列 `[]`）。

3. 建立 deck 檔 `decks/<slug>.json`（`slug` 建議 `YYYY-MM-DD-主題`）：
   ```json
   {
     "id": "2026-07-15-space-travel",
     "title": "The Future of Space Travel",
     "source": "文章網址或來源備註（選填）",
     "createdAt": "2026-07-15",
     "cards": [ /* 上述卡片們 */ ]
   }
   ```
   - `id` 必須全域唯一，通常等於 slug。

4. **追加**一筆到 `decks/index.json` 的 `decks` 陣列（保留既有全部項目）：
   ```json
   { "id": "2026-07-15-space-travel", "title": "The Future of Space Travel",
     "file": "2026-07-15-space-travel.json", "count": 18, "createdAt": "2026-07-15" }
   ```
   - `count` = 這副卡的張數。

5. Commit 並 push：
   ```
   git add decks/
   git commit -m "Add deck: The Future of Space Travel"
   git push
   ```

6. 告訴使用者：在手機上重新整理網頁（或下拉刷新）即可看到新字卡；
   若裝了 PWA，重開 app 就會抓到。

## JSON 注意事項
- 一律 UTF-8、有效 JSON（IPA 的特殊字元直接寫沒問題）。
- 產生後可用 `node -e "JSON.parse(require('fs').readFileSync('decks/<file>','utf8'))"`
  或等效方式驗證 JSON 合法。

## 架構速記（改動前先讀）
- 純靜態網站，無 build step。`index.html` 依序載入 `js/srs.js` → `js/swipe.js` → `js/app.js`。
- 進度：`js/srs.js`，localStorage key = `srs:v1:<小寫單字>`，簡化 SM-2。
- 發音：瀏覽器 `SpeechSynthesis`，無音檔。
- 離線：`sw.js`（deck 用 network-first，改 shell 檔時記得把 `CACHE` 版本號 +1）。
