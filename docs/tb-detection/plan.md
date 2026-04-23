<!--
更新時間：2026-04-22 13:30
作者：CDS Service
摘要：完整測試計畫（case-19～28）全數通過（15/15 PASS，USE_ELM=true）；修正三個邊界情境失敗根因（ELM indicator 全 ELM 化、searchAllConditionsForPatient、case-25 ValueSet 碼對齊）；
      進度儀表板新增 #18～#20；§3.3 / Phase 4 / Test Plan 各節均標記為 Done；
      「Phase 4 — 前端」、「Test Plan」段落補齊完整實作摘要與驗收結果。

更新時間：2026-04-22 11:00
作者：CDS Service
摘要：Phase 3.3（ELM 化 LatestSafetyLabs）與 Phase 4（前端 tbDetection hook builder）完成並驗收；CQL 新增 `TbLabObservationCount` define，Executor 接 `observations` 並回傳計數，rule-engine extension 附 `elm_lab_obs_count`（case-14=3、其餘=0）；前端新增 `tbDetection.tsx` 快選 chips、App.tsx 納入 tb-detection 的 Prefetch from FHIR 組裝（conditions/medicationRequests/medicationStatements/flags/observations）；`fhirSearch` 擴充 MedicationRequest；前端 build 綠燈

更新時間：2026-04-22 10:41
作者：CDS Service
摘要：Phase 3.1（LatestSafetyLabs 安全性監測卡片）與 Phase 3.2（case-16/17/18 補測資）均完成並驗收；case-14 detail 彙整 ALT/Cr/CBC 最新檢驗值；case-16 LTBI、case-17 Flag-only、case-18 Contact 在 USE_ELM=true 下 engine=ELM 且 ELM 布林與 TS 計數 100% 一致；既有兩服務回歸通過

更新時間：2026-04-22 10:06
作者：CDS Service
摘要：Phase 2（ELM 化）已完成並驗收通過；ELM JSON 編譯成功、Executor + USE_ELM 分支 + TS_FALLBACK 就緒；case-14/15 在 USE_ELM=true 下 engine=ELM 且與 TS 計數 100% 一致；既有兩服務（72hr-revisit／infection-control-warning）回歸通過

更新時間：2026-04-22 09:40
作者：CDS Service
摘要：Phase 1（TS 主路徑）已完成並驗收通過；新增「進度儀表板」與「Phase 2（ELM 化）」詳細實作步驟；列出具體檔案、指令、驗收腳本與回滾方式

更新時間：2026-04-22 09:22
作者：CDS Service
摘要：新增 TB Detection 服務實作計畫（複製自 .cursor/plans/emergency-tb-detection-service）；列出 CQL / ValueSet 對應、檔案異動、驗收與風險
-->

# Emergency TB Detection 新服務實作計畫

> Plan ID: `emergency-tb-detection-service`
>
> 在現有急診 CDS Server（port 3001）新增獨立的 TB Detection 服務：新 CQL 以 canonical URL 宣告 ValueSet 對齊本次匯入的 4 份 FHIR ValueSet；以 TS 主路徑先上線，再以 ELM 為第二階段取代（由 `cql-execution` 驅動、單一真相來源為 CQL）。

---

## 進度儀表板（2026-04-22 最終）

