const USER_AGENT =
  "model-picker/0.1 (data sync; contact: owner@example.com; +https://github.com/)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T>(
  url: string,
  label: string,
  { retries = 3, timeoutMs = 90_000 } = {},
): Promise<{ data: T; fetchedAt: string }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = (await res.json()) as T;
      return { data, fetchedAt: new Date().toISOString() };
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) await sleep(1500 * 2 ** attempt);
    }
  }

  throw new Error(`${label} 拉取失败：${String(lastError)}`);
}

export async function fetchJsonWithFallback<T>(
  urls: string[],
  label: string,
): Promise<{ data: T; fetchedAt: string; url: string }> {
  let lastError: unknown;

  for (const url of urls) {
    try {
      const result = await fetchJson<T>(url, label, { retries: 2 });
      return { ...result, url };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`${label} 全部地址失败：${String(lastError)}`);
}