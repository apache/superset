/* eslint-disable no-console */
import axios, { AxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import { InitConfig } from '../types/global';
import { APIStore } from './store/index';
import { API_V1, SUPERSET_ENDPOINT } from '../constants';

const csrfNode = document.querySelector<HTMLInputElement>('#csrf_token');
const csrfToken = csrfNode ? csrfNode.value : '';

const logger = (params: AxiosRequestConfig) => {
  console.groupCollapsed(`${params.url} [${params.method}]`);
  console.log('data', params.data);
  console.log('data JSON:', JSON.stringify(params.data));
  console.log('headers', params.headers);
  console.log('headers JSON:', JSON.stringify(params.headers));
  console.groupEnd();
};

export const API_HANDLER = {
  // TODO: move to store, finish logic
  errorObject: null,

  async authanticateInDodoInner() {
    try {
      const APIState = APIStore.getState();
      const { FRONTEND_LOGGER } = APIState.configReducer;

      const FULL_URL = `${APIState.configReducer.ORIGIN_URL}${API_V1}/security/login`;

      const params = {
        method: 'post' as AxiosRequestConfig['method'],
        data: APIState.configReducer.CREDS,
        headers: {},
        url: FULL_URL,
      };

      if (FRONTEND_LOGGER) logger(params);

      const {
        data,
        data: { access_token },
      } = await axios({ ...params });

      APIStore.dispatch({ type: 'auth/updateJWT', payload: access_token });
      return data;
    } catch (error) {
      console.log('authanticateInDodoInner', error);
      this.errorObject = error;
      throw error;
    }
  },

  async getCSRFToken({ useAuth }: { useAuth: boolean }) {
    try {
      const APIState = APIStore.getState();
      const { FRONTEND_LOGGER } = APIState.configReducer;

      const FULL_URL = `${APIState.configReducer.ORIGIN_URL}${API_V1}/security/csrf_token/`;

      let params = {
        method: 'get' as AxiosRequestConfig['method'],
        data: {},
        headers: {},
        url: FULL_URL,
      };

      if (useAuth) {
        params = {
          ...params,
          headers: {
            Authorization: APIState.authReducer.Authorization,
          },
        };
      }

      if (FRONTEND_LOGGER) logger(params);

      const {
        data,
        data: { result },
      } = await axios({ ...params });

      const finalCsrfToken = result || csrfToken;

      APIStore.dispatch({ type: 'auth/updateCSRF', payload: finalCsrfToken });

      const csrfOnThePage = document.getElementById('csrf_token');

      if (!csrfOnThePage) {
        const csrfTokenElement = document.createElement('input');
        csrfTokenElement.type = 'hidden';
        csrfTokenElement.name = 'csrf_token';
        csrfTokenElement.value = finalCsrfToken;
        csrfTokenElement.id = 'csrf_token';
        document.body.appendChild(csrfTokenElement);
      } else {
        csrfOnThePage.setAttribute('value', finalCsrfToken);
      }

      return data;
    } catch (error) {
      console.log('getCSRFToken', error);
      this.errorObject = error;
      throw error;
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
  ): Promise<any> {
    const APIState = APIStore.getState();
    const { FRONTEND_LOGGER } = APIState.configReducer;

    const FULL_URL = `${originUrl}${url}`;

    const params = {
      method,
      data: data || {},
      headers: {
        ...headers,
        'x-csrftoken': APIState.authReducer['x-csrftoken'],
        // in production mode it is NOT used
        Authorization: APIState.authReducer.Authorization,
      },
      url: FULL_URL,
    };

    if (FRONTEND_LOGGER) logger(params);

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
    headers,
  }: {
    method: AxiosRequestConfig['method'];
    url: AxiosRequestConfig['url'];
    body?: Record<string, any> | string;
    headers?: AxiosRequestHeaders;
  }) {
    try {
      const APIState = APIStore.getState();
      const { ORIGIN_URL } = APIState.configReducer;

      if (url) {
        return API_HANDLER.sendRequest(
          `${ORIGIN_URL}${API_V1}`,
          url,
          method,
          body,
          headers,
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
  }: {
    method: AxiosRequestConfig['method'];
    url: AxiosRequestConfig['url'];
    body?: Record<string, any> | string;
    headers?: AxiosRequestHeaders;
  }) {
    try {
      const APIState = APIStore.getState();
      const { ORIGIN_URL } = APIState.configReducer;

      if (url) {
        const initialResponse = await API_HANDLER.sendRequest(
          `${ORIGIN_URL}${SUPERSET_ENDPOINT}`,
          url,
          method,
          body,
          headers,
        );

        return { result: [initialResponse] };
      }

      throw new Error('the URL was not provided in SupersetClientNoApi');
    } catch (error) {
      console.log('SupersetClientNoApi error', error);
      throw error;
    }
  },
};
