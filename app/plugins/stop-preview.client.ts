// One <audio> plays previews for the whole app (usePreviewPlayer), so without this a preview kept
// playing after the visitor went to another page, such as from recommendations to the Taste Check.
// Only a new page stops it: exploring a level changes just the query and keeps the record playing
export default defineNuxtPlugin(() => {
  useRouter().afterEach((to, from) => {
    if (to.path !== from.path) usePreviewPlayer().stop();
  });
});
