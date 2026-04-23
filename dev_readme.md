<!--
更新時間：2026-04-22 17:50
作者：CDS Service
摘要：PR #3 follow-up review 修正（Issue 1 精確計數 + .env.example HTML comment）：
      1. CQL 新增四個精確計數 define：TbActiveDiagnosisCount / TbLatentDiagnosisCount /
         TbContactCount / TbInfectionFlagCount，各自對應布林 define 的 where 條件；
         Maven 重編 ELM — BUILD SUCCESS。
      2. EmergencyTbDetectionElmResult 介面新增四欄位；executor return 對應讀取。
      3. tbDetectionHookHandler.ts ELM reasons 全改用精確計數欄位，
         消除 TbDiagnosisCount 膨脹以及 TS-side count 在 ELM mode 下為 0 的語意矛盾。
      4. .env.example 頂部 <!-- --> HTML 區塊改為 # 格式（dotenv 標準）。
      TS build 綠燈；lint 0 錯誤；case-14~28 驗收 15/15 PASS。

更新時間：2026-04-22 17:37
作者：CDS Service
摘要：PR #3 Copilot review 全數修正（Issue 1～8）：
      1. ELM reasons 計數改用 elmSummary.tbDiagnosisCount / tbFirstLineMedCount / tbSecondLineMedCount。
      2. flattenCodings 遞迴改為已知 CodeableConcept 路徑一層深度（停止走訪 contained/extension/meta）。
      3. CdsHooksPrefetch 介面新增 observations/conditions/flags 等常用鍵，移除 unsafe cast。
      4. fhirClient.ts export createFhirInstance，tbFhirClient.ts 改為 import，消除重複工廠。
      5. tbValueSetLoader.ts 改讀 TB_VALUESET_BASE_URL env var，.env.example 補此項目。
      6. Issue 6 方案B：Emergency_TB_Detection.cql 移除 LatestSafetyLabs define，Maven 重編 ELM（BUILD SUCCESS）。
      7. countSignals 呼叫前加 inline comment 說明 ELM mode 下 TS 計數語意。
      8. App.tsx patientOptions 補入 patient-tb-001~015 系列。
      TS build 綠燈；lint 0 錯誤；case-14~28 驗收 15/15 PASS（USE_ELM=true）。

更新時間：2026-04-22 13:24
作者：CDS Service
摘要：TB Detection 完整測試計畫（test-plan.md）建立並全數通過（case-14～28，15/15 PASS，USE_ELM=true）。
      新增 case-19～28 FHIR bundle 與 CDS 請求 payload；發現並修正三個邊界情境失敗根因：
      (1) buildTbDetectionCards ELM 路徑改由 elmSummary 布林決定 indicator（全 ELM 化收尾）；
      (2) tbFhirClient 新增 searchAllConditionsForPatient（不過濾 active），handler ELM 路徑改用此函式，
          讓 ELM 自行評估 2yr resolved window（case-20：Resolved TB 近2年應觸發）；
      (3) case-25 FHIR bundle 換用 Ethambutol A002076100（Rifampin 單方 A048017100 不在 ValueSet）；
      TS build 綠燈；lint 0 錯誤；既有兩服務（infection-control-warning / 72hr-revisit）回歸通過。
      docs/tb-detection/test-plan.md 同步更新執行結果表與缺陷修正說明。

更新時間：2026-04-22 11:04
作者：CDS Service
摘要：TB Detection Phase 3.3（ELM 化 LatestSafetyLabs）＋ Phase 4（前端 tbDetection hook builder）完成並驗收。(1) `cql/Emergency_TB_Detection.cql` 新增 `define "TbLabObservationCount": Count([Observation: "TB-Lab-Monitoring"])`；Maven 重編 `elm/Emergency_TB_Detection.json` 成功。(2) `src/cql/emergencyTbDetectionElmExecutor.ts`：`EmergencyTbDetectionElmInput` 加 `observations?`、`buildBundle` 將 observations 塞入 Bundle、回傳結構加 `tbLabObservationCount`。(3) `src/emergency/handlers/tbDetectionHookHandler.ts`：ELM 分支傳入 observations、rule-engine extension 附加 `elm_lab_obs_count=N`；per-code 展示層維持不動（同一 ValueSet 快取由 TS 組裝 ALT/Cr/CBC/AST/T-Bil 最新值）。(4) 驗收：USE_ELM=true 下 case-14 → `elm_lab_obs_count=3`（ALT+Cr+CBC）、case-15/16/17/18 → `elm_lab_obs_count=0`；engine 皆 ELM；布林與 TS 100% 一致。(5) 前端：新增 `frontend/src/cds/hookBuilders/tbDetection.tsx`（patient-view 測試病患快選 chips：patient-tb-001 Active+FirstLine／002 2nd-line 無 Dx／016 LTBI／017 Flag only／018 Contact）；`hookBuilders/index.ts` 匯出；App.tsx `supportsPrefetchFromFhir` 納入 tb-detection，新增 Prefetch from FHIR 分支（Patient/Condition/MedicationRequest/MedicationStatement/Flag/Observation 皆以前端 FHIR 取回組 searchset Bundle 送到 CDS）；tooltip 文案延伸；`fhirSearch` 擴充 `MedicationRequest` 以支援前端 prefetch 組裝；frontend vite build 綠燈。(6) 測試後端對新 prefetch 形狀接受正常（/cds-services/tb-detection 回應 1 張卡片）。同步更新本檔系統時間戳（`echo %date% %time%` → 2026-04-22 11:04）。

