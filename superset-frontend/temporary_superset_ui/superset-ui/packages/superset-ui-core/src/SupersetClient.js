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
    this.csrfPromise = null;
  }

  isAuthenticated() {
    return this.didAuthSuccessfully;
  }

  init() {
    return this.getCSRFToken();
  }

  getCSRFToken() {
    // If we can request this resource successfully, it means that the user has
    // authenticated. If not we throw an error prompting to authenticate.
    this.csrfPromise = callApi({
      credentials: this.credentials,
      headers: {
        ...this.headers,
      },
      method: 'GET',
      mode: this.mode,
      timeout: this.timeout,
      url: this.getUrl({ endpoint: 'superset/csrf_token/', host: this.host }),
    }).then(response => {
      if (response.json) {
        this.csrfToken = response.json.csrf_token;
        this.headers = { ...this.headers, 'X-CSRFToken': this.csrfToken };
        this.didAuthSuccessfully = !!this.csrfToken;
      }

      if (!this.csrfToken) {
        return Promise.reject({ error: 'Failed to fetch CSRF token' });
      }

      return response;
    });

    return this.csrfPromise;
  }

  getUrl({ host = '', endpoint = '' }) {
    const cleanHost = host.slice(-1) === '/' ? host.slice(0, -1) : host; // no backslash

    return `${this.protocol}://${cleanHost}/${endpoint[0] === '/' ? endpoint.slice(1) : endpoint}`;
  }

  ensureAuth() {
    return (
      this.csrfPromise ||
      Promise.reject({
        error: `SupersetClient has no CSRF token, ensure it is initialized or
        try logging into the Superset instance at ${this.getUrl('/login')}`,
      })
    );
  }

  get({ body, credentials, headers, host, endpoint, mode, parseMethod, signal, timeout, url }) {
    return this.ensureAuth().then(() =>
      callApi({
        body,
        credentials: credentials || this.credentials,
        headers: { ...this.headers, ...headers },
        method: 'GET',
        mode: mode || this.mode,
        parseMethod,
        signal,
        timeout: timeout || this.timeout,
        url: url || this.getUrl({ endpoint, host: host || this.host }),
      }),
    );
  }

  post({
    credentials,
    headers,
    host,
    endpoint,
    mode,
    parseMethod,
    postPayload,
    signal,
    stringify,
    timeout,
    url,
  }) {
    return this.ensureAuth().then(() =>
      callApi({
        credentials: credentials || this.credentials,
        headers: { ...this.headers, ...headers },
        method: 'POST',
        mode: mode || this.mode,
        parseMethod,
        postPayload,
        signal,
        stringify,
        timeout: timeout || this.timeout,
        url: url || this.getUrl({ endpoint, host: host || this.host }),
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
  configure: config => {
    singletonClient = new SupersetClient(config || {});

    return singletonClient;
  },
  get: (...args) => hasInstance() && singletonClient.get(...args),
  init: () => hasInstance() && singletonClient.init(),
  isAuthenticated: () => hasInstance() && singletonClient.isAuthenticated(),
  post: (...args) => hasInstance() && singletonClient.post(...args),
  reAuthenticate: () => hasInstance() && singletonClient.getCSRFToken(),
  reset: () => {
    singletonClient = null;
  },
};

export { SupersetClient };

export default PublicAPI;