| # | 項目 | 狀態 | 備註／產出 |
| - | - | - | - |
| 1 | 新增 `cql/Emergency_TB_Detection.cql`（canonical URL ValueSet） | ✅ Done | [cql/Emergency_TB_Detection.cql](../../cql/Emergency_TB_Detection.cql) |
| 2 | 新增 `src/fhir/tbFhirClient.ts`（ValueSet by url／MedicationRequest） | ✅ Done | 獨立 axios，不動 `fhirClient.ts` |
| 3 | 新增 `src/cql/tbValueSetLoader.ts`（載入、快取、TS 比對） | ✅ Done | 提供 `ensureTbValueSets()` / `codeableInValueSet` |
| 4 | 新增 `src/emergency/handlers/tbDetectionHookHandler.ts`（TS 主路徑） | ✅ Done | patient-view hook；回傳 warning/info 卡片 |
| 5 | Append `emergencyServiceDefinitions.ts`（註冊 `tb-detection`） | ✅ Done | Discovery 已列出；prefetch 完整 |
| 6 | Append `routes.ts`（POST `/cds-services/tb-detection`） | ✅ Done | 既有兩支 hook 未改動 |
| 7 | 測資 `case-14`（A15 + Isoniazid）／`case-15`（僅二線、無 TB 診斷） | ✅ Done | 實測 warning / info，符合規則 |
| 8 | 回歸驗證（`72hr-revisit` / `infection-control-warning`） | ✅ Done | 行為一致，皆走 ELM |
| 9 | TypeScript build（`npm run build`） | ✅ Done | 綠燈；0 lint 錯誤 |
| 10 | 更新 `dev_readme.md` 系統時間戳（置頂、保留歷史） | ✅ Done | 每次修改均更新 |
| 11 | 編譯 `elm/Emergency_TB_Detection.json`（Maven cql-to-elm-cli） | ✅ Done | 修 Condition.clinicalStatus 型別、abatement as FHIR.dateTime、FHIRHelpers 4.1.0 |
| 12 | 新增 `src/cql/emergencyTbDetectionElmExecutor.ts` | ✅ Done | `cql.CodeService`（canonical URL→concept list）+ `PatientSource.FHIRv401` |
| 13 | handler 加 `USE_ELM` 分支 + TS_FALLBACK | ✅ Done | rule-engine extension：ELM／TS／TS_FALLBACK 三態；附 ELM 布林摘要 |
| 13a | Phase 2 驗收：case-14／case-15 在 `USE_ELM=true` 成功 | ✅ Done | engine=ELM；ELM 布林與 TS 計數 100% 一致 |
| 13b | 回歸：`72hr-revisit` / `infection-control-warning` 於 `USE_ELM=true` | ✅ Done | engine=ELM；行為與輸出一致 |
| 14 | Observation／安全性監測卡片（LatestSafetyLabs） | ✅ Done | case-14 detail 顯示 ALT/Cr/CBC 各筆最新值 |
| 15 | 測資 `case-16 LTBI`／`case-17 Flag-only`／`case-18 Contact` | ✅ Done | 三案 ELM 引擎全數通過，布林與 TS 計數一致 |
| 16 | §3.3 ELM 化 LatestSafetyLabs（`TbLabObservationCount`） | ✅ Done | CQL 新增 define；Executor 接 observations；rule-engine 附 `elm_lab_obs_count`（case-14=3） |
| 17 | Phase 4 前端 hook builder（TB Detection 快選 chips） | ✅ Done | `tbDetection.tsx`；App.tsx 組裝 TB prefetch；`fhirSearch` 擴充 MedicationRequest |
| 18 | 完整測試計畫文件（`docs/tb-detection/test-plan.md`） | ✅ Done | 10 個邊界情境（case-19～28）設計與驗收表 |
| 19 | case-19～28 FHIR bundle + CDS payload 建立並匯入 FHIR Server | ✅ Done | 10 份 bundle；10 份 `input/tests/cds/tb-detection-case-*.json` |
| 20 | 全案（case-14～28）15/15 驗收通過 + 三大架構缺陷修正 | ✅ Done | 見「Test Plan 驗收」節 |

---

## Phase 1 — 已完成（TS 主路徑）

### 目標與邊界

- 在 `src/emergency/server.ts`（port 3001）新增 CDS service：`tb-detection`，hook=`patient-view`。
- 以新 CQL／新 handler／新 ValueSet loader 實作，**不動**：
  - `cql/Emergency_infection_tb.cql`
  - `cql/Infection_Control_Warning.cql`
  - `src/emergency/handlers/infectionControlHookHandler.ts`
  - `src/emergency/handlers/revisit72hHookHandler.ts`
  - `src/cql/emergencyInfectionControlElmExecutor.ts`
  - `src/fhir/fhirClient.ts`（新拆 `src/fhir/tbFhirClient.ts`，不修改既有 client）
- 僅對兩個「服務註冊檔」做最小增補：`src/emergency/emergencyServiceDefinitions.ts`、`src/emergency/routes.ts`。

### ValueSet 對應（canonical URL）

| CQL valueset | FHIR canonical url |
| - | - |
| `TB-Diagnoses` | `https://fhir.your-hosp.org.tw/ValueSet/tb-diagnoses`（A15–A19、Z16.34、R76.1、Z20.1 合併） |
| `TB-Meds-FirstLine` | `https://fhir.your-hosp.org.tw/ValueSet/tb-meds-firstline` |
| `TB-Meds-SecondLine` | `https://fhir.your-hosp.org.tw/ValueSet/tb-meds-secondline` |
| `TB-Lab-Monitoring` | `https://fhir.your-hosp.org.tw/ValueSet/tb-lab-monitoring` |
| Flag（感控旗標） | 無對應 ValueSet → 沿用 `Flag.status='active' + meaningful code` |