更新時間：2026-04-22 10:41
作者：CDS Service
摘要：TB Detection Phase 3.1 + 3.2 完成並驗收。(1) 新增三筆測資 `input/tests/fhir/case-16-tb-detection-ltbi.bundle.json`（R76.1 + INH）、`case-17-tb-detection-flag-only.bundle.json`（作用中 Flag 含有意義代碼）、`case-18-tb-detection-contact.bundle.json`（Z20.1）；於 `USE_ELM=true` 全數 engine=ELM 通過，ELM 布林與 TS 計數 100% 一致。(2) 新增 `case-14b-tb-detection-safety-labs.bundle.json`（3 筆 Observation：ALT 09026C 38 U/L / Creatinine 09015C 1.02 mg/dL / CBC 08011C 含 component）。(3) `src/emergency/emergencyServiceDefinitions.ts` 僅對 `emergencyTbDetectionService.prefetch` append `observations`，不動其他服務。(4) `src/emergency/handlers/tbDetectionHookHandler.ts` 新增 `buildLatestSafetyLabs()`／`formatSafetyLabsForDetail()`／`pickObservationEffective()`／`formatObservationValue()`（以 `TB-Lab-Monitoring` ValueSet 過濾，依命中 system|code 分組取最新 effective，支援 valueQuantity／valueString／component CBC）；ELM／TS／TS_FALLBACK 三路徑均 append 到卡片 detail。(5) 實測 case-14 detail 正確顯示 ALT/Cr/CBC 各筆最新時間與值；case-15/16/17/18 無 Observation → 無多餘 append；回歸 72hr-revisit／infection-control-warning 通過；TS build 綠燈、0 lint；同步更新本檔系統時間戳

更新時間：2026-04-22 10:07
作者：CDS Service
摘要：TB Detection Phase 2（ELM 化）完成並驗收。(1) CQL 修正：`Condition.clinicalStatus` 改用 `codesystem "ConditionClinical" + code "Clinical-Active"/"Clinical-Resolved"` 以 `~` 比對（原 `~ 'active'` 不合法）、`coding.code.value` 改 `exists (coding CC where ...)` 避免 list demotion、`abatementDateTime` 改 `abatement as FHIR.dateTime`、`include FHIRHelpers` 對齊 4.1.0；(2) Maven cql-to-elm-cli 成功產出 `elm/Emergency_TB_Detection.json`（73979 bytes）；(3) 新增 `src/cql/emergencyTbDetectionElmExecutor.ts`（以 `tbValueSetLoader` cache 建 `cql.CodeService` canonical URL→concept list、`PatientSource.FHIRv401`）；(4) 擴充 `TbValueSetEntry.rawConcepts`（保留原始字面值給 CodeService）；(5) `tbDetectionHookHandler.ts` 加 `USE_ELM` 分支 + `TS_FALLBACK` 與 ELM 布林摘要 extension；(6) 驗收：`USE_ELM=true` 下 case-14 → engine=ELM/warning、case-15 → engine=ELM/info；回歸 `72hr-revisit`、`infection-control-warning` 亦 engine=ELM；ELM 與 TS 信號 100% 一致；TS build 綠燈、0 lint；同步更新本檔系統時間戳

更新時間：2026-04-22 09:27
作者：CDS Service
摘要：新增急診第三支 CDS 服務 `tb-detection`（port 3001）；新增 `cql/Emergency_TB_Detection.cql`（canonical URL valueset 對齊本次匯入之 4 份 FHIR ValueSet：tb-diagnoses／tb-meds-firstline／tb-meds-secondline／tb-lab-monitoring）；新增 `src/fhir/tbFhirClient.ts`、`src/cql/tbValueSetLoader.ts`、`src/emergency/handlers/tbDetectionHookHandler.ts`；`src/emergency/emergencyServiceDefinitions.ts`、`src/emergency/routes.ts` 僅做 append 註冊（不動既有邏輯）；新增 `docs/tb-detection/plan.md`、`input/tests/fhir/case-14-tb-detection-positive-firstline.bundle.json`、`case-15-tb-detection-secondline-without-dx.bundle.json`；TS build 綠燈；實測 case-14 觸發 warning（active_tb_dx=1; first_line_meds=1）、case-15 info（second_line_meds=1 無 TB 診斷不觸發）；既有 72hr-revisit／infection-control-warning 行為回歸通過；同步更新本檔系統時間戳

更新時間：2026-04-21 17:58
作者：CDS Service
摘要：新增 FHIR ValueSet 測資 `input/tests/fhir/case-13-valueset-tb-meds-secondline.json`；並以 curl Method A（PUT /ValueSet/{id}）匯入 `hosp-tb-meds-secondline` 驗證成功；同步更新本檔系統時間戳

