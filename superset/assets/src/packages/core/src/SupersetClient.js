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
    this.host = host;
    this.mode = mode;
    this.timeout = timeout;
    this.protocol = protocol;
    this.credentials = credentials;
    this.csrfToken = null;
    this.didAuthSuccessfully = false;
    this.requestingCsrf = false;
  }

  isAuthenticated() {
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
      url: this.getUrl({ host: this.host, endpoint: 'superset/csrf_token/' }),
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

  getUrl({ host = '', endpoint }) {
    const cleanHost = host.slice(-1) === '/' ? host.slice(0, -1) : host; // no backslash
    return `${this.protocol}://${cleanHost}/${endpoint[0] === '/' ? endpoint.slice(1) : endpoint}`;
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

  get({ host, url, endpoint, mode, credentials, headers, body, timeout, signal }) {
    return this.ensureAuth().then(() =>
      callApi({
        method: 'GET',
        url: url || this.getUrl({ host: host || this.host, endpoint }),
        credentials: credentials || this.credentials,
        headers: { ...this.headers, ...headers },
        body,
        mode: mode || this.mode,
        timeout: timeout || this.timeout,
        signal,
      }),
    );
  }

  post({
    host,
    endpoint,
    url,
    mode,
    credentials,
    headers,
    postPayload,
    timeout,
    signal,
    stringify,
  }) {
    return this.ensureAuth().then(() =>
      callApi({
        method: 'POST',
        url: url || this.getUrl({ host: host || this.host, endpoint }),
        credentials: credentials || this.credentials,
        headers: { ...this.headers, ...headers },
        postPayload,
        mode: mode || this.mode,
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
  reset: () => {
    singletonClient = null;
  },
  configure: (config) => {
    singletonClient = new SupersetClient(config || {});

    return singletonClient;
  },
  init: () => hasInstance() && singletonClient.init(),
  get: (...args) => hasInstance() && singletonClient.get(...args),
  post: (...args) => hasInstance() && singletonClient.post(...args),
  isAuthenticated: () => hasInstance() && singletonClient.isAuthenticated(),
  reAuthenticate: () => hasInstance() && singletonClient.getCSRFToken(),
};

export { SupersetClient };

export default PublicAPI;
