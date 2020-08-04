/**
 * Return an array with minimum and maximum values, in the
 * form [min, max]. Ignores null, undefined, and NaN values.
 */
export default function(array, f) {
  var i = 0, n, v, min, max;

  if (array && (n = array.length)) {
    if (f == null) {
      // find first valid value
      for (v = array[i]; i < n && (v == null || v !== v); v = array[++i]);
      min = max = v;

      // visit all other values
      for (; i<n; ++i) {
        v = array[i];
        // skip null/undefined; NaN will fail all comparisons
        if (v != null) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    } else {
      // find first valid value
      for (v = f(array[i]); i < n && (v == null || v !== v); v = f(array[++i]));
      min = max = v;

      // visit all other values
      for (; i<n; ++i) {
        v = f(array[i]);
        // skip null/undefined; NaN will fail all comparisons
        if (v != null) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
  }

  return [min, max];
}
