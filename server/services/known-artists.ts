import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import type { Suggestion } from "../../shared/utils/suggestion-match";

// Instant autocomplete from names already in our database: artists people looked up (with
// listener counts) and everyone in the similar-artist lists they brought in. Matches the start of
// the name or of any word, which Last.fm's search can't ("radioh" finds Radish there). Names that
// turn up in more lists come first, a rough stand-in for popularity. A few milliseconds, against
// Last.fm's 1–3 s, so the page shows these while it waits for Last.fm
const LIMIT = 5;

export async function searchKnownArtists(db: Db, typed: string): Promise<Suggestion[]> {
  const t = normalizeArtistName(typed);
  if (t.length < 2) return [];
  // LIKE's wildcards, so "100%" is plain text; backslash is Postgres's default escape
  const like = t.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await db.execute<{ name: string; listeners: number | null }>(sql`
    select (array_agg(name order by source))[1] as name, max(listeners) as listeners
    from (
      select name, name_norm, listeners, 0 as source from artists
      union all
      select name, name_norm, null::integer, 1 from artist_similar
    ) known
    where name_norm like ${`${like}%`} or name_norm like ${`% ${like}%`}
    group by name_norm
    order by count(*) desc, max(listeners) desc nulls last, name_norm
    limit ${LIMIT}
  `);
  return rows.map((r) => ({ name: r.name, listeners: r.listeners }));
}