更新時間：2026-04-21 17:29
作者：CDS Service
摘要：新增 FHIR ValueSet 測資 `input/tests/fhir/case-11-valueset-tb-meds-firstline.json`、`input/tests/fhir/case-12-valueset-tb-lab-monitoring.json`；並以 curl Method A（PUT /ValueSet/{id}）匯入 `hosp-tb-meds-firstline`、`hosp-tb-lab-monitoring` 驗證成功；同步更新本檔系統時間戳

更新時間：2026-04-21 09:12
作者：CDS Service
摘要：新增 QA 文件 `docs/qa/fe_extract_hook_builders_qa.md`（hookBuilders 詳細說明與驗收）；`docs/qa/README.md` 相關文件索引補連結；`docs/qa/ui_operation_qa.md` 第 7 節補連結；同步更新本檔系統時間戳

更新時間：2026-04-21 08:58
作者：CDS Service
摘要：`docs/frontend/cds-service_ui.md`：`fe-extract-hook-builders` 對齊 completed；Chrome headless 截圖驗證前端可經 Discovery 呼叫主 CDS（port 3000）並顯示回傳卡片；截圖：`docs/qa/cds-hook-ui-chrome.png`；同步更新本檔系統時間戳

更新時間：2026-04-20 17:58
作者：CDS Service
摘要：前端 mixed hooks builder：補強 TT 型別／App tooltip 安全存取以避免型別快取誤判；frontend build 驗證通過；同步更新本檔系統時間戳

更新時間：2026-04-20 17:55
作者：CDS Service
摘要：前端 mixed hooks 表單化 builder：observation-create / order-select（取代 App.tsx 通用 Context JSON 最小輸入）；同步更新本檔系統時間戳

更新時間：2026-04-20 15:41
作者：CDS Service
摘要：前端 CDS Hook 測試台支援急診 CDS（port 3001）與 Discovery 動態服務清單；新增 emergency proxy env；同步更新本檔系統時間戳

更新時間：2026-04-20 13:58
作者：CDS Service
摘要：急診雙服務 CQL／ELM 與 USE_ELM 共用；急診節與 USE_ELM 表列補充；同步更新本檔系統時間戳

更新時間：2026-04-20 11:38
作者：CDS Service
摘要：急診規則／ECR 範本文件覆核後微修（72hr id 去重、TS_FALLBACK 錨點、詳設註記）；同步更新本檔系統時間戳

更新時間：2026-04-20 11:26
作者：CDS Service
摘要：急診規則文件擴充為雙服務＋docs/emergence/ecr-template.md；FHIR 驗證章節補 ECR 範本連結；同步更新本檔系統時間戳

更新時間：2026-04-20 10:25
作者：CDS Service
摘要：FHIR case-9.1（patient-ckd-002 HIR）、infection handler 擴充 B20–B24／J05* ARV；同步更新本檔系統時間戳

更新時間：2026-04-20 10:12
作者：CDS Service
摘要：FHIR case-09（infection-control-warning 測資）與 docs/emergence/infection_control_warning_rules.md；FHIR 驗證章節補連結；同步更新本檔系統時間戳

更新時間：2026-04-20 10:07
作者：CDS Service
摘要：HAPI Flag 不支援 search param `status`：fhirClient／discovery prefetch／infection handler 改為 client 端過濾 active；同步更新本檔系統時間戳

更新時間：2026-04-20 09:52
作者：CDS Service
摘要：FHIR case-08（急診 72hr-revisit、patient-ckd-001 兩筆 Encounter）bundle＋README；FHIR Client 驗證章節補匯入連結；同步更新本檔系統時間戳

更新時間：2026-04-17 12:02
作者：CDS Service
摘要：新增 Postman 急診專用 collection（CDS-Service-Emergency.postman_collection.json）；Postman 章節補匯入說明；同步更新本檔系統時間戳

更新時間：2026-04-17 11:58
作者：CDS Service
摘要：急診獨立 CDS（第二程序 port 3001）：npm scripts、環境變數、Postman TC-EMERGENCY、FHIR Client Encounter/Flag/MedicationStatement；同步更新本檔系統時間戳

更新時間：2026-04-17 11:34
作者：CDS Service
摘要：.gitignore 新增 docs/git/；已執行 git rm --cached 停止追蹤該資料夾（檔案仍保留本機）；同步更新本檔系統時間戳

更新時間：2026-04-17 11:30
作者：CDS Service
摘要：docs/git/fetch與pull簡明說明與QA.md 補充 merge 衝突／MERGE_HEAD 實例與 Q15–Q18；同步更新本檔系統時間戳

更新時間：2026-04-17 10:54
作者：CDS Service
摘要：docs/git/fetch與pull簡明說明與QA.md 補充 credential.helper（manager）實務摘要與 Q11–Q14；同步更新本檔系統時間戳

更新時間：2026-04-17 10:42
作者：CDS Service
摘要：docs/git/fetch與pull簡明說明與QA.md 補充 git stash 段落與 Q&A；同步更新本檔系統時間戳

