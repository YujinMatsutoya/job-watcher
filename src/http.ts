export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type JsonFetcher = (url: string, init?: { method?: string; body?: unknown }) => Promise<unknown>;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} from ${url}`);
  }
}

/** Fetch JSON with a timeout and up to 3 attempts on transient errors (network, 429, 5xx). */
export const fetchJson: JsonFetcher = async (url, init = {}) => {
  const maxAttempts = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        method: init.method ?? "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new HttpError(res.status, url);
      return await res.json();
    } catch (err) {
      const transient = !(err instanceof HttpError) || err.status === 429 || err.status >= 500;
      if (!transient || attempt >= maxAttempts) throw err;
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
};
