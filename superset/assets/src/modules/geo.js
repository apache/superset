import { round as d3Round } from 'd3-format';

export const defaultViewport = {
  longitude: 6.85236157047845,
  latitude: 31.222656842808707,
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

const METER_TO_MILE = 1609.34;

export function unitToRadius(unit, num) {
  if (unit === 'square_m') {
    return Math.sqrt(num / Math.PI);
  } else if (unit === 'radius_m') {
    return num;
  } else if (unit === 'radius_km') {
    return num * 1000;
  } else if (unit === 'radius_miles') {
    return num * METER_TO_MILE;
  } else if (unit === 'square_km') {
    return Math.sqrt(num / Math.PI) * 1000;
  } else if (unit === 'square_miles') {
    return Math.sqrt(num / Math.PI) * METER_TO_MILE;
  }
  return null;
}

export const EARTH_CIRCUMFERENCE_KM = 40075.16;
export const MILES_PER_KM = 1.60934;

export function kmToPixels(kilometers, latitude, zoomLevel) {
  // Algorithm from: http://wiki.openstreetmap.org/wiki/Zoom_levels
  const latitudeRad = latitude * (Math.PI / 180);
  // Seems like the zoomLevel is off by one
  const kmPerPixel = (EARTH_CIRCUMFERENCE_KM * Math.cos(latitudeRad)) / Math.pow(2, zoomLevel + 9);
  return d3Round(kilometers / kmPerPixel, 2);
}