更新時間：2026-04-17 10:33
作者：CDS Service
摘要：新增 docs/git/fetch與pull簡明說明與QA.md（fetch／pull 生活化比喻與結論式 Q&A）；同步更新本檔系統時間戳

更新時間：2026-04-17 10:14
作者：CDS Service
摘要：新增 docs/emergence/新cds_server研究規劃.md（自 Cursor 規劃檔同步，供急診 CDS server follow-up）；同步更新本檔系統時間戳

更新時間：2026-04-16 16:46
作者：CDS Service
摘要：README.md 補上 CQL→ELM 編譯方式（快速指令），同步更新本檔系統時間戳

更新時間：2026-04-16 16:44
作者：CDS Service
摘要：egfr-check / ckd-risk 兩支 hook handler 補強流程註解（可讀性提升；不影響行為），同步更新本檔系統時間戳

更新時間：2026-04-16 16:41
作者：CDS Service
摘要：補強 ckdComprehensiveHookHandler 的邏輯註解（可讀性提升；不影響行為），同步更新本檔系統時間戳

更新時間：2026-04-16 15:21
作者：CDS Service
摘要：frontend Patient 下拉清單加入 patient-ckd-107（方便驗證 ckd-risk 新增的家族史/AKI warning）

更新時間：2026-04-16 15:07
作者：CDS Service
摘要：ckd-risk 就地升級：新增 AKI（N17*）與家族史 CKD（FamilyMemberHistory + SNOMED 709044004）風險因子與 warning；Discovery/prefetch 同步擴充

更新時間：2026-04-16 14:15
作者：CDS Service
摘要：新增 ckd-comprehensive（第三服務）：CQL/ELM（CKD_Comprehensive）、後端端點與前端 UI；補上 CPG 文件連結

更新時間：2026-04-16 13:27
作者：CDS Service
摘要：新增專案根目錄 README.md（快速導覽）；本檔標題下加入 README 連結；詳盡操作仍以本檔為主

更新時間：2026-04-16 13:16
作者：CDS Service
摘要：QA 補 UI-CKD-02；操作說明第 7 節補 hybrid 驗證步驟；修正 CDS_Hook_UI_Operation 4.4 換行誤植

更新時間：2026-04-16 11:19
作者：CDS Service
摘要：文件同步：CDS_Hook_UI_Operation.md 與 qa/ui_operation_qa.md 更新為「單一 Prefetch（依服務切換）」與 ckd-risk hybrid；修正常見狀況說明

更新時間：2026-04-16 10:57
作者：CDS Service
摘要：frontend Prefetch 開關整併為單一控制（依服務切換）；標題列縮短高度（長描述改為 tooltip）；服務說明文案補強

更新時間：2026-04-16 10:29
作者：CDS Service
摘要：ckd-risk v1 改為 hybrid（prefetch 可省略，伺服端向 FHIR 取 Patient/Condition/Observation）；更新 Postman TC-HOOK-02 與文件敘述

更新時間：2026-04-16 10:08
作者：CDS Service
摘要：frontend 標題列應用說明（zh-TW）＋主要欄位 Tooltip；copy/zhTwUi.ts 集中文案

更新時間：2026-04-16 09:48
作者：CDS Service
摘要：frontend UI/UX Pro Max 重構 — theme.ts、JsonBlock／CdsCardView、請求設定卡片、載入列、跳過連結、a11y（MUI v9）

更新時間：2026-04-16 09:43
作者：CDS Service
摘要：新增 docs/qa/ui_operation_qa.md（CDS Hook UI 操作／Prefetch 開關詳細 QA）；docs/qa/README 加入連結

更新時間：2026-04-16 09:27
作者：CDS Service
摘要：frontend egfr-check 依 Discovery 自 FHIR 組 prefetch（patient/latestEgfr/latestCreatinine）；Postman E2E 新增 TC-PF-03；更新 CDS_Hook_UI_Operation.md

更新時間：2026-04-16 09:16
作者：CDS Service
摘要：docs/CDS_Hook_UI_Operation.md 補充 Prefetch (stub) 與 egfr-check 後端辨識欄位之對照說明

更新時間：2026-04-16 09:02
作者：CDS Service
摘要：新增 docs/CDS_Hook_UI_Operation.md（前端 CDS Hook UI 操作說明）；架構文件與 Frontend 章節加入連結

更新時間：2026-04-15 18:35
作者：CDS Service
摘要：docs/qa/README.md 補充 ckd-risk v1 前端驗證紀錄（uACR/eGFR warning）與 FHIR 測資更新方式

更新時間：2026-04-15 18:13
作者：CDS Service
摘要：frontend ckd-risk 改為自動從 FHIR 取 Patient/Condition/Observation 組 prefetch（避免 Prefetch required）

更新時間：2026-04-15 18:00
作者：CDS Service
摘要：Postman E2E 補上 ckd-risk v1 完整 prefetch 測試請求（conditions/observations），用於直接驗證 cards 輸出

