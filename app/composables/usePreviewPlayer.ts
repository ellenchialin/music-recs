// One shared <audio> for the page, so starting a preview stops the previous one
export const usePreviewPlayer = createSharedComposable(() => {
  // Created on first play: there's no Audio during SSR
  let element: HTMLAudioElement | null = null;
  function audio() {
    if (!element) {
      element = new Audio();
      element.addEventListener("ended", () => {
        playingUrl.value = null;
      });
    }
    return element;
  }

  const playingUrl = ref<string | null>(null);

  function stop() {
    element?.pause();
    playingUrl.value = null;
  }

  async function toggle(url: string) {
    if (playingUrl.value === url) {
      stop();
      return;
    }
    const player = audio();
    player.pause();
    player.src = url;
    playingUrl.value = url;
    try {
      await player.play();
    } catch {
      // Blocked by the browser or a dead URL: don't get stuck showing Pause
      if (playingUrl.value === url) playingUrl.value = null;
    }
  }

  return { audio, playingUrl: readonly(playingUrl), toggle, stop };
});
