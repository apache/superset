/**
 * Predicate that returns true if the value lies within the span
 * of the given range. The left and right flags control the use
 * of inclusive (true) or exclusive (false) comparisons.
 */
export default function(value, range, left, right) {
  var r0 = range[0], r1 = range[range.length-1], t;
  if (r0 > r1) {
    t = r0;
    r0 = r1;
    r1 = t;
  }
  left = left === undefined || left;
  right = right === undefined || right;

  return (left ? r0 <= value : r0 < value) &&
    (right ? value <= r1 : value < r1);
}