更新時間：2026-04-15 17:53
作者：CDS Service
摘要：ckd-risk v1 擴充為 CKD 規則集合（flags + eGFR/uACR reminders，prefetch-only）；新增 CKD_Risk.cql/ELM 與路由分離保護 egfr-check

更新時間：2026-04-15 16:50
作者：CDS Service
摘要：新增 frontend（Vite + React + MUI）模擬 patient-view eGFR CDS Hook，自動呼叫 /cds-services/egfr-check 並顯示 cards/RuleEngine

更新時間：2026-04-15 16:19
作者：CDS Service
摘要：docs/qa/README.md 補充 FHIRHelpers（cql/ 與 elm/）在 ELM 執行期的角色與常見錯誤

更新時間：2026-04-15 16:00
作者：CDS Service
摘要：新增 FHIR 測試資料匯入/查詢用 Postman collection（postman/CDS-Service-FHIR-TestData.postman_collection.json）

更新時間：2026-04-15 15:20
作者：CDS Service
摘要：cards.extension 回傳規則引擎標記（ELM/TS）；USE_ELM 真跑 ELM 需搭配 elm/FHIRHelpers.json 與 cql/FHIRHelpers.cql

更新時間：2026-04-15 14:52
作者：CDS Service
摘要：新增 USE_ELM 切換真跑 ELM（cql-execution + cql-exec-fhir）；Postman 呼叫時可切換 TS/ELM

更新時間：2026-04-15 13:09
作者：CDS Service
摘要：新增 postman/CDS-Service-E2E.postman_collection.json（TC-HOOK／TC-PF／TC-ERR）；dev_readme Postman 章節補充

更新時間：2026-04-15 12:11
作者：CDS Service
摘要：新增 docs/qa/README.md（CQL／ELM／UCUM QA 紀錄）；架構文件區加入連結

更新時間：2026-04-15 12:07
作者：CDS Service
摘要：cql/EGFR_Check.cql UCUM 門檻改為 mL/min/1.73/m2；以 Maven（scripts/cql-compile-pom.xml）重產 elm/EGFR_Check.json

更新時間：2026-04-15 11:35
作者：CDS Service
摘要：elm/EGFR_Check.json 以兩空格縮排格式化（JSON.parse／JSON.stringify，語意不變）

更新時間：2026-04-15 11:11
作者：CDS Service
摘要：新增 docs/cql_elm.md（CQL→ELM 編譯與執行期說明）；架構文件區加入連結

更新時間：2026-04-15 09:48
作者：CDS Service
摘要：新增 docs/E2E_Test_Plan.md（E2E 測試計畫）；架構文件區加入連結

更新時間：2026-04-15 09:43
作者：CDS Service
摘要：階段四 — 說明 Fastify 等同教學 Express、複查卡含 links/source.url；環境變數 CDS_GUIDELINE_URL

更新時間：2026-04-15 09:32
作者：CDS Service
摘要：階段三 — CQL 腳本 cql/EGFR_Check.cql 與 TS 對齊評估；Hook 可回傳 eGFR 複查 warning 卡片

更新時間：2026-04-15 09:16
作者：CDS Service
摘要：新增 Postman Collection（postman/CDS-Service.postman_collection.json）與匯入說明

更新時間：2026-04-15 09:09
作者：CDS Service
摘要：步驟二 — Discovery 合併 egfr-check + ckd-risk、POST /cds-services/egfr-check；修正 .env 章節格式

更新時間：2026-04-14 16:56
作者：CDS Service
摘要：新增 dotenv/.env 支援（.env.example、server 入口載入 dotenv/config），以 .env 設定 FHIR_BASE_URL

更新時間：2026-04-14 16:30
作者：CDS Service
摘要：discovery 服務 href 與環境變數 CDS_PUBLIC_BASE_URL 說明

更新時間：2026-04-14 16:29
作者：CDS Service
摘要：補充 cmd `echo %date% %time%` 時間戳與端點驗證說明

更新時間：2026-04-14 16:27
作者：CDS Service
摘要：初版專案說明、FHIR 測試與 CDS discovery/hook 端點；系統時間取自本機 PowerShell Get-Date（台灣本機時區 UTC+8）
-->

# CDS Service（Node.js + Fastify + TypeScript）

**專案快速導覽（README）**：[`README.md`](README.md)

## 系統日期時間（建置／文件更新時請一併更新本段與檔案頂部歷史）

- **記錄時間**：2026-04-20 10:25（台灣本機時區 UTC+8；cmd `echo %date% %time%`：2026/04/20 10:24:50.30）

## 需求

- Node.js 18+
- 本機 HAPI FHIR（預設 `http://localhost:9090/fhir`，可設 `FHIR_BASE_URL`）

## 安裝

```powershell
cd "c:\Development\HISCore\CDS Service"
npm install
```

## 指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式（watch）啟動 CDS Service |
| `npm run dev:emergency` | 開發模式（watch）啟動**急診獨立** CDS（預設 `EMERGENCY_CDS_PORT=3001`） |
| `npm start` | 啟動 CDS Service（預設 `PORT=3000`、`HOST=0.0.0.0`） |
| `npm run start:emergency` | 啟動急診獨立 CDS（預設 port **3001**） |
| `npm run build` | TypeScript 編譯至 `dist/` |
| `npm run test:fhir` | 連線 FHIR 驗證 Patient / eGFR / Creatinine |

