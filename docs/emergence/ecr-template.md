<!--
更新時間：2026-04-20 11:38
作者：CDS Service
摘要：關聯文件區：高階設計連結說明精簡；詳細設計改註明本 repo 現況

更新時間：2026-04-20 11:26
作者：CDS Service
摘要：新增急診雙服務（TS→CQL／ELM）變更請求複製用範本；欄位與章節指引
-->

# 工程變更請求（ECR）範本

**用途**：複製本檔內容另存為 `ecr-YYYYMMDD-編號.md`（或院內規定檔名），填寫後送核。正式核准與設計文件更新後，始得依核准範圍修改程式／CQL／ELM。

**關聯文件**：

- 急診兩服務規則與 CQL 對齊摘要：[`infection_control_warning_rules.md`](./infection_control_warning_rules.md)
- 高階設計（自本檔所在 `docs/emergence/` 向上兩層至 repo 根）：[`../../hi_level_design.md`](../../hi_level_design.md)
- 詳細設計：本 **CDS Service** repo 根目錄目前**未**含 `detailed_design*.md`；若院內或他 repo 有詳設，請於送核 ECR 內補上**可開啟之路徑或附件**（例如 `detailed_design_claude.md` 之實際位置）。

---

## 1. 變更編號與標題

| 欄位 | 填寫 |
|------|------|
| ECR 編號 | （例：ECR-2026-EMG-001） |
| 標題 | （簡述，例：急診 72hr-revisit／infection-control-warning 導入 CQL／ELM） |
| 建立日期 | YYYY-MM-DD |
| 最後修訂 | YYYY-MM-DD |

---

## 2. 變更類型（可複選）

- [ ] 臨床／規則行為變更
- [ ] API／資料契約（Discovery、prefetch、cards 形狀）
- [ ] 營運／部署（環境變數、feature flag）
- [ ] 僅文件（若僅文件，仍建議輕量 ECR 以利追溯）

---

## 3. 影響範圍與服務清單

| 服務 id | 端點（相對） | 是否納入本 ECR |
|---------|----------------|----------------|
| `72hr-revisit` | `POST /cds-services/72hr-revisit` | |
| `infection-control-warning` | `POST /cds-services/infection-control-warning` | |

**非目標（明列勿動）**：  
（例：主 CDS `egfr-check`／`ckd-risk`、僅列於此外之檔案路徑…）

---

## 4. 背景與問題陳述

- **現況**：（例：兩服務均以 TypeScript 評估；尚無專屬 `cql`／`elm`…）
- **問題／驅動**：（例：院內要求 CQL 為 SSOT、可審計、與 PDF／HIR 對齊…）
- **不處理之範圍**：（本次明確排除項目）

---

## 5. 建議方案與 SSOT

| 項目 | 決策（擇一或自訂） |
|------|-------------------|
| 規則 SSOT | CQL 為主／TS 僅 fallback／其他：___ |
| ELM 執行開關 | 延伸 `USE_ELM`／獨立 `USE_ELM_EMERGENCY`／其他：___ |
| ELM 失敗時 | 與 CKD 服務一致：`TS_FALLBACK`（或註明差異） |

**技術摘要**（核准後實作清單，可勾選）：

- [ ] 新增 `cql/…`（檔名與路徑：___）
- [ ] 編譯 `elm/…`（流程見 `docs/cql_elm.md`）
- [ ] Executor（參考 `src/cql/egfrElmExecutor.ts` 等）
- [ ] Handler 分支與測試（case-08／case-09／case-09-1）

---

## 6. 與院內 PDF／HIR／現行程式對照

| 規則來源（PDF／HIR 條目） | 現行 TS 行為摘要 | 核准後 CQL／行為 |
|---------------------------|------------------|------------------|
| | | |
| | | |

**差異與風險**：（臨床語意、`Now` 與時間窗、Flag 過濾等）

---

## 7. 環境變數與功能旗標

| 變數 | 預設 | 本 ECR 是否變更 | 說明 |
|------|------|-----------------|------|
| `EMERGENCY_REVISIT_WINDOW_HOURS` | 72 | | |
| `EMERGENCY_REVISIT_MIN_ENCOUNTERS` | 2 | | |
| `EMERGENCY_ENCOUNTER_CLASS_CODES` | （空＝不過濾） | | |
| `EMERGENCY_INFECT_CTRL_SKIP_FLAGS` | false | | |
| `USE_ELM` 或（自訂）___ | | | |

---

## 8. FHIR 資源與 Prefetch

**是否變更 Discovery prefetch**：[ ] 否 [ ] 是（請附新舊對照表）

**資源與查詢注意**：（例：HAPI 對 `Flag?status=` 之限制—見規則文件）

---

## 9. 測試計畫與驗收

| 測試資料／案例 | 預期結果 |
|----------------|----------|
| case-08（72hr） | |
| case-09／case-09-1（感控） | |
| `USE_ELM` false 迴歸 | 與變更前 TS 行為一致 |
| `USE_ELM` true（若適用） | ELM 輸出與 TS parity；失敗可 fallback |

---

## 10. 部署、監控與回滾

- **部署步驟**：（elm 入庫、環境變數、重啟服務…）
- **回滾**：關閉 ELM 旗標／還原前版映像或設定／還原檔案清單：___
- **監控或日誌**：（是否需額外 log）

---

## 11. 附件清單

- [ ] 填寫完畢之本 ECR 本文
- [ ] 設計文件 diff 或版次連結
- [ ] 測試執行紀錄（截圖／Postman／指令輸出）

---

## 12. 核准

| 角色 | 姓名 | 簽名／日期 | 備註 |
|------|------|------------|------|
| 申請人 | | | |
| 技術審查 | | | |
| 臨床／資訊（依院內流程） | | | |

**核准後聲明**：本人確認本 ECR 與已更新之 `hi_level_design`／`detailed_design` 一致，核准範圍內之實作得進行。
