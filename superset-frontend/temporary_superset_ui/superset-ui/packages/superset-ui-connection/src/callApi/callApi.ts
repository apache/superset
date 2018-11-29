import 'whatwg-fetch';
import { CallApi } from '../types';

// This function fetches an API response and returns the corresponding json
export default function callApi({
  body,
  cache = 'default',
  credentials = 'same-origin',
  headers,
  method = 'GET',
  mode = 'same-origin',
  postPayload,
  redirect = 'follow',
  signal,
  stringify = true,
  url,
}: CallApi): Promise<Response> {
  const request = {
    body,
    cache,
    credentials,
    headers,
    method,
    mode,
    redirect,
    signal,
  };

  if (method === 'POST' && typeof postPayload === 'object') {
    // using FormData has the effect that Content-Type header is set to `multipart/form-data`,
    // not e.g., 'application/x-www-form-urlencoded'
    const formData: FormData = new FormData();

    Object.keys(postPayload).forEach(key => {
      const value = postPayload[key];
      if (typeof value !== 'undefined') {
        formData.append(key, stringify ? JSON.stringify(value) : value);
      }
    });

    request.body = formData;
  }

  return fetch(url, request); // eslint-disable-line compat/compat
}