## FHIR Client 驗證

需先啟動 HAPI FHIR 並載入測試資料（例如 `patient-ckd-001`）。急診 **`72hr-revisit` warning** 可另匯入兩筆 Encounter 測資：[`input/tests/fhir/case-08-emergency-72h-revisit-patient-ckd-001.bundle.json`](input/tests/fhir/case-08-emergency-72h-revisit-patient-ckd-001.bundle.json)（維護說明見同目錄 [`case-08-emergency-72h-revisit-patient-ckd-001.README.md`](input/tests/fhir/case-08-emergency-72h-revisit-patient-ckd-001.README.md)）。急診 **`infection-control-warning` warning** 測資：[`case-09`…`patient-ckd-001`](input/tests/fhir/case-09-emergency-infection-control-patient-ckd-001.bundle.json)（[`README`](input/tests/fhir/case-09-emergency-infection-control-patient-ckd-001.README.md)）、HIR／**`patient-ckd-002`**：[`case-09-1`…bundle](input/tests/fhir/case-09-1-emergency-infection-control-patient-ckd-002.bundle.json)（[`README`](input/tests/fhir/case-09-1-emergency-infection-control-patient-ckd-002.README.md)）；規則與 CQL 關係見 [`docs/emergence/infection_control_warning_rules.md`](docs/emergence/infection_control_warning_rules.md)（含 **72hr-revisit** 與 **infection-control-warning**）。變更請求範本（急診 TS→CQL／ELM 等）：[`docs/emergence/ecr-template.md`](docs/emergence/ecr-template.md)。

```powershell
npm run test:fhir
```

## Postman

1. 啟動 CDS Service：`npm start`；HAPI FHIR 可連（`FHIR_BASE_URL`）。
2. **一般呼叫**：**Import** → [`postman/CDS-Service.postman_collection.json`](postman/CDS-Service.postman_collection.json)  
   - 變數：`baseUrl`、`patientId`
3. **急診獨立 CDS（專用）**：**Import** → [`postman/CDS-Service-Emergency.postman_collection.json`](postman/CDS-Service-Emergency.postman_collection.json)  
   - 前置：另開終端機執行 `npm run start:emergency`（預設 port **3001**）  
   - 變數：`emergencyBaseUrl`、`patientId`  
   - 內容：Discovery、兩支 hook（hybrid）、`Patient/` 前綴範例、缺少 `patientId` 邊界案例
4. **E2E（對應 docs/E2E_Test_Plan.md）**：**Import** → [`postman/CDS-Service-E2E.postman_collection.json`](postman/CDS-Service-E2E.postman_collection.json)  
   - 資料夾：TC-HOOK（主路徑）、TC-PF（Prefetch）、TC-ERR（錯誤路徑；部分需手動停 FHIR 或改 `.env`）、**TC-EMERGENCY**（急診獨立 CDS；需另 `npm run start:emergency`）  
   - 變數：`baseUrl`、`emergencyBaseUrl`（預設 `http://127.0.0.1:3001`）、`patientIdCaseA`、`patientIdCaseB`、`patientIdNonExistent`
5. **FHIR 測資（匯入/查詢）**：**Import** → [`postman/CDS-Service-FHIR-TestData.postman_collection.json`](postman/CDS-Service-FHIR-TestData.postman_collection.json)  
   - 資料夾：01 Import（transaction Bundles）、02 Query（GET/SEARCH）  
   - 變數：`fhirBaseUrl`（預設 `http://localhost:9090/fhir`）

## Frontend（CDS Hooks UI）

獨立前端 UI（Vite + React + MUI），用來模擬 EHR 呼叫 CDS Hooks：會先向目標 server 取得 Discovery（`GET /cds-services`），再依選擇的 service/hook type 送出 `POST /cds-services/{id}`，並以 UI 顯示 cards 與 `RuleEngine` extension。

- **操作說明（控制列、Request／輸出區、ckd-risk 與 egfr-check、`Prefetch from FHIR`）**：[`docs/CDS_Hook_UI_Operation.md`](docs/CDS_Hook_UI_Operation.md)

```powershell
cd "c:\Development\HISCore\CDS Service\frontend"
npm install
npm run dev
```

- 代理設定：`frontend/.env`（或自行建立 `.env.local`）\n+  - `VITE_CDS_PROXY_TARGET`：主 CDS（預設 `http://127.0.0.1:3000`）\n+  - `VITE_EMERGENCY_CDS_PROXY_TARGET`：急診 CDS（預設 `http://127.0.0.1:3001`）\n+  - `VITE_FHIR_BASE_URL`：FHIR base（預設 `http://localhost:9090/fhir`）\n+  - 前端呼叫路徑：`/cds-services/*`（主 CDS）、`/emergency-cds-services/*`（急診 CDS）、`/fhir/*`（FHIR）

## 急診獨立 CDS Server（第二程序）

