/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
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
import { DEFAULT_FETCH_RETRY_OPTIONS, DEFAULT_APP_ROOT } from './constants';

const defaultUnauthorizedHandlerForPrefix = (appRoot: string) => () => {
  if (!window.location.pathname.startsWith(`${appRoot}/login`)) {
    window.location.href = `${appRoot}/login?next=${window.location.href}`;
  }
};

export default class SupersetClientClass {
  credentials: Credentials;

  csrfToken?: CsrfToken;

  csrfPromise?: CsrfPromise;

  guestToken?: string;

  guestTokenHeaderName: string;

  fetchRetryOptions?: FetchRetryOptions;

  appRoot?: string;

  protocol: Protocol;

  host: Host;

  headers: Headers;

  mode: Mode;

  timeout: ClientTimeout;

  handleUnauthorized: () => void;

  constructor({
    host,
    protocol,
    appRoot = DEFAULT_APP_ROOT,
    headers = {},
    fetchRetryOptions = {},
    mode = 'same-origin',
    timeout,
    credentials = undefined,
    csrfToken = undefined,
    guestToken = undefined,
    guestTokenHeaderName = 'X-GuestToken',
    unauthorizedHandler = undefined,
  }: ClientConfig = {}) {
    const url = new URL(`${protocol || 'https:'}//${host || 'localhost'}`);
    this.appRoot = appRoot;
    this.host = url.host;
    this.protocol = url.protocol as Protocol;
    this.headers = { Accept: 'application/json', ...headers }; // defaulting accept to json
    this.mode = mode;
    this.timeout = timeout;
    this.credentials = credentials;
    this.csrfToken = csrfToken;
    this.guestToken = guestToken;
    this.guestTokenHeaderName = guestTokenHeaderName;
    this.fetchRetryOptions = {
      ...DEFAULT_FETCH_RETRY_OPTIONS,
      ...fetchRetryOptions,
    };
    if (typeof this.csrfToken === 'string') {
      this.headers = { ...this.headers, 'X-CSRFToken': this.csrfToken };
      this.csrfPromise = Promise.resolve(this.csrfToken);
    }
    if (guestToken) {
      this.headers[guestTokenHeaderName] = guestToken;
    }
    this.handleUnauthorized =
      unauthorizedHandler !== undefined
        ? unauthorizedHandler
        : defaultUnauthorizedHandlerForPrefix(this.appRoot);
  }

  async init(force = false): CsrfPromise {
    if (this.isAuthenticated() && !force) {
      return this.csrfPromise as CsrfPromise;
    }
    return this.getCSRFToken();
  }

  async postForm(
    endpoint: string,
    payload: Record<string, any>,
    target = '_blank',
  ) {
    if (endpoint) {
      await this.ensureAuth();
      const hiddenForm = document.createElement('form');
      hiddenForm.action = this.getUrl({ endpoint });
      hiddenForm.method = 'POST';
      hiddenForm.target = target;
      const payloadWithToken: Record<string, any> = {
        ...payload,
        csrf_token: this.csrfToken!,
      };

      if (this.guestToken) {
        payloadWithToken.guest_token = this.guestToken;
      }

      Object.entries(payloadWithToken).forEach(([key, value]) => {
        const data = document.createElement('input');
        data.type = 'hidden';
        data.name = key;
        data.value = value;
        hiddenForm.appendChild(data);
      });

      document.body.appendChild(hiddenForm);
      hiddenForm.submit();
      document.body.removeChild(hiddenForm);
    }
  }

  async reAuthenticate() {
    return this.init(true);
  }

  isAuthenticated(): boolean {
    // if CSRF protection is disabled in the Superset app, the token may be an empty string
    return this.csrfToken !== null && this.csrfToken !== undefined;
  }

  getGuestToken() {
    return this.guestToken;
  }

  async get<T extends ParseMethod = 'json'>(
    requestConfig: RequestConfig & { parseMethod?: T },
  ) {
    return this.request({ ...requestConfig, method: 'GET' });
  }

  async delete<T extends ParseMethod = 'json'>(
    requestConfig: RequestConfig & { parseMethod?: T },
  ) {
    return this.request({ ...requestConfig, method: 'DELETE' });
  }

  async put<T extends ParseMethod = 'json'>(
    requestConfig: RequestConfig & { parseMethod?: T },
  ) {
    return this.request({ ...requestConfig, method: 'PUT' });
  }

  async post<T extends ParseMethod = 'json'>(
    requestConfig: RequestConfig & { parseMethod?: T },
  ) {
    return this.request({ ...requestConfig, method: 'POST' });
  }

  async request<T extends ParseMethod = 'json'>({
    credentials,
    mode,
    endpoint,
    host,
    url,
    headers,
    timeout,
    fetchRetryOptions,
    ignoreUnauthorized = false,
    ...rest
  }: RequestConfig & { parseMethod?: T }) {
    await this.ensureAuth();
    return callApiAndParseWithTimeout({
      ...rest,
      credentials: credentials ?? this.credentials,
      mode: mode ?? this.mode,
      url: this.getUrl({ endpoint, host, url }),
      headers: { ...this.headers, ...headers },
      timeout: timeout ?? this.timeout,
      fetchRetryOptions: fetchRetryOptions ?? this.fetchRetryOptions,
    }).catch(res => {
      if (res?.status === 401 && !ignoreUnauthorized) {
        this.handleUnauthorized();
      }
      return Promise.reject(res);
    });
  }

  async ensureAuth(): CsrfPromise {
    return (
      this.csrfPromise ??
      // eslint-disable-next-line prefer-promise-reject-errors
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
      url: this.getUrl({ endpoint: '/api/v1/security/csrf_token/' }),
      parseMethod: 'json',
    }).then(({ json }) => {
      if (typeof json === 'object') {
        this.csrfToken = json.result as string;
        if (typeof this.csrfToken === 'string') {
          this.headers = { ...this.headers, 'X-CSRFToken': this.csrfToken };
        }
      }
      if (this.isAuthenticated()) {
        return this.csrfToken;
      }
      // eslint-disable-next-line prefer-promise-reject-errors
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

    return `${this.protocol}//${cleanHost}${this.appRoot}/${
      endpoint[0] === '/' ? endpoint.slice(1) : endpoint
    }`;
  }
}
