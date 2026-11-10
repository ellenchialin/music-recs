import { MotionGlobalConfig } from "motion-v";

// Component tests check behavior, not animation: happy-dom throws AbortError when cancelling
// animations, and elements aren't in their final state until they finish
MotionGlobalConfig.skipAnimations = true;

// Browsers mark an animation's `finished` promise as handled when cancel() rejects it, as the Web
// Animations spec says; happy-dom doesn't, so removing an element mid-animation (the reason
// skeleton's endless pulse) showed up as an unhandled rejection and failed the run
const cancel = Animation.prototype.cancel;
Animation.prototype.cancel = function (this: Animation) {
  this.finished.catch(() => {});
  cancel.call(this);
};
