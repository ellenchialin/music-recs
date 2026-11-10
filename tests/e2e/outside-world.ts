// Shared by the config, the seed (server side) and the tests (browser side), without importing
// server code into the browser tests

// The E2E database, separate from dev (music) and the DB tests (music_test)
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5434/music_e2e";

// The seed empties every table, so it must never run against a hosted database such as Neon
export function assertLocalDatabase(url: string) {
  const { hostname } = new URL(url);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) {
    throw new Error(`E2E_DATABASE_URL must point to a local database, not ${hostname}`);
  }
}

// Valid-looking but fake, so a request that slips past the cache can't succeed
export const FAKE_LASTFM_API_KEY = "0".repeat(32);

// Seeded preview URLs live under this origin, which the CSP allows; the tests answer them with a WAV
export const PREVIEW_ORIGIN = "https://audio-ssl.itunes.apple.com";

export function previewUrl(artist: string) {
  return `${PREVIEW_ORIGIN}/e2e/${encodeURIComponent(artist)}.m4a`;
}

// A short silent WAV, generated so the repo needs no audio file. Browsers sniff the content, not
// the .m4a extension. Two seconds so `timeupdate` fires a few times
export function silentWav(seconds = 2, sampleRate = 8000) {
  const samples = seconds * sampleRate;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // bytes per second
  buffer.writeUInt16LE(2, 32); // bytes per sample
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
