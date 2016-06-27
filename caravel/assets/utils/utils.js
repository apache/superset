const d3 = window.d3 || require('d3');

const EARTH_CIRCUMFERENCE_KM = 40075.16;
const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
const MILES_PER_KM = 1.60934;

function kmToPixels(kilometers, latitude, zoomLevel) {
  // Algorithm from: http://wiki.openstreetmap.org/wiki/Zoom_levels
  const latitudeRad = latitude * (Math.PI / 180);
  // Seems like the zoomLevel is off by one
  const kmPerPixel = EARTH_CIRCUMFERENCE_KM * Math.cos(latitudeRad) / Math.pow(2, zoomLevel + 9);
  return d3.round(kilometers / kmPerPixel, 2);
}

function isNumeric(num) {
  return !isNaN(parseFloat(num)) && isFinite(num);
}

function rgbLuminance(r, g, b) {
  // Formula: https://en.wikipedia.org/wiki/Relative_luminance
  return LUMINANCE_RED_WEIGHT*r + LUMINANCE_GREEN_WEIGHT*g + LUMINANCE_BLUE_WEIGHT*b;
}

export {
  EARTH_CIRCUMFERENCE_KM,
  LUMINANCE_RED_WEIGHT,
  LUMINANCE_GREEN_WEIGHT,
  LUMINANCE_BLUE_WEIGHT,
  MILES_PER_KM,
  kmToPixels,
  isNumeric,
  rgbLuminance
};
