/**
 * Span-preserving range clamp. If the span of the input range is less
 * than (max - min) and an endpoint exceeds either the min or max value,
 * the range is translated such that the span is preserved and one
 * endpoint touches the boundary of the min/max range.
 * If the span exceeds (max - min), the range [min, max] is returned.
 */
export default function(range, min, max) {
  var lo = range[0],
      hi = range[1],
      span;

  if (hi < lo) {
    span = hi;
    hi = lo;
    lo = span;
  }
  span = hi - lo;

  return span >= (max - min)
    ? [min, max]
    : [
        (lo = Math.min(Math.max(lo, min), max - span)),
        lo + span
      ];
}
