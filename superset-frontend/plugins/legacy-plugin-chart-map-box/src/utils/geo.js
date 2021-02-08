import roundDecimal from './roundDecimal';

export const EARTH_CIRCUMFERENCE_KM = 40075.16;
export const MILES_PER_KM = 1.60934;

export function kmToPixels(kilometers, latitude, zoomLevel) {
  // Algorithm from: http://wiki.openstreetmap.org/wiki/Zoom_levels
  const latitudeRad = latitude * (Math.PI / 180);
  // Seems like the zoomLevel is off by one
  const kmPerPixel = (EARTH_CIRCUMFERENCE_KM * Math.cos(latitudeRad)) / 2 ** (zoomLevel + 9);

  return roundDecimal(kilometers / kmPerPixel, 2);
}