### Phase 1 驗收結果

- `GET http://localhost:3001/cds-services` 回傳含新的 `tb-detection`（Discovery 正常）。
- case-14：`active_tb_dx=1; first_line_meds=1` → **warning**。
- case-15：`active_tb_dx=0; second_line_meds=1` → **info**（二線但無 TB 診斷，規則不觸發）。
- 既有兩服務回歸驗證通過（`engine=ELM` 不變）。

---

## Phase 2 — 已完成（ELM 化）

> 於 2026-04-22 完成並驗收。`USE_ELM=true` 時走 cql-execution + ELM；失敗或 ELM 檔不存在時自動 `TS_FALLBACK`。

### Phase 2 實作摘要

1. **CQL 修正**：`Condition.clinicalStatus` 型別改用 `codesystem`/`code` 宣告；coding list demotion 改 `exists()`；`abatementDateTime` → `(C.abatement as FHIR.dateTime)`；FHIRHelpers 4.0.1 → 4.1.0。
2. **ELM Executor** (`src/cql/emergencyTbDetectionElmExecutor.ts`)：以 `tbValueSetLoader` 快取建 `cql.CodeService`（canonical URL→concept list）；`PatientSource.FHIRv401` + Bundle 組裝；回傳 10 項 define。
3. **TbValueSetLoader 擴充**：`TbValueSetEntry.rawConcepts` 保留原始 system/code 供 CodeService 準確配對。
4. **Handler**：`USE_ELM` 分支；成功 `engine=ELM`；例外 `engine=TS_FALLBACK`。

### Phase 2 驗收

| Case | 預期 | 實測 engine | 結果 |
| - | - | - | - |
| case-14 | warning | ELM | ✅ PASS |
| case-15 | info | ELM | ✅ PASS |
| 72hr-revisit 回歸 | warning | ELM | ✅ PASS |
| infection-control-warning 回歸 | warning | ELM | ✅ PASS |

---

## Phase 3 — 已完成（§3.1 / §3.2 / §3.3）

### §3.1 Observation / LatestSafetyLabs 卡片（Done）

- `emergencyServiceDefinitions.ts` prefetch 增補 `observations`。
- handler 新增 `buildLatestSafetyLabs()` / `formatSafetyLabsForDetail()`：以 `TB-Lab-Monitoring` ValueSet 過濾 Observation，依 `system|code` 分組取最新 effective，支援 `valueQuantity` / `valueString` / `component`（CBC）。
- ELM / TS / TS_FALLBACK 三路徑均 append 到卡片 detail。
- 驗收：case-14 detail 正確顯示 ALT 38 U/L / Cr 1.02 mg/dL / CBC（WBC=7.1, Hb=13.4）。

### §3.2 補測資（Done）

| 檔案 | 場景 | 期望／實測 |
| - | - | - |
| `case-16-tb-detection-ltbi.bundle.json` | `R76.1` + `INH` | `elm_latent=true; elm_first_line=true` → **warning** ✅ |
| `case-17-tb-detection-flag-only.bundle.json` | 感控 Flag active | `elm_flag=true` → **warning** ✅ |
| `case-18-tb-detection-contact.bundle.json` | `Z20.1` | `elm_contact=true` → **warning** ✅ |

### §3.3 ELM 化 LatestSafetyLabs（Done）

- CQL 新增 `define "TbLabObservationCount": Count([Observation: "TB-Lab-Monitoring"])`；Maven 重編 ELM 成功。
- `EmergencyTbDetectionElmInput.observations?` 加入；`buildBundle` 將 observations 塞入 Bundle。
- 回傳結構加 `tbLabObservationCount`；rule-engine extension 附 `elm_lab_obs_count=N`。
- **設計取捨（KISS）**：per-code 展示層（ALT/Cr/CBC/AST/T-Bil）交由 handler TS 側以同一 ValueSet 快取組裝，不在 CQL 內 hardcode 五組 NHI/LOINC。
- 驗收：case-14 `elm_lab_obs_count=3`；case-15/16/17/18 = 0。

---

## Phase 4 — 已完成（前端 hook builder）

### 實作摘要

