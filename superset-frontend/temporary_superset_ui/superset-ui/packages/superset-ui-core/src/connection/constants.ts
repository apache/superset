import { FetchRetryOptions } from './types';

export const DEFAULT_BASE_URL = 'http://localhost';

// HTTP status codes
export const HTTP_STATUS_OK = 200;
export const HTTP_STATUS_NOT_MODIFIED = 304;

// Namespace for Cache API
export const CACHE_AVAILABLE = 'caches' in window;
export const CACHE_KEY = '@SUPERSET-UI/CONNECTION';

export const DEFAULT_FETCH_RETRY_OPTIONS: FetchRetryOptions = {
  retries: 3,
  retryDelay: 1000,
  retryOn: [503],
};
