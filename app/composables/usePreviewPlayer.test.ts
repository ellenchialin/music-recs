import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreviewPlayer } from "./usePreviewPlayer";

const A = "https://audio.example/a.m4a";
const B = "https://audio.example/b.m4a";

// happy-dom 不會真的播放音訊，把 play、pause 換成假的，只記錄被呼叫
const play = vi.spyOn(HTMLMediaElement.prototype, "play");
const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

beforeEach(() => {
  play.mockReset().mockResolvedValue(undefined);
  pause.mockClear();
});

// 播放器是全頁共用的，測試之間要停掉
afterEach(() => usePreviewPlayer().stop());

describe("usePreviewPlayer", () => {
  it("plays a preview", async () => {
    const player = usePreviewPlayer();
    await player.toggle(A);
    expect(player.playingUrl.value).toBe(A);
    expect(play).toHaveBeenCalledOnce();
  });

  // 同一個按鈕再按一次是暫停
  it("stops when the same preview is toggled again", async () => {
    const player = usePreviewPlayer();
    await player.toggle(A);
    await player.toggle(A);
    expect(player.playingUrl.value).toBeNull();
    expect(pause).toHaveBeenCalled();
  });

  // 全頁只有一個播放器：每張卡片拿到的是同一個，播 B 時 A 自動停
  it("plays only one preview at a time across cards", async () => {
    const cardA = usePreviewPlayer();
    const cardB = usePreviewPlayer();
    await cardA.toggle(A);
    await cardB.toggle(B);
    expect(cardA.playingUrl.value).toBe(B);
  });

  // 30 秒試聽播完，按鈕要回到「試聽」
  it("resets when the preview ends", async () => {
    const player = usePreviewPlayer();
    await player.toggle(A);
    player.audio.dispatchEvent(new Event("ended"));
    expect(player.playingUrl.value).toBeNull();
  });

  // 瀏覽器擋自動播放、或網址失效時 play() 會失敗：不要卡在「播放中」
  it("resets when the browser refuses to play", async () => {
    play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    const player = usePreviewPlayer();
    await player.toggle(A);
    expect(player.playingUrl.value).toBeNull();
  });
});
