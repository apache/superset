// Dot density binning for dot plot construction.
// Based on Leland Wilkinson, Dot Plots, The American Statistician, 1999.
// https://www.cs.uic.edu/~wilkinson/Publications/dotplots.pdf
export default function(array, step, smooth, f) {
  f = f || (_ => _);

  let i = 0, j = 1,
      n = array.length,
      v = new Float64Array(n),
      a = f(array[0]),
      b = a,
      w = a + step,
      x;

  for (; j<n; ++j) {
    x = f(array[j]);
    if (x >= w) {
      b = (a + b) / 2;
      for (; i<j; ++i) v[i] = b;
      w = x + step;
      a = x;
    }
    b = x;
  }

  b = (a + b) / 2;
  for (; i<j; ++i) v[i] = b;

  return smooth ? smoothing(v, step + step / 4) : v;
}

// perform smoothing to reduce variance
// swap points between "adjacent" stacks
// Wilkinson defines adjacent as within step/4 units
function smoothing(v, thresh) {
  let n = v.length,
      a = 0,
      b = 1,
      c, d;

  // get left stack
  while (v[a] === v[b]) ++b;

  while (b < n) {
    // get right stack
    c = b + 1;
    while (v[b] === v[c]) ++c;

    // are stacks adjacent?
    // if so, compare sizes and swap as needed
    if (v[b] - v[b-1] < thresh) {
      d = b + ((a + c - b - b) >> 1);
      while (d < b) v[d++] = v[b];
      while (d > b) v[d--] = v[a];
    }

    // update left stack indices
    a = b;
    b = c;
  }

  return v;
}
