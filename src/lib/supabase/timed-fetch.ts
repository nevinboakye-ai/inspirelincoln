/**
 * fetch with a deadline, for every call to Supabase. When the database is
 * overloaded its requests can hang for minutes; without a deadline each page
 * waits with them and the whole site stops responding. With one, a request
 * gives up after `ms` and the page carries on (or shows its error state).
 * A caller's own abort signal still works alongside the deadline.
 */
export function timedFetch(ms: number): typeof fetch {
  return (input, init) => {
    const deadline = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    return fetch(input, { ...init, signal });
  };
}

/** Pages and route handlers: long enough for a slow query, short of a hung page. */
export const SERVER_DB_TIMEOUT_MS = 10_000;
/** The proxy runs before every page, so it waits far less and fails open. */
export const PROXY_DB_TIMEOUT_MS = 3_000;
