<!--
更新時間：2026-04-17 10:54
作者：CDS Service
摘要：補充 Windows credential.helper（manager-core 錯誤 vs manager）實務摘要與 Q11–Q14

更新時間：2026-04-17 10:42
作者：CDS Service
摘要：補充 git stash（暫存抽屜）比喻、常用指令與 Q&A，與 fetch／pull 一併對齊遠端前查閱

更新時間：2026-04-17 10:33
作者：CDS Service
摘要：以生活化比喻說明 git fetch / pull / 遠端追蹤分支，並附結論式 Q&A 供日常對齊遠端時查閱
-->

# Git：`fetch` 與 `pull` 簡明說明與 Q&A

## 一、用「抄作業」來理解

想像 **GitHub 上的 repo 是老師桌上的標準答案**，你電腦裡的專案是 **你的作業本**。

| 指令或名詞 | 比喻 | 實際效果（重點） |
|------------|------|------------------|
| `git fetch origin` | 你去老師那 **看一眼** 最新答案，並 **抄一份「參考副本」** 放在旁邊（不動你正在寫的那一頁） | 更新本機的 **`origin/分支名`**（遠端追蹤分支），**不會**自動改你目前 checkout 的那條本機分支，也 **不會**改工作目錄檔案 |
| `git pull` | 你看完標準答案後，**把差異合進你正在寫的那一頁** | 通常是 **fetch + merge**（或依設定為 rebase），**會**動到你目前分支的 commit 與（若有合併）工作目錄 |
| 本機分支 `cpg_2cql` | 你作業本上「這一章」的 **書籤位置** | 只有你執行 merge / rebase / reset / checkout 等，書籤才會跟著動 |
| `origin/cpg_2cql` | 老師桌上那一章的 **影印參考頁**（本機快取的遠端快照） | `fetch` 後這份會變新；**不等於**你已經把本機 `cpg_2cql` 對齊過去 |
| `git stash`（含 `push` / `pop`） | 把桌上改到一半的紙 **先收進抽屜貼標籤**，桌面清空好做事 | 把 **尚未 commit** 的變更暫存起來，工作目錄可變乾淨；之後再 **取回** 繼續改 |

**一句話結論**：`git fetch origin` **不是**「把本機分支 `cpg_2cql` 自動更新到最新」；它只是 **把遠端資訊取回本機的 `origin/...` 參考線**，你還要再決定要不要 **merge / pull / rebase** 才會動到你正在用的分支。

---

## 二、小例子（對照你問過的情境）

假設你現在本機在分支 `cpg_2cql`，遠端也有人推了新 commit 到 `origin/cpg_2cql`。

1. 執行 `git fetch origin`  
   - `origin/cpg_2cql` 會指向遠端最新 commit。  
   - 你的本機 `cpg_2cql` **可能還停在舊位置**（沒變）。

2. 若你要本機 `cpg_2cql` **真的**跟上遠端：  
   - 先確保工作目錄乾淨或已 stash，再在 `cpg_2cql` 上：  
     - `git merge origin/cpg_2cql`  
   - 或一次做完：  
     - `git pull origin cpg_2cql`  
   （實際行為依 repo 的 merge / rebase 設定可能略有不同，但概念都是「把遠端變更套進目前分支」。）

---

## 三、`git stash`：暫存抽屜（還沒想 commit，但要先 pull／切分支）

### 什麼時候用

- 你已改了一些檔案（**還不想 commit**），但現在要做 **`git pull`**、**`git merge`** 或 **`git checkout` 到別條分支**，Git 嫌你桌面太亂不讓你做。  
- 這時可以把「未提交的修改」先 **stash 起來**，工作目錄暫時乾淨，做完 pull／切分支後再 **拿回來**。

### 常用指令（記概念即可）

| 指令 | 做什麼（白話） |
|------|----------------|
| `git stash push -m "說明"` | 把目前變更收進抽屜，並貼一張備忘標籤 |
| `git stash list` | 看抽屜裡有幾疊暫存 |
| `git stash pop` | 拿出 **最上面那一疊** 套回工作目錄，並從 stash 清單移除（若有衝突要手動解） |
| `git stash apply` | 像 `pop` 一樣套回，但 **保留** stash 清單那一筆（想重複套用時用） |
| `git stash drop` | 刪掉某一筆 stash（不再需要的暫存） |

### 小例子

1. 你改了 `dev_readme.md`，還沒 commit，但現在想 `git checkout master` 再 `git pull`。  
2. `git stash push -m "wip: dev_readme"`  
3. 切分支、`pull` 完成後：`git stash pop`  
4. 若 pop 時有衝突：照平常合併衝突方式解完再繼續。

**注意**：`stash` 預設處理的是 **已追蹤檔案的修改**；**全新未追蹤的檔案／資料夾** 若要一起收進抽屜，需使用 **`git stash push -u`**（或 `--include-untracked`），否則那些檔案仍會留在工作目錄。

---

## 四、PR 已合併進 `master` 時，常見「我要最新版」怎麼做

目標是：**本機 `master` = 遠端 `origin/master`（已含合併結果）**。

典型步驟概念：

1. `git fetch origin`  
2. `git checkout master`  
3. `git pull origin master`  

之後若要開新功能，再從更新後的 `master` 開新分支即可。

---

## 五、結論式 Q&A（存檔用速查）

