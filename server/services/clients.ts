import { createItunesClient } from "../itunes/client";
import { createLastfmClient } from "../lastfm/client";
import { parseLastfmEnv } from "../utils/env";

// Real clients, created on first use. Tests pass fakes to the services instead

let lastfm: ReturnType<typeof createLastfmClient> | undefined;
let itunes: ReturnType<typeof createItunesClient> | undefined;

export function getLastfmClient() {
  lastfm ??= createLastfmClient({ apiKey: parseLastfmEnv().LASTFM_API_KEY });
  return lastfm;
}

export function getItunesClient() {
  itunes ??= createItunesClient();
  return itunes;
}
