'use strict';

module.exports = function scatter(a, j, w, x, u, mark, c, f, inverse, update, value) {
  // a arrays
  var avalues = a._values;
  var aindex = a._index;
  var aptr = a._ptr;
  // c arrays
  var cindex = c._index;

  // vars
  var k, k0, k1, i;

  // check we need to process values (pattern matrix)
  if (x) {
    // values in j
    for (k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
      // row
      i = aindex[k];
      // check value exists in current j
      if (w[i] !== mark) {
        // i is new entry in j
        w[i] = mark;
        // add i to pattern of C
        cindex.push(i);
        // x(i) = A, check we need to call function this time
        if (update) {
          // copy value to workspace calling callback function
          x[i] = inverse ? f(avalues[k], value) : f(value, avalues[k]);
          // function was called on current row
          u[i] = mark;
        }
        else {
          // copy value to workspace
          x[i] = avalues[k];
        }
      }
      else {
        // i exists in C already
        x[i] = inverse ? f(avalues[k], x[i]) : f(x[i], avalues[k]);
        // function was called on current row
        u[i] = mark;
      }
    }
  }
  else {
    // values in j
    for (k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
      // row
      i = aindex[k];
      // check value exists in current j
      if (w[i] !== mark) {
        // i is new entry in j
        w[i] = mark;
        // add i to pattern of C
        cindex.push(i);
      }
      else {
        // indicate function was called on current row
        u[i] = mark;
      }
    }
  }
};
