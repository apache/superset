// DODO was here
// DODO created 44611022
import axios, {
  AxiosHeaders,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  ResponseType,
} from 'axios';
import { API_V1, SUPERSET_ENDPOINT } from './constants';
import { logger, handleCsrfToken } from './utils';
import { PlainObject } from '../../chart';

export { API_V1, SUPERSET_ENDPOINT };

type Payload = PlainObject | string | null;

type AuthType = {
  Authorization: string;
  'x-csrftoken': string;
  token: string;
  csrfToken: string;
};
type ConfigType = {
  ORIGIN_URL: string;
  ENV: string;
  CREDS: {
    username: string;
    password: string;
    provider: string;
  };
  FRONTEND_LOGGER: boolean;
};

class ApiHandler {
  private auth: AuthType;

  private config: ConfigType;

  constructor(initialConfig?: Partial<ConfigType>) {
    this.auth = {
      Authorization: '',
      'x-csrftoken': '',
      token: '',
      csrfToken: '',
    };

    this.config = {
      ORIGIN_URL: '',
      ENV: '',
      CREDS: {
        username: '',
        password: '',
        provider: '',
      },
      FRONTEND_LOGGER: false,
      ...initialConfig, // Merge initialConfig if provided
    };
  }

  // private errorObject: any = null;

  setConfig(config: Partial<ConfigType>) {
    this.config = { ...this.config, ...config };
  }

  setToken(accessToken: string) {
    this.auth.token = accessToken;
    this.auth.Authorization = `Bearer ${accessToken}`;
  }

  async authanticateInDodoInner() {
    const { FRONTEND_LOGGER, ORIGIN_URL, CREDS } = this.config;
    const FULL_URL = `${ORIGIN_URL}${API_V1}/security/login`;

    const params = {
      method: 'post' as AxiosRequestConfig['method'],
      data: CREDS,
      headers: {},
      url: FULL_URL,
    };

    logger(params, FRONTEND_LOGGER);

    try {
      const {
        data,
        data: { access_token },
      } = await axios(params);
      this.auth.token = access_token;
      this.auth.Authorization = `Bearer ${access_token}`;
      return data;
    } catch (error) {
      // this.errorObject = error;
      return error;
    }
  }

  async getCSRFToken({ useAuth }: { useAuth: boolean }) {
    const { FRONTEND_LOGGER, ORIGIN_URL } = this.config;
    const { Authorization } = this.auth;

    const FULL_URL = `${ORIGIN_URL}${API_V1}/security/csrf_token/`;
    const headers: AxiosRequestHeaders = new AxiosHeaders();

    if (useAuth && Authorization) {
      headers.set('Authorization', Authorization);
    }

    const params = {
      method: 'get' as AxiosRequestConfig['method'],
      headers,
      url: FULL_URL,
    };

    logger(params, FRONTEND_LOGGER);

    try {
      const {
        data,
        data: { result },
      } = await axios(params);

      const csrfNode = document.querySelector<HTMLInputElement>('#csrf_token');
      const csrfToken = csrfNode ? csrfNode.value : '';
      this.auth.csrfToken = result || csrfToken;

      handleCsrfToken(this.auth.csrfToken);
      return data;
    } catch (error) {
      // this.errorObject = error;
      return error;
    }
  }

  private async sendRequest(
    originUrl: string,
    url: AxiosRequestConfig['url'],
    method: AxiosRequestConfig['method'],
    data?: AxiosRequestConfig['data'],
    headers: AxiosRequestHeaders = new AxiosHeaders(),
    responseType?: ResponseType,
  ) {
    const { FRONTEND_LOGGER } = this.config;
    const FULL_URL = `${originUrl}${url}`;

    headers.set('x-csrftoken', this.auth.csrfToken);
    if (this.auth.Authorization) {
      headers.set('Authorization', this.auth.Authorization);
    }

    const params: AxiosRequestConfig = {
      method,
      responseType,
      data: data || {},
      headers,
      url: FULL_URL,
    };
    logger(params, FRONTEND_LOGGER);

    return axios(params)
      .then(
        ({ data }) =>
          // this.errorObject = null;
          data,
      )
      .catch(error => {
        console.error('Error in API_HANDLER.sendRequest', error);
        // this.errorObject = error;
        return error;
      });
  }

  SupersetClient({
    method,
    url,
    body,
    jsonPayload,
    headers,
    responseType,
  }: {
    method: AxiosRequestConfig['method'];
    url: AxiosRequestConfig['url'];
    body?: Record<string, any> | string;
    jsonPayload?: Payload;
    headers?: AxiosRequestHeaders;
    responseType?: ResponseType;
  }) {
    const { ORIGIN_URL } = this.config;
    let finalBody = body;
    const finalHeaders = new AxiosHeaders(headers);

    if (jsonPayload !== undefined) {
      finalBody = JSON.stringify(jsonPayload);
      finalHeaders.set('Content-Type', 'application/json');
    }

    if (!url) {
      throw new Error('The URL was not provided in SupersetClient');
    }

    const cleanedUrl = url.replace(/https?:\/\/\//, '/'); // for /explore_json

    return this.sendRequest(
      ORIGIN_URL,
      cleanedUrl,
      method,
      finalBody,
      finalHeaders,
      responseType,
    );
  }

  async SupersetClientNoApi({
    method,
    url,
    body,
    headers,
    responseType,
  }: {
    method: AxiosRequestConfig['method'];
    url: AxiosRequestConfig['url'];
    body?: Record<string, any> | string;
    headers?: AxiosRequestHeaders;
    responseType?: ResponseType;
  }) {
    const { ORIGIN_URL } = this.config;
    const cleanedUrl = url?.replace(/(http|https):\/\/\/superset/, '');

    if (!cleanedUrl) {
      throw new Error(
        `The URL was not provided in SupersetClientNoApi [${url}], [${cleanedUrl}]`,
      );
    }

    const initialResponse = await this.sendRequest(
      `${ORIGIN_URL}${SUPERSET_ENDPOINT}`,
      cleanedUrl,
      method,
      body,
      headers,
      responseType,
    );

    return { result: [initialResponse] };
  }
}

export const API_HANDLER = new ApiHandler();
