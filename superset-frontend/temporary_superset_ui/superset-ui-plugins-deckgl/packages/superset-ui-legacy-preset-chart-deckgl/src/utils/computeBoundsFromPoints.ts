import { extent as d3Extent } from 'd3-array';
import { Point, Range } from './types';

const LAT_LIMIT: Range = [-90, 90];
const LNG_LIMIT: Range = [-180, 180];

/**
 * Expand a coordinate range by `padding` and within limits, if needed
 */
function expandIfNeeded([curMin, curMax]: Range, [minBound, maxBound]: Range, padding = 0.25) {
  return curMin < curMax
    ? [curMin, curMax]
    : [Math.max(minBound, curMin - padding), Math.min(maxBound, curMax + padding)];
}

export default function computeBoundsFromPoints(points: Point[]) {
  const latBounds = expandIfNeeded(d3Extent(points, (x: Point) => x[1]) as Range, LAT_LIMIT);
  const lngBounds = expandIfNeeded(d3Extent(points, (x: Point) => x[0]) as Range, LNG_LIMIT);
  return [
    [lngBounds[0], latBounds[0]],
    [lngBounds[1], latBounds[1]],
  ];
}
