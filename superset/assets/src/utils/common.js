/* eslint global-require: 0 */
import { SupersetClient } from '@superset-ui/core';
import { t } from '../locales';

const d3 = require('d3');

export const EARTH_CIRCUMFERENCE_KM = 40075.16;
export const LUMINANCE_RED_WEIGHT = 0.2126;
export const LUMINANCE_GREEN_WEIGHT = 0.7152;
export const LUMINANCE_BLUE_WEIGHT = 0.0722;
export const MILES_PER_KM = 1.60934;

// Regexp for the label added to time shifted series (1 hour offset, 2 days offset, etc.)
export const TIME_SHIFT_PATTERN = /\d+ \w+ offset/;

export function kmToPixels(kilometers, latitude, zoomLevel) {
  // Algorithm from: http://wiki.openstreetmap.org/wiki/Zoom_levels
  const latitudeRad = latitude * (Math.PI / 180);
  // Seems like the zoomLevel is off by one
  const kmPerPixel = (EARTH_CIRCUMFERENCE_KM * Math.cos(latitudeRad)) / Math.pow(2, zoomLevel + 9);
  return d3.round(kilometers / kmPerPixel, 2);
}

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
  }).then(({ text }) => text);
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

// Error messages used in many places across applications
export const COMMON_ERR_MESSAGES = {
  SESSION_TIMED_OUT: t('Your session timed out, please refresh your page and try again.'),
};
