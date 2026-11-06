import { MotionGlobalConfig } from "motion-v";

// Component tests check behavior, not animation: happy-dom throws AbortError when cancelling
// animations, and elements aren't in their final state until they finish
MotionGlobalConfig.skipAnimations = true;
