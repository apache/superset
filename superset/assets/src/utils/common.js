import { SupersetClient } from '@superset-ui/connection';
import getClientErrorObject from './getClientErrorObject';

export const LUMINANCE_RED_WEIGHT = 0.2126;
export const LUMINANCE_GREEN_WEIGHT = 0.7152;
export const LUMINANCE_BLUE_WEIGHT = 0.0722;

export function rgbLuminance(r, g, b) {
  // Formula: https://en.wikipedia.org/wiki/Relative_luminance
  return LUMINANCE_RED_WEIGHT * r + LUMINANCE_GREEN_WEIGHT * g + LUMINANCE_BLUE_WEIGHT * b;
}

export function getParamFromQuery(query, param) {
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i += 1) {
    const pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === param) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}

export function storeQuery(query) {
  return SupersetClient.post({
    endpoint: '/kv/store/',
    postPayload: { data: query },
  }).then((response) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?id=${response.json.id}`;
    return url;
  });
}

export function getParamsFromUrl() {
  const hash = window.location.search;
  const params = hash.split('?')[1].split('&');
  const newParams = {};
  params.forEach((p) => {
    const value = p.split('=')[1].replace(/\+/g, ' ');
    const key = p.split('=')[0];
    newParams[key] = value;
  });
  return newParams;
}

export function getShortUrl(longUrl) {
  return SupersetClient.post({
    endpoint: '/r/shortner/',
    postPayload: { data: `/${longUrl}` }, // note: url should contain 2x '/' to redirect properly
    parseMethod: 'text',
    stringify: false, // the url saves with an extra set of string quotes without this
  })
    .then(({ text }) => text)
    .catch(response =>
      getClientErrorObject(response)
        .then(({ error, statusText }) => Promise.reject(error || statusText)));
}

export function supersetURL(rootUrl, getParams = {}) {
  const url = new URL(rootUrl, window.location.origin);
  for (const k in getParams) {
    url.searchParams.set(k, getParams[k]);
  }
  return url.href;
}

export function isTruthy(obj) {
  if (typeof obj === 'boolean') {
    return obj;
  } else if (typeof obj === 'string') {
    return ['yes', 'y', 'true', 't', '1'].indexOf(obj.toLowerCase()) >= 0;
  }
  return !!obj;
}

export function optionLabel(opt) {
  if (opt === null) {
    return '<NULL>';
  } else if (opt === '') {
    return '<empty string>';
  } else if (opt === true) {
    return '<true>';
  } else if (opt === false) {
    return '<false>';
  } else if (typeof opt !== 'string' && opt.toString) {
    return opt.toString();
  }
  return opt;
}

export function optionValue(opt) {
  if (opt === null) {
    return '<NULL>';
  }
  return opt;
}

export function optionFromValue(opt) {
  // From a list of options, handles special values & labels
  return { value: optionValue(opt), label: optionLabel(opt) };
}
