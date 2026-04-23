/*
 * 更新時間：2026-04-22 10:58
 * 作者：CDS Service
 * 摘要：Phase 4 — 新增 tbDetection 快選匯出（patient-view 的病患快選 chips）。
 *
 * 更新時間：2026-04-20 17:55
 * 作者：CDS Service
 * 摘要：新增 mixed hooks 的 hookBuilders 匯出入口（observation-create / order-select）
 */

export {
  OBSERVATION_CREATE_HOOK,
  createObservationCreateBuilderState,
  parseObservationCreateContext,
  renderObservationCreateBuilder,
  type ObservationCreateContextBuilderState,
} from './observationCreateBuilder';

export {
  ORDER_SELECT_HOOK,
  createOrderSelectBuilderState,
  parseOrderSelectContext,
  renderOrderSelectBuilder,
  type OrderSelectContextBuilderState,
} from './orderSelectBuilder';

export {
  TB_DETECTION_SERVICE_ID,
  TB_DETECTION_QUICK_PRESETS,
  renderTbDetectionQuickPresets,
  type TbDetectionQuickPreset,
} from './tbDetection';

