import 'whatwg-fetch';

const DEFAULT_HEADERS = null;

// This function fetches an API response and returns the corresponding json
export default function callApi({
  url,
  method = 'GET', // GET, POST, PUT, DELETE
  mode = 'same-origin', // no-cors, cors, same-origin
  cache = 'default', // default, no-cache, reload, force-cache, only-if-cached
  credentials = 'same-origin', // include, same-origin, omit
  headers: partialHeaders,
  body,
  postPayload,
  stringify = true,
  redirect = 'follow', // manual, follow, error
  signal, // used for aborting
}) {
  let request = {
    body,
    cache,
    credentials,
    headers: { ...DEFAULT_HEADERS, ...partialHeaders },
    method,
    mode,
    redirect,
    signal,
  };

  if (method === 'POST' && typeof postPayload === 'object') {
    // using FormData has the effect that Content-Type header is set to `multipart/form-data`,
    // not e.g., 'application/x-www-form-urlencoded'
    const formData = new FormData();
    Object.keys(postPayload).forEach(key => {
      const value = postPayload[key];
      if (typeof value !== 'undefined') {
        formData.append(key, stringify ? JSON.stringify(postPayload[key]) : postPayload[key]);
      }
    });

    request = {
      ...request,
      body: formData,
    };
  }

  return fetch(url, request); // eslint-disable-line compat/compat
}
