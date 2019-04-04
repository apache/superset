// View and Projection Matrix calculations for mapbox-js style map view properties
import Viewport from './viewport';

import {
  zoomToScale,
  getWorldPosition,
  pixelsToWorld,
  lngLatToWorld,
  worldToLngLat,
  getProjectionMatrix,
  getViewMatrix
} from './web-mercator-utils';
import fitBounds from './fit-bounds';

import vec2_add from 'gl-vec2/add';
import vec2_negate from 'gl-vec2/negate';

export default class WebMercatorViewport extends Viewport {
  /**
   * @classdesc
   * Creates view/projection matrices from mercator params
   * Note: The Viewport is immutable in the sense that it only has accessors.
   * A new viewport instance should be created if any parameters have changed.
   *
   * @class
   * @param {Object} opt - options
   *
   * @param {Number} opt.width=1 - Width of "viewport" or window
   * @param {Number} opt.height=1 - Height of "viewport" or window
   * @param {Number} opt.scale=1 - Either use scale or zoom
   * @param {Number} opt.pitch=0 - Camera angle in degrees (0 is straight down)
   * @param {Number} opt.bearing=0 - Map rotation in degrees (0 means north is up)
   * @param {Number} opt.altitude= - Altitude of camera in screen units
   *
   * Web mercator projection short-hand parameters
   * @param {Number} opt.latitude - Center of viewport on map (alternative to opt.center)
   * @param {Number} opt.longitude - Center of viewport on map (alternative to opt.center)
   * @param {Number} opt.zoom - Scale = Math.pow(2,zoom) on map (alternative to opt.scale)

   * Notes:
   *  - Only one of center or [latitude, longitude] can be specified
   *  - [latitude, longitude] can only be specified when "mercator" is true
   *  - Altitude has a default value that matches assumptions in mapbox-gl
   *  - width and height are forced to 1 if supplied as 0, to avoid
   *    division by zero. This is intended to reduce the burden of apps to
   *    to check values before instantiating a Viewport.
   */
  /* eslint-disable complexity */
  constructor({
    // Map state
    width,
    height,
    latitude = 0,
    longitude = 0,
    zoom = 0,
    pitch = 0,
    bearing = 0,
    altitude = 1.5,
    farZMultiplier = 10
  } = {}) {
    // Silently allow apps to send in 0,0 to facilitate isomorphic render etc
    width = width || 1;
    height = height || 1;

    const scale = zoomToScale(zoom);
    // Altitude - prevent division by 0
    // TODO - just throw an Error instead?
    altitude = Math.max(0.75, altitude);

    const center = getWorldPosition({longitude, latitude, scale});

    const projectionMatrix = getProjectionMatrix({
      width,
      height,
      pitch,
      bearing,
      altitude,
      farZMultiplier
    });

    const viewMatrix = getViewMatrix({
      height,
      center,
      pitch,
      bearing,
      altitude,
      flipY: true
    });

    super({width, height, viewMatrix, projectionMatrix});

    // Save parameters
    this.latitude = latitude;
    this.longitude = longitude;
    this.zoom = zoom;
    this.pitch = pitch;
    this.bearing = bearing;
    this.altitude = altitude;

    this.scale = scale;
    this.center = center;

    Object.freeze(this);
  }
  /* eslint-enable complexity */

  /**
   * Project [lng,lat] on sphere onto [x,y] on 512*512 Mercator Zoom 0 tile.
   * Performs the nonlinear part of the web mercator projection.
   * Remaining projection is done with 4x4 matrices which also handles
   * perspective.
   *
   * @param {Array} lngLat - [lng, lat] coordinates
   *   Specifies a point on the sphere to project onto the map.
   * @return {Array} [x,y] coordinates.
   */
  projectFlat(lngLat, scale = this.scale) {
    return lngLatToWorld(lngLat, scale);
  }

  /**
   * Unproject world point [x,y] on map onto {lat, lon} on sphere
   *
   * @param {object|Vector} xy - object with {x,y} members
   *  representing point on projected map plane
   * @return {GeoCoordinates} - object with {lat,lon} of point on sphere.
   *   Has toArray method if you need a GeoJSON Array.
   *   Per cartographic tradition, lat and lon are specified as degrees.
   */
  unprojectFlat(xy, scale = this.scale) {
    return worldToLngLat(xy, scale);
  }

  /**
   * Get the map center that place a given [lng, lat] coordinate at screen
   * point [x, y]
   *
   * @param {Array} lngLat - [lng,lat] coordinates
   *   Specifies a point on the sphere.
   * @param {Array} pos - [x,y] coordinates
   *   Specifies a point on the screen.
   * @return {Array} [lng,lat] new map center.
   */
  getMapCenterByLngLatPosition({lngLat, pos}) {
    const fromLocation = pixelsToWorld(pos, this.pixelUnprojectionMatrix);
    const toLocation = lngLatToWorld(lngLat, this.scale);

    const translate = vec2_add([], toLocation, vec2_negate([], fromLocation));
    const newCenter = vec2_add([], this.center, translate);

    return worldToLngLat(newCenter, this.scale);
  }

  // Legacy method name
  getLocationAtPoint({lngLat, pos}) {
    return this.getMapCenterByLngLatPosition({lngLat, pos});
  }

  /**
   * Returns a new viewport that fit around the given rectangle.
   * Only supports non-perspective mode.
   * @param {Array} bounds - [[lon, lat], [lon, lat]]
   * @param {Number} [options.padding] - The amount of padding in pixels to add to the given bounds.
   * @param {Array} [options.offset] - The center of the given bounds relative to the map's center,
   *    [x, y] measured in pixels.
   * @returns {WebMercatorViewport}
   */
  fitBounds(bounds, options = {}) {
    const {width, height} = this;
    const {longitude, latitude, zoom} = fitBounds(Object.assign({width, height, bounds}, options));
    return new WebMercatorViewport({width, height, longitude, latitude, zoom});
  }

}