| 檔案 | 說明 |
| - | - |
| `frontend/src/cds/hookBuilders/tbDetection.tsx` | `TB_DETECTION_SERVICE_ID`、5 顆病患快選 chips（patient-tb-001/002/016/017/018）、`renderTbDetectionQuickPresets()` |
| `frontend/src/cds/hookBuilders/index.ts` | 匯出 `TB_DETECTION_SERVICE_ID` / `renderTbDetectionQuickPresets` |
| `frontend/src/App.tsx` | `supportsPrefetchFromFhir` 納入 `tb-detection`；新增 Prefetch 分支（Patient/Condition/MedicationRequest/MedicationStatement/Flag/Observation）；Tooltip 文案延伸；patientId 欄位下掛快選 chips |
| `frontend/src/api/fhirClient.ts` | `fhirSearch` 擴充 `MedicationRequest` 型別 |
| `frontend/src/copy/zhTwUi.ts` | `prefetchEmergency` 文案補充 tb-detection 說明 |

### Phase 4 驗收

- 前端 `npm run build` 綠燈；0 lint 錯誤。
- 後端接受 tb-detection prefetch 形狀（`POST /cds-services/tb-detection` 回 1 張卡）。

---

## Test Plan — 已完成（case-19～28）

> 詳細設計見 [docs/tb-detection/test-plan.md](./test-plan.md)

### 新增測試案例覆蓋矩陣

| Case | 情境 | 目標 CQL Define | 預期 indicator | 結果 |
| - | - | - | - | - |
| **19** | 完全陰性（只有 Patient） | PatientHasTBOrLTBI=false | info | ✅ PASS |
| **20** | Resolved TB 近 18 個月（應觸發） | HasActiveTbDiagnosis（resolved+2yr） | warning | ✅ PASS |
| **21** | Resolved TB 36 個月前（不觸發） | HasActiveTbDiagnosis=false | info | ✅ PASS |
| **22** | A16 肺外結核 active | HasActiveTbDiagnosis（A1[5-9] regex） | warning | ✅ PASS |
| **23** | Z16.34 抗藥性結核 active | HasActiveTbDiagnosis（Z1634） | warning | ✅ PASS |
| **24** | Bedaquiline + A15 診斷同時存在 | HasSecondLineTbMedWithTbDx=true | warning | ✅ PASS |
| **25** | MedicationRequest 一線 Ethambutol active | HasFirstLineTbMed（MedReq 路徑） | warning | ✅ PASS |
| **26** | MedicationRequest completed 90 天前（180d 內） | HasFirstLineTbMed（completed 有效） | warning | ✅ PASS |
| **27** | MedicationRequest completed 200 天前（180d 外） | HasFirstLineTbMed=false | info | ✅ PASS |
| **28** | 追加 T-Bil（09029C）+ AST（09025C） | TbLabObservationCount≥5 | warning | ✅ PASS |

> **15 / 15 PASS**（含 case-14～18 原有 5 案）

### 測試發現的架構缺陷與修正

| # | 缺陷（初次 FAIL） | 根本原因 | 修正 |
| - | - | - | - |
| 1 | case-20 got=info | `buildTbDetectionCards` 的 indicator 由 **TS signals 計數**決定，ELM 布林只是附掛 extension；TS `countSignals()` 不實作 resolved-2yr window | ELM mode 改由 `elmSummary` 布林決定 `reasons` 與 `indicator`（**全 ELM 化收尾**） |
| 2 | case-20 ELM 也拿不到 resolved Condition | `searchActiveConditions()` 查 FHIR 時帶 `clinical-status=active`，resolved Condition 根本不回傳 | `tbFhirClient.ts` 新增 `searchAllConditionsForPatient()`（不過濾 status）；handler ELM 路徑改用全量查詢 |
| 3 | case-25 got=info | Rifampin 單方 `A048017100` **不在** TB-Meds-FirstLine ValueSet（ValueSet 只有 RIFATER 複方 `BC22060100` 及 Isoniazid/Ethambutol/Streptomycin） | case-25 bundle 換用 Ethambutol `A002076100`（ValueSet 實際存在） |
| 4 | case-27 got=warning | TS `medicationMatches()` 不看 `status`/`authoredOn` 日期；completed 200 天的 MedRequest 仍被 TS 計為有效一線藥 | 同缺陷 1 — ELM mode 改用 ELM 布林（ELM 正確排除逾 180 天） |

---

## 檔案清單（最終對照）