**Q1：`git fetch origin` 會不會自動更新我本機的 `cpg_2cql`？**  
**A：** 不會。它主要更新 **`origin/...`** 這類遠端追蹤參考；本機分支要自己 **merge / pull / rebase** 才會前進。

**Q2：那 `git pull` 呢？**  
**A：** 會試著把 **目前分支** 與對應的遠端分支 **合併**（或 rebase），所以 **會改動** 你所在分支的歷史位置與工作目錄（若有衝突要手動解）。

**Q3：`origin/cpg_2cql` 和 `cpg_2cql` 差在哪？**  
**A：** `origin/cpg_2cql` 是「本機記錄的遠端快照」；`cpg_2cql` 是「你正在開發的本機分支」。兩者可以不同步。

**Q4：我有未提交修改（例如改了 `dev_readme.md`、新增資料夾），可以先 `pull` 嗎？**  
**A：** 可能被擋下來或合併時很痛。建議先 **commit**、**stash**，或先處理掉再拉遠端。

**Q5：PR 已 merge 到遠端 `master`，我還需要 `cpg_2cql` 嗎？**  
**A：** 看你是否還要在同一條線上繼續開發。若只要跟主線走，通常 **更新 `master` 再開新分支** 最乾淨；舊分支可保留或刪除（本機／遠端刪除是不同操作）。

**Q6：一句話記 `fetch` vs `pull`？**  
**A：** **`fetch` 只下載對照表；`pull` 下載並試著合進你現在這條分支。**

**Q7：`git stash` 會不會幫我建立一個 commit？**  
**A：** 不會。它只是暫存工作區變更，**不會**自動寫進分支歷史；要進歷史還是要自己 **`git commit`**。

**Q8：`stash` 和「先 commit 再 pull」差在哪？**  
**A：** **commit** 會留下正式版本紀錄；**stash** 是「暫收草稿」不留版本點。想保留可追蹤敘述用 commit；只是暫時讓路給 pull 用 stash 很常見。

**Q9：我有未追蹤的新資料夾，`git stash` 預設會收進去嗎？**  
**A：** **預設不會**。要加 **`-u`**（`git stash push -u -m "..."`）才會把未追蹤一併暫存。

**Q10：`git stash pop` 失敗怎麼辦？**  
**A：** 多半是與目前檔案內容衝突；解完衝突後，若 stash 仍卡在清單裡，可用 `git stash list` 確認，必要時用官方文件查 `stash` 進階用法，避免硬刪到還沒備份的變更。

**Q11：出現 `git: 'credential-manager-core' is not a git command` 是什麼意思？**  
**A：** 代表 **`credential.helper`** 被設成 **`manager-core`**（或會導向舊名 **`git-credential-manager-core`** 的值），但系統上 **找不到對應可執行檔**。Git for Windows 目前通常內建的是 **`git-credential-manager.exe`**，名稱已對齊 **`manager`** 這類 helper，而不是 `manager-core`。

**Q12：在 Windows 上常見的正確修法？**  
**A：** 執行 **`git config --global credential.helper manager`**，再以 **`git config --global --get credential.helper`** 確認輸出為 **`manager`**（單字，**沒有** `-core` 後綴）。完成後再 **`git fetch origin`**，不應再出現上一題的錯誤訊息。

**Q13：修正後執行 `git fetch origin` 完全沒輸出，代表失敗嗎？**  
**A：** **通常代表成功**。常見情況是：已能正常連上遠端，且 **沒有新的 commit／物件要下載**（本機 `origin/*` 快照已與遠端一致）。若遠端有更新，仍可能看到 `Unpacking objects...` 等進度列。

**Q14：`git fetch` 成功時，終端機裡 `686bb7a..347a8c3  cpg_2cql -> origin/cpg_2cql` 這類行在做什麼？**  
**A：** 表示 **遠端追蹤分支** `origin/cpg_2cql` 的 **tip commit** 從舊的 `686bb7a` **前進到** 新的 `347a8c3`；**本機分支** `cpg_2cql` 若沒再執行 `merge`／`pull`，**不一定**自動跟著動。

---

## 六、實務摘要（Windows 認證與 `git fetch` 輸出對照）

以下對照你實際操作過的狀況，方便之後一眼對上：

1. **`credential.helper` 為 `manager-core` 時**  
   - `git fetch` 可能出現 **`credential-manager-core` is not a git command**。  
   - 根因是 helper 名稱與實際安裝的 **Git Credential Manager** 可執行檔 **不一致**。

2. **改為 `git config --global credential.helper manager` 後**  
   - `git config --global --get credential.helper` 應顯示 **`manager`**。  
   - 再執行 `git fetch origin` 應 **不再**出現上述錯誤。

3. **`fetch` 安靜結束**  
   - 多數情況是 **已更新遠端追蹤分支** 或 **沒有新物件**；若要確認本機分支是否已對齊，需再看 **`git status -sb`** 或 **`git log`** 與 **`origin/...`** 的關係（見前文「fetch 不會自動動本機分支」）。

---

## 七、延伸閱讀（官方概念）

- [Git 文件：git fetch](https://git-scm.com/docs/git-fetch)  
- [Git 文件：git pull](https://git-scm.com/docs/git-pull)  
- [Git 文件：git stash](https://git-scm.com/docs/git-stash)  
- [Git Credential Manager 說明](https://github.com/git-ecosystem/git-credential-manager)（安裝與 helper 對應名稱）
