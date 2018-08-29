/* global FormData, fetch */
import 'whatwg-fetch';
import 'abortcontroller-polyfill';
import 'url-search-params-polyfill';

const DEFAULT_HEADERS = {};

// This function fetches an API response and returns the corresponding json
export function callApi({
  url,
  method = 'GET', // GET, POST, PUT, DELETE
  mode = 'same-origin', // no-cors, cors, same-origin
  cache = 'default', // default, no-cache, reload, force-cache, only-if-cached
  credentials = 'include', // include, same-origin, omit
  headers: partialHeaders,
  body,
  postPayload,
  stringify = true,
  redirect = 'follow', // manual, follow, error
  timeoutId,
  signal, // used for aborting
}) {
  const headers = { ...DEFAULT_HEADERS, ...partialHeaders };
  let request = { method, mode, cache, credentials, redirect, headers, body, signal };

  if (method === 'POST' && typeof postPayload === 'object') {
    const formData = new FormData();
    Object.keys(postPayload).forEach((key) => {
      const value = postPayload[key];
      if (typeof value !== 'undefined') {
        formData.append(key, stringify ? JSON.stringify(postPayload[key]) : postPayload[key]);
      }
    });

    request = {
      ...request,
      body: formData, // new URLSearchParams(formData),
    };
  }

  return fetch(url, request)
    .then(
      (response) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        return response
          .clone()
          .json() // first try to parse as json, fall back to text
          .catch(() => /* jsonParseError */ response.text().then(textPayload => ({ textPayload })))
          .then(json => ({
            response,
            text: json.textPayload,
            json: json.textPayload ? null : json,
          }));
      },
      (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        return Promise.reject({
          error: error.error || error.message || 'An error occurred',
          status: error.status || error.code,
          statusText: error.statusText || error.name,
          link: error.link,
        });
      },
    )
    .then(({ response, json, text }) => {
      if (!response.ok) {
        return Promise.reject({
          error: (json && json.error) || text || 'An error occurred',
          status: response.status,
          statusText: response.statusText,
        });
      }

      if (typeof text !== 'undefined') {
        return { response, text };
      }

      return { response, json };
    });
}

// Fetch does not support timeout natively, so we add a layer with it.
// We pass the timeoutId to callApi so that it can clear it
export default function callApiWithTimeout({ timeout, ...rest }) {
  let timeoutId;

  return Promise.race([
    callApi({ ...rest, timeoutId }),
    new Promise((_, reject) => {
      if (typeof timeout === 'number') {
        timeoutId = setTimeout(
          () =>
            reject({
              error: 'Request timed out',
              statusText: 'timeout',
            }),
          timeout,
        );
      }
    }),
  ]);
}
