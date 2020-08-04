// @flow

import {createContext} from 'react';

import type {WebMercatorViewport} from 'viewport-mercator-project';

export type MapContextProps = {
  viewport: ?WebMercatorViewport,

  map: any,
  mapContainer: null | HTMLDivElement,

  onViewStateChange: ?Function,
  onViewportChange: ?Function,

  isDragging: boolean,
  eventManager: any
};

export default createContext<MapContextProps>({
  /* Map context */

  // Viewport
  viewport: null,
  // mapboxgl.Map instance
  map: null,
  // DOM element that contains the map
  mapContainer: null,

  /* Interactive-only context */
  onViewportChange: null,
  onViewStateChange: null,

  // EventManager instance
  eventManager: null,
  // whether the map is being dragged
  isDragging: false
});