與主程式 [`src/server.ts`](src/server.ts) 並存，入口為 [`src/emergency/server.ts`](src/emergency/server.ts)。預設監聽 **`EMERGENCY_CDS_PORT`（3001）**，Discovery 僅列出急診兩項 **`patient-view`** 服務：

| 端點 | 說明 |
|------|------|
| `GET …/cds-services` | Discovery（`72hr-revisit`、`infection-control-warning`） |
| `POST …/cds-services/72hr-revisit` | 72 小時內多次 Encounter 門檻（`EMERGENCY_REVISIT_*`；**`USE_ELM=true`** 時跑 `Emergency_72h_Revisit` ELM） |
| `POST …/cds-services/infection-control-warning` | Flag／ATC J04*／TB-HIV ICD-10 線索（`EMERGENCY_INFECT_CTRL_SKIP_FLAGS`；**`USE_ELM=true`** 時跑 `Infection_Control_Warning` ELM） |

- **`USE_ELM`**：與主 CDS **共用**；兩程序皆 `true` 時各自執行對應 ELM，失敗則 `TS_FALLBACK`；cards 含 `urn:cds-service:rule-engine`。
- **規則與 ECR**：[`docs/emergence/infection_control_warning_rules.md`](docs/emergence/infection_control_warning_rules.md)、[`docs/emergence/ecr-template.md`](docs/emergence/ecr-template.md)。
- **公開 URL**：Discovery 的 `href` 使用 `EMERGENCY_CDS_PUBLIC_BASE_URL`（勿尾隨 `/`）。
- **FHIR**：第一波與主服務共用 `FHIR_BASE_URL`。

## CDS Hooks

- **Discovery**：`GET http://localhost:3000/cds-services`（回傳 `egfr-check`、`ckd-risk`、`ckd-comprehensive` 三項服務，`prefetch` 使用 `{{context.patientId}}` 範本）
- **eGFR Hook（步驟二）**：`POST http://localhost:3000/cds-services/egfr-check`
- **CKD Hook**：`POST http://localhost:3000/cds-services/ckd-risk`（**CKD 規則集合 v1**：Risk flags + eGFR/uACR missing reminders；**hybrid**：prefetch 可省略，伺服端向 FHIR 補齊）  
- **CKD Comprehensive Hook**：`POST http://localhost:3000/cds-services/ckd-comprehensive`（**CPG + Risk + Testing**；**hybrid**：prefetch 可省略，伺服端向 FHIR 補齊）
  Body 範例（JSON）：

```json
{
  "hook": "patient-view",
  "context": { "patientId": "patient-ckd-001" }
}
```

## 環境變數

| 變數 | 預設 | 說明 |
|------|------|------|
| `FHIR_BASE_URL` | `http://localhost:9090/fhir` | HAPI FHIR base URL |
| `CDS_PUBLIC_BASE_URL` | `http://localhost:3000` | Discovery 中 `href` 的公開基底（勿尾隨 `/`） |
| `CDS_GUIDELINE_URL` | `https://example.org/guidelines` | 複查 warning 卡 `source.url`（可改為院內指引） |
| `USE_ELM` | `false` | 是否改用 **ELM 引擎**（`cql-execution` + `cql-exec-fhir`）：**主 CDS** 之 `elm/EGFR_Check.json`、`elm/CKD_Risk.json`、`elm/CKD_Comprehensive.json`；**急診** 之 `elm/Infection_Control_Warning.json`、`elm/Emergency_72h_Revisit.json`。失敗會標記 `TS_FALLBACK`（主／急診皆同） |
| `PORT` | `3000` | HTTP 埠 |
| `HOST` | `0.0.0.0` | 綁定位址 |
| `EMERGENCY_CDS_PORT` | `3001` | 急診獨立 CDS HTTP 埠 |
| `EMERGENCY_CDS_HOST` | `0.0.0.0` | 急診獨立 CDS 綁定位址 |
| `EMERGENCY_CDS_PUBLIC_BASE_URL` | `http://localhost:3001` | 急診 Discovery 中各服務 `href` 的公開基底 |
| `EMERGENCY_REVISIT_WINDOW_HOURS` | `72` | 返診偵測時間窗（小時） |
| `EMERGENCY_REVISIT_MIN_ENCOUNTERS` | `2` | 時間窗內至少幾筆 Encounter 起算警示 |
| `EMERGENCY_ENCOUNTER_CLASS_CODES` | （未設＝不過濾） | 逗號分隔，例如 `EMER`；只統計該 class code 之 Encounter |
| `EMERGENCY_INFECT_CTRL_SKIP_FLAGS` | `false` | 設為 `true` 時感控 hook 忽略 Flag，只用用藥＋診斷 |

## 使用 .env（dotenv）

本專案會在啟動時自動載入專案根目錄的 `.env`（透過 `dotenv/config`）。

1. 複製範本：

```powershell
Copy-Item .env.example .env
```

2. 修改 `.env` 中的 `FHIR_BASE_URL` 等設定後再啟動：

```powershell
npm start
```

## 架構文件

