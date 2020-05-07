import SupersetClientClass from './SupersetClientClass';

export type Body = RequestInit['body'];
export type Cache = RequestInit['cache'];
export type Credentials = RequestInit['credentials'];
export type Endpoint = string;
export type FetchRetryOptions = {
  retries?: number;
  retryDelay?: number | ((attempt: number, error: Error, response: Response) => number);
  retryOn?: number[] | ((attempt: number, error: Error, response: Response) => boolean);
};
export type Headers = { [k: string]: string };
export type Host = string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = { [k: string]: any };
export type Method = RequestInit['method'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PostPayload = { [key: string]: any };
export type Mode = RequestInit['mode'];
export type Redirect = RequestInit['redirect'];
export type ClientTimeout = number | undefined;
export type ParseMethod = 'json' | 'text' | null;
export type Signal = RequestInit['signal'];
export type Stringify = boolean;
export type Url = string;

export interface CallApi {
  body?: Body;
  cache?: Cache;
  credentials?: Credentials;
  fetchRetryOptions?: FetchRetryOptions;
  headers?: Headers;
  method?: Method;
  mode?: Mode;
  postPayload?: PostPayload;
  redirect?: Redirect;
  signal?: Signal;
  stringify?: Stringify;
  url: Url;
}

export interface RequestBase {
  body?: Body;
  credentials?: Credentials;
  fetchRetryOptions?: FetchRetryOptions;
  headers?: Headers;
  host?: Host;
  mode?: Mode;
  method?: Method;
  parseMethod?: ParseMethod;
  postPayload?: PostPayload;
  signal?: Signal;
  stringify?: Stringify;
  timeout?: ClientTimeout;
}

export interface RequestWithEndpoint extends RequestBase {
  endpoint: Endpoint;
  url?: undefined;
}

export interface RequestWithUrl extends RequestBase {
  url: Url;
  endpoint?: undefined;
}

export type RequestConfig = RequestWithEndpoint | RequestWithUrl;

export interface JsonTextResponse {
  json?: Json;
  response: Response;
  text?: string;
}

export type CsrfToken = string;
export type CsrfPromise = Promise<string | undefined>;
export type Protocol = 'http:' | 'https:';

export interface ClientConfig {
  credentials?: Credentials;
  csrfToken?: CsrfToken;
  fetchRetryOptions?: FetchRetryOptions;
  headers?: Headers;
  host?: Host;
  protocol?: Protocol;
  mode?: Mode;
  timeout?: ClientTimeout;
}

export interface SupersetClientInterface {
  configure: (config?: ClientConfig) => SupersetClientClass;
  delete: (request: RequestConfig) => Promise<SupersetClientResponse>;
  get: (request: RequestConfig) => Promise<SupersetClientResponse>;
  getInstance: (maybeClient?: SupersetClientClass) => SupersetClientClass;
  init: (force?: boolean) => Promise<string | undefined>;
  isAuthenticated: () => boolean;
  post: (request: RequestConfig) => Promise<SupersetClientResponse>;
  put: (request: RequestConfig) => Promise<SupersetClientResponse>;
  reAuthenticate: () => Promise<string | undefined>;
  request: (request: RequestConfig) => Promise<SupersetClientResponse>;
  reset: () => void;
}

export type SupersetClientResponse = Response | JsonTextResponse;
