import Axios, { AxiosRequestConfig, AxiosError } from 'axios';
import i18n from '../i18n/index';

export type CustomAxiosRequestConfig = AxiosRequestConfig & {
  suppressGlobalErrorNotification?: boolean;
};

type BackendErrorResponse = {
  code: string;
  message: string;
};

const tryGetBackendErrorResponse = (
  data: unknown,
): BackendErrorResponse | null => {
  if (!data || typeof data !== 'object') return null;
  const maybe = data as { code?: unknown; message?: unknown };
  if (typeof maybe.code !== 'string' || maybe.code.trim().length === 0)
    return null;
  if (typeof maybe.message !== 'string') return null;
  return { code: maybe.code, message: maybe.message };
};

export const getApiErrorCode = (error: unknown): string | null => {
  if (!Axios.isAxiosError(error)) return null;
  const backend = tryGetBackendErrorResponse(error.response?.data);
  return backend?.code ?? null;
};

export const getApiErrorMessage = (error: unknown): string => {
  if (Axios.isAxiosError(error)) {
    const backend = tryGetBackendErrorResponse(error.response?.data);
    if (backend) {
      const key = `errors.backend.${backend.code}`;
      if (i18n.exists(key)) return i18n.t(key);
      return backend.message;
    }
    const status = error.response?.status;
    if (status === 401) return i18n.t('errors.http.unauthorized');
    if (status === 403) return i18n.t('errors.http.forbidden');
    if (status === 404) return i18n.t('errors.http.notFound');
    if (status === 500) return i18n.t('errors.http.serverError');
    if (status && status >= 502) return i18n.t('errors.http.serviceUnavailable');
  }
  return i18n.t('errors.http.generic');
};

const getBaseUrl = (): string => {
  const env = import.meta.env as Record<string, string | undefined>;
  const baseUrl = env.VITE_API_URL;
  if (baseUrl && baseUrl.trim().length > 0) {
    return baseUrl;
  }
  // Same-origin: frontend is served by the backend, so relative path works everywhere
  return '';
};

export const AXIOS_INSTANCE = Axios.create({
  baseURL: getBaseUrl(),
});

// Global error interceptor
AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Add global error notification logic here (e.g., notistack enqueueSnackbar)
    return Promise.reject(error);
  },
);

let globalAccessToken: string | null = null;

export const setGlobalToken = (token: string | null): void => {
  globalAccessToken = token;
};

export const clearAllTokens = (): void => {
  globalAccessToken = null;
};

export const isTokenAvailable = (): boolean => !!globalAccessToken;

/**
 * Custom Axios instance used by Orval-generated hooks.
 */
export const customInstance = <T>(
  config: CustomAxiosRequestConfig,
): Promise<T> => {
  const source = Axios.CancelToken.source();
  const requestConfig: CustomAxiosRequestConfig = {
    ...config,
    cancelToken: source.token,
  };

  if (globalAccessToken) {
    requestConfig.headers = {
      ...requestConfig.headers,
      Authorization: `Bearer ${globalAccessToken}`,
    };
  }

  const promise = AXIOS_INSTANCE(requestConfig).then(({ data }) => data);
  // @ts-expect-error — cancel attached for React Query
  promise.cancel = () => source.cancel('Query was cancelled by React Query');
  return promise;
};
