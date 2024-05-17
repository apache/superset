/* eslint-disable no-console */
import axios, { AxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import { InitConfig } from '../types/global';
import { APIStore } from './store/index';
import { API_V1, SUPERSET_ENDPOINT } from '../constants';
import { logger, handleCsrfToken } from './utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonObject = { [member: string]: any };
export type Payload = JsonObject | string | null;

export const API_HANDLER = {
  errorObject: null,

  async authanticateInDodoInner() {
    const APIState = APIStore.getState();
    const { FRONTEND_LOGGER, ORIGIN_URL, CREDS } = APIState.configReducer;

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
      } = await axios({ ...params });

      APIStore.dispatch({ type: 'auth/updateJWT', payload: access_token });
      return data;
    } catch (error) {
      this.errorObject = error;
      return error;
    }
  },

  async getCSRFToken({ useAuth }: { useAuth: boolean }) {
    const APIState = APIStore.getState();
    const { FRONTEND_LOGGER, ORIGIN_URL } = APIState.configReducer;
    const { Authorization } = APIState.authReducer;

    const FULL_URL = `${ORIGIN_URL}${API_V1}/security/csrf_token/`;

    let params = {
      method: 'get' as AxiosRequestConfig['method'],
      data: {},
      headers: {},
      url: FULL_URL,
    };

    if (useAuth) {
      params = {
        ...params,
        headers: { Authorization },
      };
    }

    logger(params, FRONTEND_LOGGER);

    try {
      const {
        data,
        data: { result },
      } = await axios({ ...params });

      const csrfNode = document.querySelector<HTMLInputElement>('#csrf_token');
      const csrfToken = csrfNode ? csrfNode.value : '';

      const finalCsrfToken = result || csrfToken;

      APIStore.dispatch({ type: 'auth/updateCSRF', payload: finalCsrfToken });

      handleCsrfToken(finalCsrfToken);

      return data;
    } catch (error) {
      this.errorObject = error;
      return error;
    }
  },

  setConfig(config: InitConfig) {
    const { originUrl, ENV, CREDS, FRONTEND_LOGGER, token } = config;

    if (originUrl) {
      APIStore.dispatch({ type: 'config/updateOriginUrl', payload: originUrl });
    }
    if (ENV) {
      APIStore.dispatch({ type: 'config/updateEnv', payload: ENV });
    }
    if (token) {
      APIStore.dispatch({ type: 'auth/updateJWT', payload: token });
    }
    if (CREDS) {
      APIStore.dispatch({ type: 'config/updateCreds', payload: CREDS });
    }
    if (FRONTEND_LOGGER) {
      APIStore.dispatch({
        type: 'config/updateFrontendLogger',
        payload: FRONTEND_LOGGER,
      });
    }
  },

  async sendRequest(
    originUrl: string,
    url: AxiosRequestConfig['url'],
    method: AxiosRequestConfig['method'],
    data?: AxiosRequestConfig['data'],
    headers?: AxiosRequestHeaders,
    responseType?: string,
  ): Promise<any> {
    const APIState = APIStore.getState();
    const { FRONTEND_LOGGER } = APIState.configReducer;
    const { Authorization } = APIState.authReducer;

    const FULL_URL = `${originUrl}${url}`;

    const params = {
      method,
      responseType,
      data: data || {},
      headers: {
        ...headers,
        'x-csrftoken': APIState.authReducer['x-csrftoken'],
        // in production mode it is NOT used
        Authorization,
      },
      url: FULL_URL,
    };

    // @ts-ignore
    logger(params, FRONTEND_LOGGER);

    // @ts-ignore
    return axios({ ...params })
      .then(({ data }: any) => {
        this.errorObject = null;
        return data;
      })
      .catch((data: any) => {
        console.error('Error in API_HANDLER.sendRequest', data);
        this.errorObject = data;
        return data;
      });
  },

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
    responseType?: string;
  }) {
    const APIState = APIStore.getState();
    const { ORIGIN_URL } = APIState.configReducer;

    let finalBody;
    let finalHeaders;

    if (jsonPayload !== undefined) {
      finalBody = JSON.stringify(jsonPayload);
      finalHeaders = {
        ...headers,
        'Content-Type': 'application/json',
      };
    }

    try {
      if (url) {
        return API_HANDLER.sendRequest(
          `${ORIGIN_URL}`,
          url,
          method,
          body || finalBody,
          // @ts-ignore
          headers || finalHeaders,
          responseType,
        );
      }

      throw new Error('the URL was not provided in SupersetClient');
    } catch (error) {
      console.log('SupersetClient error', error);
      throw error;
    }
  },

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
    responseType?: string;
  }) {
    const APIState = APIStore.getState();
    const { ORIGIN_URL } = APIState.configReducer;

    try {
      const cleanedUrl = url?.replace(/(http|https):\/\/\/superset/, '');

      if (cleanedUrl) {
        const initialResponse = await API_HANDLER.sendRequest(
          `${ORIGIN_URL}${SUPERSET_ENDPOINT}`,
          cleanedUrl,
          method,
          body,
          headers,
          responseType,
        );

        return { result: [initialResponse] };
      }

      throw new Error(
        `the URL was not provided in SupersetClientNoApi [${url}], [${cleanedUrl}]`,
      );
    } catch (error) {
      console.log('SupersetClientNoApi error', error);
      throw error;
    }
  },
};
