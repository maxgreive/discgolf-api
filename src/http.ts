import axios from 'axios';

type AxiosRequestConfig = Parameters<typeof axios.request>[0];

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 300;

const http = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'User-Agent': 'discgolf-api/1.0',
  },
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (!status) return true; // network error / timeout
  return status === 429 || status >= 500;
}

async function requestWithRetry<T>(
  config: AxiosRequestConfig,
  retries = DEFAULT_RETRIES,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const response = await http.request<T>(config as any);
      return response.data;
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === retries) {
        throw error;
      }
      const delay = DEFAULT_RETRY_DELAY_MS * 2 ** attempt;
      await sleep(delay);
      attempt += 1;
    }
  }

  throw lastError;
}

export async function getText(url: string, config?: AxiosRequestConfig): Promise<string> {
  return requestWithRetry<string>({ url, method: 'GET', responseType: 'text', ...config });
}

export async function getJson<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return requestWithRetry<T>({ url, method: 'GET', responseType: 'json', ...config });
}

export { http, requestWithRetry };
