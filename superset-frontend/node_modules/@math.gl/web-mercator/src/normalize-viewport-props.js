import WebMercatorViewport from './web-mercator-viewport';
import {mod} from './math-utils';

// defined by mapbox-gl
const MAX_LATITUDE = 85.05113;
const MIN_LATITUDE = -85.05113;

// Apply mathematical constraints to viewport props
// eslint-disable-next-line complexity
export default function normalizeViewportProps({
  width,
  height,
  longitude,
  latitude,
  zoom,
  pitch = 0,
  bearing = 0
}) {
  // Normalize degrees
  if (longitude < -180 || longitude > 180) {
    longitude = mod(longitude + 180, 360) - 180;
  }
  if (bearing < -180 || bearing > 180) {
    bearing = mod(bearing + 180, 360) - 180;
  }

  // Constrain zoom and shift center at low zoom levels
  let flatViewport = new WebMercatorViewport({width, height, longitude, latitude, zoom});
  let topY = flatViewport.project([longitude, MAX_LATITUDE])[1];
  let bottomY = flatViewport.project([longitude, MIN_LATITUDE])[1];
  let shiftY = 0;

  if (bottomY - topY < height) {
    // Map height must not be smaller than viewport height
    // Zoom out map to fit map height into viewport
    zoom += Math.log2(height / (bottomY - topY));

    // Calculate top and bottom using new zoom
    flatViewport = new WebMercatorViewport({width, height, longitude, latitude, zoom});
    topY = flatViewport.project([longitude, MAX_LATITUDE])[1];
    bottomY = flatViewport.project([longitude, MIN_LATITUDE])[1];
  }
  if (topY > 0) {
    // Compensate for white gap on top
    shiftY = topY;
  } else if (bottomY < height) {
    // Compensate for white gap on bottom
    shiftY = bottomY - height;
  }
  if (shiftY) {
    latitude = flatViewport.unproject([width / 2, height / 2 + shiftY])[1];
  }

  return {width, height, longitude, latitude, zoom, pitch, bearing};
}
