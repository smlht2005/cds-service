# CQL 新手導覽 — `Infection_Control_Warning.cql`

本文用「一段一段拆開」的方式說明 `cql/Infection_Control_Warning.cql`。這支 CQL 的任務很單純：**判斷一位急診病人是否需要「感染管制警示」**（例如結核 TB、HIV 相關狀況）。

---

## 先理解 CQL 是什麼

CQL（Clinical Quality Language）是一種**專門描述臨床邏輯的語言**。可以把它想像成「醫療版的 Excel 公式」：

- 它不負責畫面、不負責連網路，只負責**「根據病人的資料，算出一個答案」**。
- 它的資料來源是 **FHIR**（醫療資料的標準格式，像病人的病歷卡）。
- 寫好的 `.cql` 會被編譯成 `.json`（ELM）後才能被程式執行。

---

## 逐段拆解

### 1. 檔頭宣告（第 7–15 行）

```cql
library Infection_Control_Warning version '1.0.0'   -- 這支程式的名字與版本
using FHIR version '4.0.1'                           -- 我要讀的病歷格式版本
include FHIRHelpers version '4.1.0'                  -- 借用一組工具函式
parameter "SkipFlags" System.Boolean default false  -- 一個可調的開關，預設關
context Patient                                      -- 以「單一病人」為計算範圍
```

重點 `context Patient`：之後所有 `[Flag]`、`[Condition]` 查詢，**都自動限定在「這一位病人」身上**，不用每次都寫「where 病人 = 某某」。

> `parameter "SkipFlags"` 是外部傳進來的開關。打開時就跳過 Flag 的計算（後面會用到）。

---

### 2. `MeaningfulActiveFlags`：找出「有意義且生效中」的警示旗標（第 17–25 行）

```cql
define "MeaningfulActiveFlags":
  [Flag] F                                    -- 抓出這位病人的所有 Flag(警示)
    where F.status is not null
      and FHIRHelpers.ToString(F.status) = 'active'   -- 條件1：狀態是「生效中」
      and F.code is not null
      and (                                            -- 條件2：要有實際內容
        (F.code.text is not null and Length(F.code.text.value) > 0)
          or exists(F.code.coding)
      )
```

- `[Flag] F` = 「取出所有 Flag 資源，把每一筆叫做 F」（像 SQL 的 `SELECT * FROM Flag`）。
- `where` = 過濾條件，三個都要符合：狀態是 active、有 code、code 裡有文字或編碼。
- 用意是排除「空的或已失效的警示」，只留下**真正有臨床意義的**。

---

### 3. `FlagCount`：算出旗標數量（第 27–29 行）

```cql
define "FlagCount":
  if SkipFlags then 0                  -- 若開關打開 → 直接當作 0
  else Count("MeaningfulActiveFlags")  -- 否則 → 數一數上面找到幾筆
```

這就是 `parameter SkipFlags` 的用途：**測試或特殊情境時，可一鍵忽略 Flag 判斷**。

---

### 4. `TbMedCount` / `ArvMedCount`：用藥判斷（第 31–59 行）

兩段結構幾乎一樣，差別只在藥物代碼開頭。它在問：**這位病人有沒有在用「結核藥」或「愛滋藥」？**

```cql
define "TbMedCount":
  Count(
    [MedicationStatement] MS                       -- 抓出所有用藥紀錄
      where MS.medication is FHIR.CodeableConcept  -- 確認藥物是用「編碼」表示
        and exists(                                -- 「存在」符合條件的編碼
          ((MS.medication as FHIR.CodeableConcept).coding) C
            where C.code is not null
              and (
                Lower(Coalesce(C.system.value, '')) contains 'atc'   -- 編碼系統是 ATC/WHOCC
                  or Lower(Coalesce(C.system.value, '')) contains 'whocc'
              )
              and StartsWith(Upper(C.code.value), 'J04')  -- 藥碼以 J04 開頭 = 抗結核藥
        )
  )
```

新手要認識的幾個關鍵字：

| 寫法 | 白話意思 |
|------|---------|
| `Count(...)` | 數有幾筆 |
| `exists(...)` | 「至少有一筆符合」就成立（回傳 true/false） |
| `Coalesce(x, '')` | 如果 x 是空值，就改用 `''`（防止 null 出錯，像 Excel 的 IFERROR） |
| `Lower / Upper` | 轉小寫／大寫，避免大小寫不一致 |
| `contains` | 字串包含 |
| `StartsWith(..., 'J04')` | 開頭是 J04 |

- **`J04`** = ATC 分類的「抗結核藥」→ 有在用 = 可能是 TB 病人。
- **`J05`**（`ArvMedCount`）= 「抗病毒藥（含 ARV/抗愛滋）」→ 可能是 HIV 病人。

> 這裡用「正在用某類藥」反推病人可能的疾病，是臨床 CDS 常見技巧。

---

### 5. `TbHivConditionCount`：用診斷（ICD-10）判斷（第 61–80 行）

直接看病人的**診斷碼**有沒有結核或 HIV：

```cql
and exists(C.clinicalStatus.coding CC where CC.code.value = 'active')  -- 診斷狀態=活動中
...
Lower(...) contains 'icd-10'                                            -- 編碼系統是 ICD-10
...
Matches(Upper(ReplaceMatches(CD.code.value, '\\.', '')), '^B2[0-4].*')  -- B20~B24 = HIV
  or Matches(Upper(ReplaceMatches(CD.code.value, '\\.', '')), '^A1[5-9].*')  -- A15~A19 = 結核
```

兩個進階函式：

- `ReplaceMatches(code, '\\.', '')` = 把代碼裡的小數點拿掉（`B20.1` → `B201`），統一格式再比對。
- `Matches(..., '^B2[0-4].*')` = **正規表達式**比對：
  - `^B2[0-4]` = 開頭是 B20、B21、B22、B23、B24 → **HIV/AIDS**
  - `^A1[5-9]` = 開頭是 A15~A19 → **結核病 (TB)**

---

### 6. `HasAlert`：最終結論（第 82–86 行）

```cql
define "HasAlert":
  ("FlagCount" > 0)              -- 有生效中的警示旗標
    or ("TbMedCount" > 0)        -- 或 在用結核藥
    or ("ArvMedCount" > 0)       -- 或 在用愛滋藥
    or ("TbHivConditionCount" > 0)  -- 或 有結核/HIV 診斷
```

**只要任一條件成立 → 回傳 `true`**（該觸發感染管制警示）。這就是整支 CQL 對外輸出的最終答案。

---

## 一句話總結整體邏輯

> 對一位急診病人，從**四個來源**（警示旗標、結核用藥、愛滋用藥、結核/HIV 診斷）任一發現線索，就亮起「感染管制警示」。

---

## 新手最該記住的 5 個觀念

1. **`define "名字": 邏輯`** = 定義一個可重複使用的「計算欄位」，彼此可互相引用（`HasAlert` 引用了上面 4 個）。
2. **`[資源] 別名 where 條件`** = CQL 版的查詢，等同 SQL 的 SELECT + WHERE。
3. **`context Patient`** = 全部自動鎖定單一病人。
4. **`exists` / `Count`** = 判斷「有沒有」/「幾筆」，是 CDS 規則的核心。
5. **`Coalesce` 防 null、`Lower/Upper` 防大小寫、`ReplaceMatches` 統一格式** = 真實醫療資料很髒，這些都是「防禦性寫法」。
