/**
 * An object describing the padding to add to the bounds.
 *
 * @property top - Padding from top in pixels to add to the given bounds
 * @property bottom - Padding from bottom in pixels to add to the given bounds
 * @property left - Padding from left in pixels to add to the given bounds
 * @property right - Padding from right in pixels to add to the given bounds
 */
export type Padding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * Options for fitBounds
 *
 * @param options fit bounds parameters
 * @param options.width - viewport width
 * @param options.height - viewport height
 * @param options.bounds - [[lon, lat], [lon, lat]]
 * @param options.minExtent - The width/height of the bounded area will never be smaller than this
 * @param options.padding - The amount of padding in pixels
 *  to add to the given bounds. Can also be an object with top, bottom, left and right
 *  properties defining the padding.
 * @param [options.offset] - The center of the given bounds relative to the map's center,
 */
export type FitBoundsOptions = {
  width: number;
  height: number;
  bounds: [[number, number], [number, number]];
  minExtent?: number; // 0.01 would be about 1000 meters (degree is ~110KM)
  maxZoom?: number; // ~x4,000,000 => About 10 meter extents
  // options
  padding?: number | Padding;
  offset?: number[];
};

export type Bounds = {
  longitude: number;
  latitude: number;
  zoom: number;
};

/**
 * Returns map settings {latitude, longitude, zoom}
 * that will contain the provided corners within the provided width.
 *
 * > _Note: Only supports non-perspective mode._
 *
 * @param options fit bounds parameters
 * @param options.width - viewport width
 * @param options.height - viewport height
 * @param options.bounds - [[lon, lat], [lon, lat]]
 * @param options.minExtent - The width/height of the bounded area will never be smaller than this
 * @param options.padding - The amount of padding in pixels
 *  to add to the given bounds. Can also be an object with top, bottom, left and right
 *  properties defining the padding.
 * @param [options.offset] - The center of the given bounds relative to the map's center,
 *    [x, y] measured in pixels.
 * @returns {Object} - latitude, longitude and zoom
 */
export default function fitBounds(options: FitBoundsOptions): Bounds;
