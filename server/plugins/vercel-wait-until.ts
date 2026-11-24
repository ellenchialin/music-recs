import { waitUntil } from "@vercel/functions";
import { bridgeWaitUntil } from "../utils/platform-wait-until";

declare module "h3" {
  interface H3EventContext {
    // Read by Nitro's event.waitUntil; a platform adapter sets it, and Vercel's doesn't
    waitUntil?: (promise: Promise<unknown>) => void;
  }
}

// Vercel's waitUntil finds the current request's context when it's called. Off Vercel it does
// nothing, which is fine: a plain Node server keeps running after the response anyway
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    bridgeWaitUntil(event.context, waitUntil);
  });
});
