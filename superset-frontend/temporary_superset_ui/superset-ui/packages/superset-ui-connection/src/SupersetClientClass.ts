import callApiAndParseWithTimeout from './callApi/callApiAndParseWithTimeout';
import {
  ClientConfig,
  ClientTimeout,
  Credentials,
  CsrfPromise,
  CsrfToken,
  FetchRetryOptions,
  Headers,
  Host,
  Mode,
  Protocol,
  RequestConfig,
  ParseMethod,
} from './types';
import { DEFAULT_FETCH_RETRY_OPTIONS } from './constants';

export default class SupersetClientClass {
  credentials: Credentials;
  csrfToken?: CsrfToken;
  csrfPromise?: CsrfPromise;
  fetchRetryOptions?: FetchRetryOptions;
  baseUrl: string;
  protocol: Protocol;
  host: Host;
  headers: Headers;
  mode: Mode;
  timeout: ClientTimeout;

  constructor({
    baseUrl = 'http://localhost',
    host,
    protocol,
    headers = {},
    fetchRetryOptions = {},
    mode = 'same-origin',
    timeout,
    credentials = undefined,
    csrfToken = undefined,
  }: ClientConfig = {}) {
    const url = new URL(
      host || protocol ? `${protocol || 'https:'}//${host || 'localhost'}` : baseUrl,
    );
    this.baseUrl = url.href.replace(/\/+$/, ''); // always strip trailing slash
    this.host = url.host;
    this.protocol = url.protocol as Protocol;
    this.headers = { ...headers };
    this.mode = mode;
    this.timeout = timeout;
    this.credentials = credentials;
    this.csrfToken = csrfToken;
    this.fetchRetryOptions = { ...DEFAULT_FETCH_RETRY_OPTIONS, ...fetchRetryOptions };
    if (typeof this.csrfToken === 'string') {
      this.headers = { ...this.headers, 'X-CSRFToken': this.csrfToken };
      this.csrfPromise = Promise.resolve(this.csrfToken);
    }
  }

  async init(force: boolean = false): CsrfPromise {
    if (this.isAuthenticated() && !force) {
      return this.csrfPromise as CsrfPromise;
    }
    return this.getCSRFToken();
  }

  async reAuthenticate() {
    return this.init(true);
  }

  isAuthenticated(): boolean {
    // if CSRF protection is disabled in the Superset app, the token may be an empty string
    return this.csrfToken !== null && this.csrfToken !== undefined;
  }

  async get<T extends ParseMethod = 'json'>(requestConfig: RequestConfig & { parseMethod?: T }) {
    return this.request({ ...requestConfig, method: 'GET' });
  }

  async delete<T extends ParseMethod = 'json'>(requestConfig: RequestConfig & { parseMethod?: T }) {
    return this.request({ ...requestConfig, method: 'DELETE' });
  }

  async put<T extends ParseMethod = 'json'>(requestConfig: RequestConfig & { parseMethod?: T }) {
    return this.request({ ...requestConfig, method: 'PUT' });
  }

  async post<T extends ParseMethod = 'json'>(requestConfig: RequestConfig & { parseMethod?: T }) {
    return this.request({ ...requestConfig, method: 'POST' });
  }

  async request<T extends ParseMethod = 'json'>({
    body,
    credentials,
    endpoint,
    fetchRetryOptions,
    headers,
    host,
    method,
    mode,
    parseMethod,
    postPayload,
    jsonPayload,
    signal,
    stringify,
    timeout,
    url,
  }: RequestConfig & { parseMethod?: T }) {
    await this.ensureAuth();
    return callApiAndParseWithTimeout({
      body,
      credentials: credentials ?? this.credentials,
      fetchRetryOptions,
      headers: { ...this.headers, ...headers },
      method,
      mode: mode ?? this.mode,
      parseMethod,
      postPayload,
      jsonPayload,
      signal,
      stringify,
      timeout: timeout ?? this.timeout,
      url: this.getUrl({ endpoint, host, url }),
    });
  }

  async ensureAuth(): CsrfPromise {
    return (
      this.csrfPromise ??
      Promise.reject({
        error: `SupersetClient has not been provided a CSRF token, ensure it is
        initialized with \`client.getCSRFToken()\` or try logging in at
        ${this.getUrl({ endpoint: '/login' })}`,
      })
    );
  }

  async getCSRFToken() {
    this.csrfToken = undefined;
    // If we can request this resource successfully, it means that the user has
    // authenticated. If not we throw an error prompting to authenticate.
    this.csrfPromise = callApiAndParseWithTimeout({
      credentials: this.credentials,
      headers: {
        ...this.headers,
      },
      method: 'GET',
      mode: this.mode,
      timeout: this.timeout,
      url: this.getUrl({ endpoint: 'superset/csrf_token/' }),
      parseMethod: 'json',
    }).then(({ json }) => {
      if (typeof json === 'object') {
        this.csrfToken = json.csrf_token as string;
        if (typeof this.csrfToken === 'string') {
          this.headers = { ...this.headers, 'X-CSRFToken': this.csrfToken };
        }
      }
      if (this.isAuthenticated()) {
        return this.csrfToken;
      }
      return Promise.reject({ error: 'Failed to fetch CSRF token' });
    });
    return this.csrfPromise;
  }

  getUrl({
    host: inputHost,
    endpoint = '',
    url,
  }: {
    endpoint?: string;
    host?: Host;
    url?: string;
  } = {}) {
    if (typeof url === 'string') return url;

    const host = inputHost ?? this.host;
    const cleanHost = host.slice(-1) === '/' ? host.slice(0, -1) : host; // no backslash

    return `${this.protocol}//${cleanHost}/${endpoint[0] === '/' ? endpoint.slice(1) : endpoint}`;
  }
}
