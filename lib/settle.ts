/**
 * Runs a load and keeps its failure instead of hiding it, so one panel can show
 * "couldn't load" while the rest of the page still works. Never turn a failure into an
 * empty list: an empty list says "nothing here", which is a different message.
 */
export type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

export async function settle<T>(load: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await load };
  } catch (error) {
    console.error("Load failed:", error);
    return { ok: false, error };
  }
}
