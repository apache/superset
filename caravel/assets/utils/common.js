/* eslint global-require: 0 */
const d3 = window.d3 || require('d3');

export const EARTH_CIRCUMFERENCE_KM = 40075.16;
export const LUMINANCE_RED_WEIGHT = 0.2126;
export const LUMINANCE_GREEN_WEIGHT = 0.7152;
export const LUMINANCE_BLUE_WEIGHT = 0.0722;
export const MILES_PER_KM = 1.60934;
export const DEFAULT_LONGITUDE = -122.405293;
export const DEFAULT_LATITUDE = 37.772123;
export const DEFAULT_ZOOM = 11;

export function kmToPixels(kilometers, latitude, zoomLevel) {
  // Algorithm from: http://wiki.openstreetmap.org/wiki/Zoom_levels
  const latitudeRad = latitude * (Math.PI / 180);
  // Seems like the zoomLevel is off by one
  const kmPerPixel = EARTH_CIRCUMFERENCE_KM * Math.cos(latitudeRad) / Math.pow(2, zoomLevel + 9);
  return d3.round(kilometers / kmPerPixel, 2);
}

export function isNumeric(num) {
  return !isNaN(parseFloat(num)) && isFinite(num);
}

export function rgbLuminance(r, g, b) {
  // Formula: https://en.wikipedia.org/wiki/Relative_luminance
  return (LUMINANCE_RED_WEIGHT * r) + (LUMINANCE_GREEN_WEIGHT * g) + (LUMINANCE_BLUE_WEIGHT * b);
}

export function getParamFromQuery(query, param) {
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === param) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}

export function getLink(baseUrl, params) {
  return baseUrl + '?' + params.join('&');
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
