export default function(scale) {
  return function(_) {
    var lo = _[0],
        hi = _[1],
        t;

    if (hi < lo) {
      t = lo;
      lo = hi;
      hi = t;
    }

    return [
      scale.invert(lo),
      scale.invert(hi)
    ];
  };
}