| 檔案 | 類型 | 階段 |
| - | - | - |
| `cql/Emergency_TB_Detection.cql` | 新增 | Phase 1 + 2 修正 + §3.3 |
| `elm/Emergency_TB_Detection.json` | 產出（版控） | Phase 2 編譯 |
| `src/fhir/tbFhirClient.ts` | 新增 | Phase 1；Test Plan 加 `searchAllConditionsForPatient` |
| `src/cql/tbValueSetLoader.ts` | 新增 | Phase 1；Phase 2 加 `rawConcepts` |
| `src/cql/emergencyTbDetectionElmExecutor.ts` | 新增 | Phase 2；§3.3 加 `observations`/`tbLabObservationCount` |
| `src/emergency/handlers/tbDetectionHookHandler.ts` | 新增 | Phase 1；Phase 2 USE_ELM 分支；§3.1 Safety Labs；§3.3；Test Plan 全 ELM 化 |
| `src/emergency/emergencyServiceDefinitions.ts` | append | Phase 1（service 定義）；§3.1（observations prefetch） |
| `src/emergency/routes.ts` | append | Phase 1 |
| `frontend/src/cds/hookBuilders/tbDetection.tsx` | 新增 | Phase 4 |
| `frontend/src/cds/hookBuilders/index.ts` | 變更 | Phase 4 |
| `frontend/src/App.tsx` | 變更 | Phase 4 |
| `frontend/src/api/fhirClient.ts` | 變更 | Phase 4（MedicationRequest 型別） |
| `frontend/src/copy/zhTwUi.ts` | 變更 | Phase 4（tooltip 文案） |
| `input/tests/fhir/case-14*.bundle.json` | 新增 | Phase 1 |
| `input/tests/fhir/case-14b*.bundle.json` | 新增 | §3.1（Safety Labs） |
| `input/tests/fhir/case-15*.bundle.json` | 新增 | Phase 1 |
| `input/tests/fhir/case-16/17/18*.bundle.json` | 新增 | §3.2 |
| `input/tests/fhir/case-19～28*.bundle.json` | 新增 | Test Plan |
| `input/tests/cds/tb-detection-case-14～28.json` | 新增 | Phase 1 / §3.2 / Test Plan |
| `docs/tb-detection/test-plan.md` | 新增 | Test Plan |

---

## 快速驗收腳本（USE_ELM=true 完整套）

```powershell
# 啟動伺服器
$env:USE_ELM="true"; $env:EMERGENCY_CDS_PORT="3001"; $env:FHIR_BASE_URL="http://localhost:9090/fhir"
node dist/emergency/server.js

# 跑全部 TB 案例（case-14～28）
$expected = @{14="warning";15="info";16="warning";17="warning";18="warning";
              19="info";20="warning";21="info";22="warning";23="warning";
              24="warning";25="warning";26="warning";27="info";28="warning"}
$pass=0; $fail=0
foreach ($n in 14..28) {
  $ind = curl.exe -sS -X POST "http://localhost:3001/cds-services/tb-detection" `
    -H "Content-Type: application/json" `
    --data-binary "@input/tests/cds/tb-detection-case-$n.json" `
  | python -c "import json,sys; d=json.loads(sys.stdin.read()); print(d['cards'][0]['indicator'])"
  if ($ind -eq $expected[$n]) { $pass++; Write-Host "case-$n PASS" }
  else { $fail++; Write-Host "case-$n FAIL(got=$ind,exp=$($expected[$n]))" }
}
Write-Host "=== $pass PASS / $fail FAIL ==="
```

---

## 回滾方式

- ELM 失敗：設 `USE_ELM=false` 即回到 TS 路徑；handler 內的 `TS_FALLBACK` 亦自動保護。
- 關閉整個 `tb-detection`：註解 `emergencyDiscoveryServices` 中 `emergencyTbDetectionService` 一行 + `routes.ts` 對應 route 一行；其他服務完全不受影響。

---

## 後續建議（Next Steps）

| 優先度 | 項目 | 說明 |
| - | - | - |
| 🔴 高 | 整合測試腳本化 | 將 15 案驗收腳本包成 `npm run test:tb` 或 `.ps1`，CI 可重複執行 |
| 🔴 高 | ValueSet 補充 Rifampin 單方 | `A048017100`（Rifampin 單方）目前**不在** tb-meds-firstline ValueSet；若院內實際使用應補入 |
| 🟡 中 | 前端 FHIR 連線驗證 | 實際從 UI 選 patient-tb-001 + Prefetch from FHIR 開關確認前端送出完整 prefetch |
| 🟡 中 | MedStatement completed + Period.end 邊界測試 | CQL 使用 `(MS.effective as Period).end`；尚無測資覆蓋 Period 型別的 180d window |
| 🟢 低 | 多重觸發情境 | A15 + Z20.1 + Flag 同時存在，確認 detail 列出全部 reasons |
| 🟢 低 | 前端 UI 截圖驗收 | Chrome headless 截圖放入 `docs/qa/` |
