import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const A = "https://audio.example/a.m4a";

// happy-dom can't play audio
const play = vi.spyOn(HTMLMediaElement.prototype, "play");
const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

beforeEach(async () => {
  play.mockReset().mockResolvedValue(undefined);
  pause.mockClear();
  await useRouter().push("/recommendations?seed=Tame+Impala");
});

afterEach(() => usePreviewPlayer().stop());

// One <audio> serves the whole app, so a preview would otherwise follow the visitor to the next page
describe("stopping previews between pages", () => {
  it("stops the preview when the visitor goes to another page", async () => {
    const player = usePreviewPlayer();
    await player.toggle(A);

    await useRouter().push("/taste-check?seed=Tame+Impala");

    expect(player.playingUrl.value).toBeNull();
    expect(pause).toHaveBeenCalled();
  });

  // Exploring a level only changes the query; the record playing is still on screen until the next level loads
  it("keeps playing when only the query changes", async () => {
    const player = usePreviewPlayer();
    await player.toggle(A);

    await useRouter().push("/recommendations?seed=Tame+Impala&explore=Pond");

    expect(player.playingUrl.value).toBe(A);
  });
});
