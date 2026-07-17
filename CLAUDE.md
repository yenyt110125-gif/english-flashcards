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

1. 讀使用者貼的文章，挑出**值得學的字詞**：
   - 略過極簡單的字（the, is, good…）與純專有名詞。
   - **不要硬性限制數量、寧多勿漏**。涵蓋所有值得學的字詞即可（長文可 40+ 張）。
   - **使用者是文化（人文）＋科技背景**，請特別留意並優先納入：
     - 文化／人文常用詞（如 anthropomorphism, simulacrum, make-believe, consciousness）
     - 科技／時事常用詞（如 hype, deepfake, misinformation, intellectual property）
     - **慣用語、片語動詞、搭配詞**（如 prey on, gloss over, play along, off-load, an air of …）
       —— 不要只挑單一難字，這類「常用但學習者常卡住」的表達要當成卡片收進來。
   - 儘量選文章裡實際出現的字詞；例句盡量取材／改寫自原文語境。
2. 每個字產生一張卡，欄位如下（英文為主，另外加一個 `zh` 提供繁體中文對照）：
   ```json
   {
     "word": "resilient",
     "ipa": "/rɪˈzɪliənt/",
     "pos": "adjective",
     "definition": "able to recover quickly from difficulty; tough and flexible",
     "zh": "有韌性的；能迅速從困境中恢復的",
     "sourceSentence": "Coral reefs are surprisingly resilient and can regrow after damage.",
     "examples": [
       "After the layoffs, the team proved remarkably resilient and bounced back within months.",
       "Children are often more resilient than adults give them credit for."
     ],
     "synonyms": ["tough", "hardy", "adaptable"]
   }
   ```
   - `word`：小寫原形（除非本身是專有名詞）。**也可以是片語／慣用語**
     （如 `"prey on"`、`"intellectual property"`），`pos` 標成 `phrasal verb` / `noun phrase` / `idiom`。
     app 以小寫 `word` 當進度 key，所以同一個字在不同文章會共用學習進度、認得後自動不再出現。
   - `ipa`：IPA 音標，前後加斜線。
   - `pos`：詞性（noun / verb / adjective / adverb…）。
   - `definition`：簡明英英解釋，用學習者能懂的字。
   - `zh`：簡短的繁體中文翻譯／解釋（一行，幾個詞或一句話即可，顯示在英文解釋下方）。
   - `sourceSentence`：**文章原文裡實際包含這個字的那一句，逐字照抄（verbatim）**。
     若該字在原文以變化形出現（如 preying／glossed over），照抄原文那句即可。
   - `examples`：**額外自己寫的 2 個例句**（自然、貼近該字用法，不要和原文句重複）。陣列，長度 2。
   - `synonyms`：2–4 個同義字陣列（可留空陣列 `[]`）。
   - （舊版單一 `example` 欄位仍可讀，但新卡請一律用 `sourceSentence` + `examples`。）

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
