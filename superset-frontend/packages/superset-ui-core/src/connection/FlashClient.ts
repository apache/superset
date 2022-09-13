/*
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

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

enum StatusCode {
  Unauthorized = 401,
  Forbidden = 403,
  TooManyRequests = 429,
  InternalServerError = 500,
}

const headers: Readonly<Record<string, string | boolean>> = {
  Accept: 'application/json',
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Credentials': true,
  'X-Requested-With': 'XMLHttpRequest',
  'Access-Control-Allow-Origin' : "*"

};

// 'Access-Control-Allow-Origin' : '*',
// 'Access-Control-Allow-Headers':'content-type, access-control-allow-credentials,x-requested-with',
// 'access-control-allow-methods' : 'PUT, GET, HEAD, POST, DELETE, OPTIONS, PATCH'
// We can use the following function to inject the JWT token through an interceptor
// We get the `accessToken` from the localStorage that we set when we authenticate

// const injectToken = (config: AxiosRequestConfig): AxiosRequestConfig => {
//   try {
//     const token = localStorage.getItem('accessToken');

//     if (token != null) {
//       config &&
//       config.headers &&
//         (config.headers.Authorization = `Bearer ${token}`);
//     }
//     return config;
//   } catch (error) {
//     throw new Error(error);
//   }
// };

class FlashClientClass {
  private instance: AxiosInstance | null = null;

  private get http(): AxiosInstance {
    return this.instance != null ? this.instance : this.initHttp();
  }

  // CREATING SINGLETON INSTANCE
  private static singletonInstance: FlashClientClass | undefined;

  public static getInstance(): FlashClientClass {
    if (!FlashClientClass.singletonInstance) {
      FlashClientClass.singletonInstance = new FlashClientClass();
    }

    return FlashClientClass.singletonInstance;
  }

  initHttp() {
    const http = axios.create({
      baseURL: 'https://flash-api.dev.careem-rh.com/',
      headers,
      // withCredentials: true,
    });

    // http.interceptors.request.use(injectToken, (error:any) => Promise.reject(error));

    http.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        const { response } = error;
        return this.handleError(response);
      },
    );

    this.instance = http;
    return http;
  }

  request<T = any, R = AxiosResponse<T>>(
    config: AxiosRequestConfig,
  ): Promise<R> {
    return this.http.request(config);
  }

  get<T = any, R = AxiosResponse<T>>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return this.http.get<T, R>(url, config);
  }

  post<T = any, R = AxiosResponse<T>>(
    url: string,
    data?: T,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    console.log('FLASH CLIENT POST');
    return this.http.post<T, R>(url, data, config);
  }

  put<T = any, R = AxiosResponse<T>>(
    url: string,
    data?: T,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return this.http.put<T, R>(url, data, config);
  }

  patch<T = any, R = AxiosResponse<T>>(
    url: string,
    data?: T,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return this.http.patch<T, R>(url, data, config);
  }

  delete<T = any, R = AxiosResponse<T>>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return this.http.delete<T, R>(url, config);
  }

  // Handle global app errors
  // We can handle generic app errors depending on the status code
  private handleError(error: any) {
    const { status } = error;

    switch (status) {
      case StatusCode.InternalServerError: {
        // Handle InternalServerError
        break;
      }
      case StatusCode.Forbidden: {
        // Handle Forbidden
        break;
      }
      case StatusCode.Unauthorized: {
        // Handle Unauthorized
        break;
      }
      case StatusCode.TooManyRequests: {
        // Handle TooManyRequests
        break;
      }
      default:
        break;
    }

    return Promise.reject(error);
  }
}

export default FlashClientClass.getInstance();