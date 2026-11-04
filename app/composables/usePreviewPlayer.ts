// 全頁共用一個 <audio>：一次只播一首試聽，按另一張卡片的播放鈕，前一首自動停
// createSharedComposable（VueUse）：每個元件呼叫 usePreviewPlayer() 拿到的是同一份狀態，像一個小型的全域 store
export const usePreviewPlayer = createSharedComposable(() => {
  const audio = new Audio();
  // 正在播的試聽網址；null = 沒有在播。卡片用它決定按鈕顯示「試聽」還是「暫停」
  const playingUrl = ref<string | null>(null);

  function stop() {
    audio.pause();
    playingUrl.value = null;
  }

  async function toggle(url: string) {
    if (playingUrl.value === url) {
      stop();
      return;
    }
    audio.pause();
    audio.src = url;
    playingUrl.value = url;
    try {
      await audio.play();
    } catch {
      // 瀏覽器擋播放、網址失效：回到沒在播的狀態，不要卡在「暫停」按鈕
      if (playingUrl.value === url) playingUrl.value = null;
    }
  }

  // 30 秒播完
  audio.addEventListener("ended", () => {
    playingUrl.value = null;
  });

  return { audio, playingUrl: readonly(playingUrl), toggle, stop };
});
