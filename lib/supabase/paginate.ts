import type { PostgrestError } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

/**
 * Supabase/PostgREST caps a single response at 1000 rows by default. Loops with
 * `.range()` until a page comes back short, so callers don't silently truncate as
 * tables grow past that limit.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