- [`hi_level_design.md`](hi_level_design.md) — CDS Hooks / FHIR / CQL 邊界與資料流（階段一）
- [`docs/E2E_Test_Plan.md`](docs/E2E_Test_Plan.md) — **E2E 完整測試計畫**（案例編號、前置條件、錯誤路徑）
- [`docs/cql_elm.md`](docs/cql_elm.md) — **CQL→ELM 編譯指令**（VS Code / Java CLI）、產物路徑與執行期依賴說明
- [`docs/qa/README.md`](docs/qa/README.md) — **CQL／ELM／UCUM QA 紀錄**（問題排查、驗證清單、Maven 重編譯）
- [`docs/qa/ui_operation_qa.md`](docs/qa/ui_operation_qa.md) — **CDS Hook UI 操作／Prefetch 開關詳細 QA**
- [`docs/CDS_Hook_UI_Operation.md`](docs/CDS_Hook_UI_Operation.md) — **CDS Hook 前端 UI 操作說明**（patient-view、prefetch、RuleEngine）
- [`docs/CPG/README-ckd-comprehensive.md`](docs/CPG/README-ckd-comprehensive.md) — **ckd-comprehensive 服務說明**（規則表、ELM 載入、null 原則）
- [`docs/CPG/CKD_Comprehensive_Implementation_Plan.md`](docs/CPG/CKD_Comprehensive_Implementation_Plan.md) — **ckd-comprehensive 實作計畫**（含 critical thinking checklist）
- [`docs/emergence/新cds_server研究規劃.md`](docs/emergence/新cds_server研究規劃.md) — **急診 CDS server 研究規劃 follow-up**（獨立 server 方案 A／既有 server 方案 B、待確認事項）
- [`docs/git/fetch與pull簡明說明與QA.md`](docs/git/fetch與pull簡明說明與QA.md) — **Git fetch／pull 簡明比喻與 Q&A**（對齊遠端前速查）

## 階段三：CQL（eGFR 複查）

- **規則腳本**：[`cql/EGFR_Check.cql`](cql/EGFR_Check.cql)（`Needs Recheck`：最新 eGFR 低於 60）
- **執行（目前）**：[`src/cql/egfrRecheckEvaluation.ts`](src/cql/egfrRecheckEvaluation.ts) 為與 CQL 等價之 TypeScript 評估層；後續可改接 CQL/ELM 引擎。
- **行為**：`POST` hook 成功時，除檢驗摘要卡外，若觸發規則會多一張 **warning** 建議卡。

## 階段四：CDS Service 實作（與教學 Express 對照）

- **HTTP 框架**：本專案使用 **Fastify**（[`src/server.ts`](src/server.ts)），職責與教學中的 **Express** 相同：提供 `GET /cds-services`、`POST /cds-services/egfr-check` 等，並解析 JSON body。
- **已整合**：[`src/fhir/fhirClient.ts`](src/fhir/fhirClient.ts)（FHIR）、[`src/cds/cdsServices.ts`](src/cds/cdsServices.ts)（Discovery / `extractEGFRValue`）、[`src/cds/ckdHookHandler.ts`](src/cds/ckdHookHandler.ts)（Prefetch 優先 + FHIR fallback、產生 **Cards**）。
- **Cards**：觸發 eGFR 複查時，warning 卡含 **`source.url`**（指引連結，見 `CDS_GUIDELINE_URL`）與 **`links`**（指向 FHIR 上 eGFR 檢驗查詢 URL）。
- **cql-execution / cql-exec-fhir**：教學中需先將 `.cql` **編譯為 ELM JSON** 再交給 `cql-execution` 執行。目前仍以 **TS 對齊層** 執行與 [`cql/EGFR_Check.cql`](cql/EGFR_Check.cql) 相同決策；若要改為執行 ELM，需另建 CQL→ELM 流程（常見為 Java `cql-to-elm`）並於程式載入 `EGFR_Check.elm.json`。

## 原始碼結構

- `src/server.ts` — 應用程式入口
- `src/fhir/fhirClient.ts` — FHIR HTTP Client
- `src/cds/` — Discovery、`cdsServices.ts`（Prefetch 輔助）、CKD / eGFR hook
- `cql/` — CQL 規則檔（如 `EGFR_Check.cql`）
- `src/cql/` — 與 CQL 對齊之評估模組（過渡至引擎前）
- `src/scripts/test-fhir-client.ts` — FHIR 連線測試腳本
- `postman/CDS-Service.postman_collection.json` — Postman 匯入用 Collection（Discovery + 基本 Hook）
- `postman/CDS-Service-E2E.postman_collection.json` — E2E 測試（TC-HOOK／TC-PF／TC-ERR）
- `docs/E2E_Test_Plan.md` — E2E 測試計畫
- `docs/cql_elm.md` — CQL→ELM 流程與編譯說明
- `docs/qa/README.md` — CQL／ELM／UCUM QA 紀錄
- `docs/qa/ui_operation_qa.md` — CDS Hook UI 操作／Prefetch 詳細 QA
- `docs/CDS_Hook_UI_Operation.md` — CDS Hook 前端 UI 操作說明
