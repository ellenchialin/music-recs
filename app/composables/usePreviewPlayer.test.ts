import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreviewPlayer } from "./usePreviewPlayer";

const A = "https://audio.example/a.m4a";
const B = "https://audio.example/b.m4a";

// happy-dom can't play audio
const play = vi.spyOn(HTMLMediaElement.prototype, "play");
const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

beforeEach(() => {
  play.mockReset().mockResolvedValue(undefined);
  pause.mockClear();
});

afterEach(() => usePreviewPlayer().stop());

describe("usePreviewPlayer", () => {
  it("plays a preview", async () => {
    const player = usePreviewPlayer();
    await player.toggle(A);
    expect(player.playingUrl.value).toBe(A);
    expect(play).toHaveBeenCalledOnce();
  });

  it("stops when the same preview is toggled again", async () => {
    const player = usePreviewPlayer();
    await player.toggle(A);
    await player.toggle(A);
    expect(player.playingUrl.value).toBeNull();
    expect(pause).toHaveBeenCalled();
  });

  it("plays only one preview at a time across cards", async () => {
    const cardA = usePreviewPlayer();
    const cardB = usePreviewPlayer();
    await cardA.toggle(A);
    await cardB.toggle(B);
    expect(cardA.playingUrl.value).toBe(B);
  });

  it("resets when the preview ends", async () => {
    const player = usePreviewPlayer();
    await player.toggle(A);
    player.audio().dispatchEvent(new Event("ended"));
    expect(player.playingUrl.value).toBeNull();
  });

  it("resets when the browser refuses to play", async () => {
    play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    const player = usePreviewPlayer();
    await player.toggle(A);
    expect(player.playingUrl.value).toBeNull();
  });

  // There's no Audio during SSR; creating one early crashed the page with a 500
  it("does not create an audio element until a preview is played", async () => {
    vi.resetModules();
    const AudioSpy = vi.spyOn(globalThis, "Audio");
    const { usePreviewPlayer: fresh } = await import("./usePreviewPlayer");
    const player = fresh();
    expect(player.playingUrl.value).toBeNull();
    expect(AudioSpy).not.toHaveBeenCalled();
    await player.toggle(A);
    expect(AudioSpy).toHaveBeenCalledOnce();
    AudioSpy.mockRestore();
  });
});
