import callApi from './callApi';

class SupersetClient {
  constructor(config) {
    const {
      protocol = 'http',
      host = '',
      headers = {},
      mode = 'same-origin',
      timeout,
      credentials,
    } = config;

    this.headers = headers;
    this.host = host.slice(-1) === '/' ? host.slice(0, -1) : host; // no backslash
    this.mode = mode;
    this.timeout = timeout;
    this.protocol = protocol;
    this.credentials = credentials;
    this.csrfToken = null;
    this.didAuthSuccessfully = false;
    this.requestingCsrf = false;
  }

  isAuthorized() {
    return this.didAuthSuccessfully;
  }

  init() {
    return this.getCSRFToken();
  }

  getCSRFToken() {
    this.requestingCsrf = true;

    // If we can request this resource successfully, it means that the user has
    // authenticated. If not we throw an error prompting to authenticate.
    return callApi({
      url: this.getUrlFromEndpoint('superset/csrf_token/'),
      method: 'GET',
      headers: {
        ...this.headers,
      },
      mode: this.mode,
      timeout: this.timeout,
      credentials: this.credentials,
    })
      .then((response) => {
        if (response.json) {
          this.csrfToken = response.json.csrf_token;
          this.headers = { ...this.headers, 'X-CSRFToken': this.csrfToken };
          this.didAuthSuccessfully = !!this.csrfToken;
        }

        if (!this.csrfToken) {
          return Promise.reject({ error: 'Failed to fetch CSRF token' });
        }

        this.requestingCsrf = false;

        return response;
      })
      .catch(error => Promise.reject(error));
  }

  getUrlFromEndpoint(endpoint) {
    return `${this.protocol}://${this.host}/${endpoint[0] === '/' ? endpoint.slice(1) : endpoint}`;
  }

  getUnauthorizedError() {
    return {
      error: `No CSRF token, ensure you called client.init() or try logging into Superset instance at ${
        this.host
      }/login`,
    };
  }

  ensureAuth() {
    return new Promise((resolve, reject) => {
      if (this.didAuthSuccessfully) {
        return resolve();
      } else if (this.requestingCsrf) {
        const waitForCSRF = () => {
          if (!this.requestingCsrf && this.didAuthSuccessfully) {
            return resolve();
          } else if (!this.requestingCsrf && !this.didAuthSuccessfully) {
            return reject(this.getUnauthorizedError());
          }
          setTimeout(waitForCSRF, 30);
          return null;
        };
        return waitForCSRF();
      }

      return reject(this.getUnauthorizedError());
    });
  }

  get({ url, endpoint, headers, body, timeout, signal }) {
    return this.ensureAuth().then(() =>
      callApi({
        method: 'GET',
        url: url || this.getUrlFromEndpoint(endpoint),
        credentials: this.credentials,
        headers: { ...this.headers, ...headers },
        body,
        mode: this.mode,
        timeout: timeout || this.timeout,
        signal,
      }),
    );
  }

  post({ url, body, endpoint, headers, postPayload, timeout, signal, stringify }) {
    return this.ensureAuth().then(() =>
      callApi({
        method: 'POST',
        url: url || this.getUrlFromEndpoint(endpoint),
        credentials: this.credentials,
        headers: { ...this.headers, ...headers },
        body,
        postPayload,
        mode: this.mode,
        timeout: timeout || this.timeout,
        signal,
        stringify,
      }),
    );
  }
}

let singletonClient;

function hasInstance() {
  if (!singletonClient) {
    throw new Error('You must call SupersetClient.configure(...) before calling other methods');
  }
  return true;
}

const PublicAPI = {
  configure: (config) => {
    singletonClient = new SupersetClient(config || {});

    return singletonClient;
  },
  init: () => hasInstance() && singletonClient.init(),
  get: (...args) => hasInstance() && singletonClient.get(...args),
  post: (...args) => hasInstance() && singletonClient.post(...args),
  isAuthorized: () => hasInstance() && singletonClient.isAuthorized(),
};

export { SupersetClient };

export default PublicAPI;

// import SSClient from '@superset-ui/core';
//
// SSClient.configure();
// SSClient.init();
// SSClient.get();
// SSClient.post();
// SSClient.authorized();
