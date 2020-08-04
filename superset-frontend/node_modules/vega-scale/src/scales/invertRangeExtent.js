export default function(scale) {
  return function(_) {
    var range = scale.range(),
        lo = _[0],
        hi = _[1],
        min = -1, max, t, i, n;

    if (hi < lo) {
      t = lo;
      lo = hi;
      hi = t;
    }

    for (i=0, n=range.length; i<n; ++i) {
      if (range[i] >= lo && range[i] <= hi) {
        if (min < 0) min = i;
        max = i;
      }
    }

    if (min < 0) return undefined;

    lo = scale.invertExtent(range[min]);
    hi = scale.invertExtent(range[max]);

    return [
      lo[0] === undefined ? lo[1] : lo[0],
      hi[1] === undefined ? hi[0] : hi[1]
    ];
  };
}
