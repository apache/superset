import WebMercatorViewport from './web-mercator-viewport';
import assert from './assert';

/**
 * * An object describing the padding to add to the bounds.
 * @typedef {Object} PaddingObject
 * @property {Number} top - Padding from top in pixels to add to the given bounds
 * @property {Number} bottom - Padding from bottom in pixels to add to the given bounds
 * @property {Number} left - Padding from left in pixels to add to the given bounds
 * @property {Number} right - Padding from right in pixels to add to the given bounds
 */

/**
 * Returns map settings {latitude, longitude, zoom}
 * that will contain the provided corners within the provided width.
 * Only supports non-perspective mode.
 * @param {Number} width - viewport width
 * @param {Number} height - viewport height
 * @param {Array} bounds - [[lon, lat], [lon, lat]]
 * @param {Array} minExtent - The width/height of the bounded area will never be smaller than this
 * @param {Number|PaddingObject} [padding] - The amount of padding in pixels
 *  to add to the given bounds. Can also be an object with top, bottom, left and right
 *  properties defining the padding.
 * @param {Array} [offset] - The center of the given bounds relative to the map's center,
 *    [x, y] measured in pixels.
 * @returns {Object} - latitude, longitude and zoom
 */
export default function fitBounds({
  width,
  height,
  bounds,
  minExtent = 0,  // 0.01 would be about 1000 meters (degree is ~110KM)
  maxZoom = 24, // ~x4,000,000 => About 10 meter extents
  // options
  padding = 0,
  offset = [0, 0]
}) {
  const [[west, south], [east, north]] = bounds;

  if (Number.isFinite(padding)) {
    const p = padding;
    padding = {
      top: p,
      bottom: p,
      left: p,
      right: p
    };
  } else {
    // Make sure all the required properties are set
    assert(Number.isFinite(padding.top) &&
      Number.isFinite(padding.bottom) &&
      Number.isFinite(padding.left) &&
      Number.isFinite(padding.right)
    );
  }

  const viewport = new WebMercatorViewport({
    width,
    height,
    longitude: 0,
    latitude: 0,
    zoom: 0
  });

  const nw = viewport.project([west, north]);
  const se = viewport.project([east, south]);

  // width/height on the Web Mercator plane
  const size = [
    Math.max(Math.abs(se[0] - nw[0]), minExtent),
    Math.max(Math.abs(se[1] - nw[1]), minExtent)
  ];

  const targetSize = [
    width - padding.left - padding.right - Math.abs(offset[0]) * 2,
    height - padding.top - padding.bottom - Math.abs(offset[1]) * 2
  ];

  assert(targetSize[0] > 0 && targetSize[1] > 0);

  // scale = screen pixels per unit on the Web Mercator plane
  const scaleX = targetSize[0] / size[0];
  const scaleY = targetSize[1] / size[1];

  // Find how much we need to shift the center
  const offsetX = (padding.right - padding.left) / 2 / scaleX;
  const offsetY = (padding.bottom - padding.top) / 2 / scaleY;

  const center = [
    (se[0] + nw[0]) / 2 + offsetX,
    (se[1] + nw[1]) / 2 + offsetY
  ];

  const centerLngLat = viewport.unproject(center);
  const zoom = viewport.zoom + Math.log2(Math.abs(Math.min(scaleX, scaleY)));

  return {
    longitude: centerLngLat[0],
    latitude: centerLngLat[1],
    zoom: Math.min(zoom, maxZoom)
  };
}
