// 全頁共用一個 <audio>：一次只播一首試聽，按另一張卡片的播放鈕，前一首自動停
// createSharedComposable（VueUse）：每個元件呼叫 usePreviewPlayer() 拿到的是同一份狀態，像一個小型的全域 store
export const usePreviewPlayer = createSharedComposable(() => {
  // 第一次按播放才建立 <audio>：伺服器端渲染（SSR）沒有 Audio，一開始就 new 的話推薦頁會 500
  let element: HTMLAudioElement | null = null;
  function audio() {
    if (!element) {
      element = new Audio();
      // 30 秒播完
      element.addEventListener("ended", () => {
        playingUrl.value = null;
      });
    }
    return element;
  }

  // 正在播的試聽網址；null = 沒有在播。卡片用它決定按鈕顯示「試聽」還是「暫停」
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
      // 瀏覽器擋播放、網址失效：回到沒在播的狀態，不要卡在「暫停」按鈕
      if (playingUrl.value === url) playingUrl.value = null;
    }
  }

  return { audio, playingUrl: readonly(playingUrl), toggle, stop };
});
