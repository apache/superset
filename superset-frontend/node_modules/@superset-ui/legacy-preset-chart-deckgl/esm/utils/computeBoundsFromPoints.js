import { extent as d3Extent } from 'd3-array';
const LAT_LIMIT = [-90, 90];
const LNG_LIMIT = [-180, 180];
/**
 * Expand a coordinate range by `padding` and within limits, if needed
 */

function expandIfNeeded(_ref, _ref2, padding) {
  let [curMin, curMax] = _ref;
  let [minBound, maxBound] = _ref2;

  if (padding === void 0) {
    padding = 0.25;
  }

  return curMin < curMax ? [curMin, curMax] : [Math.max(minBound, curMin - padding), Math.min(maxBound, curMax + padding)];
}

export default function computeBoundsFromPoints(points) {
  const latBounds = expandIfNeeded(d3Extent(points, x => x[1]), LAT_LIMIT);
  const lngBounds = expandIfNeeded(d3Extent(points, x => x[0]), LNG_LIMIT);
  return [[lngBounds[0], latBounds[0]], [lngBounds[1], latBounds[1]]];
}