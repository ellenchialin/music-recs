import { MotionGlobalConfig } from "motion-v";

// 元件測試只檢查行為，不跑動畫：happy-dom 取消進行中的動畫時會丟 AbortError，
// 而且動畫結束前元素還沒到最終狀態
MotionGlobalConfig.skipAnimations = true;
