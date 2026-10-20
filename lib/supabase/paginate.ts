import type { PostgrestError } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Supabase/PostgREST caps a single response at 1000 rows by default. Loops with
 * `.range()` until a page comes back short, so callers don't silently truncate as
 * tables grow past that limit.
 *
 * Retries each page a couple of times on error: a single transient blip from the
 * API (rare, but observed in production) would otherwise crash the whole page
 * since there's no partial-data fallback once rows have already been collected.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    let data: T[] | null = null;
    let error: PostgrestError | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      ({ data, error } = await fetchPage(from, from + PAGE_SIZE - 1));
      if (!error) break;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
