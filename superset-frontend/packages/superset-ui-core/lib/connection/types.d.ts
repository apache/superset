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
import SupersetClientClass from './SupersetClientClass';
export declare type Body = RequestInit['body'];
export declare type Cache = RequestInit['cache'];
export declare type Credentials = RequestInit['credentials'];
export declare type Endpoint = string;
export declare type FetchRetryOptions = {
    retries?: number;
    retryDelay?: number | ((attempt: number, error: Error, response: Response) => number);
    retryOn?: number[] | ((attempt: number, error: Error, response: Response) => boolean);
};
export declare type Headers = {
    [k: string]: string;
};
export declare type Host = string;
export declare type JsonPrimitive = string | number | boolean | null;
/**
 * More strict JSON value types. If this fails to satisfy TypeScript when using
 * as function arguments, use `JsonObject` instead. `StrictJsonObject` helps make
 * sure all values are plain objects, but it does not accept specific types when
 * used as function arguments.
 * (Ref: https://github.com/microsoft/TypeScript/issues/15300).
 */
export declare type StrictJsonValue = JsonPrimitive | StrictJsonObject | StrictJsonArray;
export declare type StrictJsonArray = StrictJsonValue[];
/**
 * More strict JSON objects that makes sure all values are plain objects.
 * If this fails to satisfy TypeScript when using as function arguments,
 * use `JsonObject` instead.
 * (Ref: https://github.com/microsoft/TypeScript/issues/15300).
 */
export declare type StrictJsonObject = {
    [member: string]: StrictJsonValue;
};
export declare type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export declare type JsonArray = JsonValue[];
export declare type JsonObject = {
    [member: string]: any;
};
/**
 * Request payload, can be use in GET query string, Post form or POST JSON.
 * If string, will parse with JSON.parse.
 */
export declare type Payload = JsonObject | string | null;
export declare type Method = RequestInit['method'];
export declare type Mode = RequestInit['mode'];
export declare type Redirect = RequestInit['redirect'];
export declare type ClientTimeout = number | undefined;
export declare type ParseMethod = 'json' | 'text' | 'raw' | null | undefined;
export declare type Signal = RequestInit['signal'];
export declare type Stringify = boolean;
export declare type Url = string;
export interface RequestBase {
    body?: Body;
    credentials?: Credentials;
    fetchRetryOptions?: FetchRetryOptions;
    headers?: Headers;
    host?: Host;
    mode?: Mode;
    method?: Method;
    jsonPayload?: Payload;
    postPayload?: Payload | FormData;
    searchParams?: Payload | URLSearchParams;
    signal?: Signal;
    stringify?: Stringify;
    timeout?: ClientTimeout;
}
export interface CallApi extends RequestBase {
    url: Url;
    cache?: Cache;
    redirect?: Redirect;
}
export interface RequestWithEndpoint extends RequestBase {
    endpoint: Endpoint;
    url?: Url;
}
export interface RequestWithUrl extends RequestBase {
    url: Url;
    endpoint?: Endpoint;
}
export declare type RequestConfig = RequestWithEndpoint | RequestWithUrl;
export interface JsonResponse {
    response: Response;
    json: JsonObject;
}
export interface TextResponse {
    response: Response;
    text: string;
}
export declare type CsrfToken = string;
export declare type CsrfPromise = Promise<string | undefined>;
export declare type Protocol = 'http:' | 'https:';
export interface ClientConfig {
    baseUrl?: string;
    host?: Host;
    protocol?: Protocol;
    credentials?: Credentials;
    csrfToken?: CsrfToken;
    fetchRetryOptions?: FetchRetryOptions;
    headers?: Headers;
    mode?: Mode;
    timeout?: ClientTimeout;
}
export interface SupersetClientInterface extends Pick<SupersetClientClass, 'delete' | 'get' | 'post' | 'put' | 'request' | 'init' | 'isAuthenticated' | 'reAuthenticate'> {
    configure: (config?: ClientConfig) => SupersetClientClass;
    getInstance: (maybeClient?: SupersetClientClass) => SupersetClientClass;
    reset: () => void;
}
export declare type SupersetClientResponse = Response | JsonResponse | TextResponse;
declare const _default: {};
export default _default;
//# sourceMappingURL=types.d.ts.map