export type Body = RequestInit['body'];
export type Cache = RequestInit['cache'];
export type Credentials = RequestInit['credentials'];
export type Endpoint = string;
export type Headers = { [k: string]: string };
export type Host = string;
export type Json = { [k: string]: any };
export type Method = RequestInit['method'];
export type PostPayload = { [key: string]: any };
export type Mode = RequestInit['mode'];
export type Redirect = RequestInit['redirect'];
export type ClientTimeout = number | undefined;
export type ParseMethod = 'json' | 'text';
export type Signal = RequestInit['signal'];
export type Stringify = boolean;
export type Url = string;

export interface CallApi {
  body?: Body;
  cache?: Cache;
  credentials?: Credentials;
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
  headers?: Headers;
  host?: Host;
  mode?: Mode;
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

export type SupersetClientResponse = Response | JsonTextResponse;
