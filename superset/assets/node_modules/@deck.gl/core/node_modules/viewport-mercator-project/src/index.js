// Classic web-mercator-project
export {default as default} from './web-mercator-viewport';
export {default as WebMercatorViewport} from './web-mercator-viewport';

export {default as fitBounds} from './fit-bounds';
export {default as normalizeViewportProps} from './normalize-viewport-props';
export {default as flyToViewport} from './fly-to-viewport';

export {
  lngLatToWorld,
  worldToLngLat,
  worldToPixels,
  pixelsToWorld,
  getMeterZoom,
  getDistanceScales,
  getWorldPosition,
  getViewMatrix,
  getProjectionMatrix,
  getProjectionParameters
} from './web-mercator-utils';

// Deprecated
export {default as PerspectiveMercatorViewport} from './web-mercator-viewport';
export {
  getViewMatrix as getUncenteredViewMatrix,
  lngLatToWorld as projectFlat,
  worldToLngLat as unprojectFlat
} from './web-mercator-utils';
