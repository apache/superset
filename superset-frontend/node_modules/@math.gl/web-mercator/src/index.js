// Classic web-mercator-project
export {default} from './web-mercator-viewport';
export {default as WebMercatorViewport} from './web-mercator-viewport';

export {default as getBounds} from './get-bounds';
export {default as fitBounds} from './fit-bounds';
export {default as normalizeViewportProps} from './normalize-viewport-props';
export {default as flyToViewport, getFlyToDuration} from './fly-to-viewport';

export {
  lngLatToWorld,
  worldToLngLat,
  worldToPixels,
  pixelsToWorld,
  zoomToScale,
  scaleToZoom,
  getMeterZoom,
  getDistanceScales,
  addMetersToLngLat,
  getViewMatrix,
  getProjectionMatrix,
  getProjectionParameters
} from './web-mercator-utils';
