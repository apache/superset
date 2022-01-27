(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();import "core-js/modules/es.string.replace.js";import _URL from "@babel/runtime-corejs3/core-js-stable/url";var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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














import { DEFAULT_FETCH_RETRY_OPTIONS, DEFAULT_BASE_URL } from './constants';

export default class SupersetClientClass {




















  constructor({
    baseUrl = DEFAULT_BASE_URL,
    host,
    protocol,
    headers = {},
    fetchRetryOptions = {},
    mode = 'same-origin',
    timeout,
    credentials = undefined,
    csrfToken = undefined } =
  {}) {this.credentials = void 0;this.csrfToken = void 0;this.csrfPromise = void 0;this.fetchRetryOptions = void 0;this.baseUrl = void 0;this.protocol = void 0;this.host = void 0;this.headers = void 0;this.mode = void 0;this.timeout = void 0;
    const url = new _URL(
    host || protocol ?
    `${protocol || 'https:'}//${host || 'localhost'}` :
    baseUrl,
    // baseUrl for API could also be relative, so we provide current location.href
    // as the base of baseUrl
    window.location.href);

    this.baseUrl = url.href.replace(/\/+$/, ''); // always strip trailing slash
    this.host = url.host;
    this.protocol = url.protocol;
    this.headers = { Accept: 'application/json', ...headers }; // defaulting accept to json
    this.mode = mode;
    this.timeout = timeout;
    this.credentials = credentials;
    this.csrfToken = csrfToken;
    this.fetchRetryOptions = {
      ...DEFAULT_FETCH_RETRY_OPTIONS,
      ...fetchRetryOptions };

    if (typeof this.csrfToken === 'string') {
      this.headers = { ...this.headers, 'X-CSRFToken': this.csrfToken };
      this.csrfPromise = Promise.resolve(this.csrfToken);
    }
  }

  async init(force = false) {
    if (this.isAuthenticated() && !force) {
      return this.csrfPromise;
    }
    return this.getCSRFToken();
  }

  async reAuthenticate() {
    return this.init(true);
  }

  isAuthenticated() {
    // if CSRF protection is disabled in the Superset app, the token may be an empty string
    return this.csrfToken !== null && this.csrfToken !== undefined;
  }

  async get(
  requestConfig)
  {
    return this.request({ ...requestConfig, method: 'GET' });
  }

  async delete(
  requestConfig)
  {
    return this.request({ ...requestConfig, method: 'DELETE' });
  }

  async put(
  requestConfig)
  {
    return this.request({ ...requestConfig, method: 'PUT' });
  }

  async post(
  requestConfig)
  {
    return this.request({ ...requestConfig, method: 'POST' });
  }

  async request({
    credentials,
    mode,
    endpoint,
    host,
    url,
    headers,
    timeout,
    fetchRetryOptions,
    ...rest })
  {
    await this.ensureAuth();
    return callApiAndParseWithTimeout({
      ...rest,
      credentials: credentials != null ? credentials : this.credentials,
      mode: mode != null ? mode : this.mode,
      url: this.getUrl({ endpoint, host, url }),
      headers: { ...this.headers, ...headers },
      timeout: timeout != null ? timeout : this.timeout,
      fetchRetryOptions: fetchRetryOptions != null ? fetchRetryOptions : this.fetchRetryOptions }).
    catch((res) => {
      if ((res == null ? void 0 : res.status) === 401) {
        this.redirectUnauthorized();
      }
      return Promise.reject(res);
    });
  }

  async ensureAuth() {var _this$csrfPromise;
    return (_this$csrfPromise =
    this.csrfPromise) != null ? _this$csrfPromise :
    // eslint-disable-next-line prefer-promise-reject-errors
    Promise.reject({
      error: `SupersetClient has not been provided a CSRF token, ensure it is
        initialized with \`client.getCSRFToken()\` or try logging in at
        ${this.getUrl({ endpoint: '/login' })}` });


  }

  async getCSRFToken() {
    this.csrfToken = undefined;
    // If we can request this resource successfully, it means that the user has
    // authenticated. If not we throw an error prompting to authenticate.
    this.csrfPromise = callApiAndParseWithTimeout({
      credentials: this.credentials,
      headers: {
        ...this.headers },

      method: 'GET',
      mode: this.mode,
      timeout: this.timeout,
      url: this.getUrl({ endpoint: 'api/v1/security/csrf_token/' }),
      parseMethod: 'json' }).
    then(({ json }) => {
      if (typeof json === 'object') {
        this.csrfToken = json.result;
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
    url } =




  {}) {
    if (typeof url === 'string') return url;

    const host = inputHost != null ? inputHost : this.host;
    const cleanHost = host.slice(-1) === '/' ? host.slice(0, -1) : host; // no backslash

    return `${this.protocol}//${cleanHost}/${
    endpoint[0] === '/' ? endpoint.slice(1) : endpoint
    }`;
  }

  redirectUnauthorized() {
    window.location.href = `/login?next=${window.location.href}`;
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(SupersetClientClass, "SupersetClientClass", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/connection/SupersetClientClass.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();