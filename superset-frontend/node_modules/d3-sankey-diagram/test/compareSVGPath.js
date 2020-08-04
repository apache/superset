/* Compare SVG paths */


export default function compareSVGPath(t, actual, expected, message) {
  let { equal, i, x, y, wrongLengths } = pathEqual(actual, expected);
  if (equal) {
    t.pass(message);
  } else if (wrongLengths) {
    t.fail(message + `: Different lengths: "${actual}" != "${expected}"`);
  } else {
    t.fail(message + `: Mismatch at position ${i}: "${x}" != "${y}"`);
  }
}


/* from d3: test/assert.js */
function pathEqual(a, b, tol=1e-3) {
  a = parsePath(a.replace(/\s+/g, ' '));
  b = parsePath(b.replace(/\s+/g, ' '));
  var n = a.length, i = -1, x, y;
  if (n !== b.length)
    return { equal: false, x: a.slice(Math.min(n, b.length)), y: b.slice(Math.min(n, b.length)), wrongLengths: true };
  while (++i < n) {
    x = a[i];
    y = b[i];
    if (typeof x === 'string') {
      if (x !== y) return { equal: false, i: i, x: x, y: y };
    } else if (typeof y !== 'number') {
      return { equal: false, i: i, x: x, y: y };
    } else if (Math.abs(x - y) > tol) {
      return { equal: false, i: i, x: x, y: y };
    }
  }
  return { equal: true };
}


var reNumber = /[-+]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][-]?\d+)?/g;


function parsePath(path) {
  var parts = [];
  reNumber.lastIndex = 0;
  for (var i = 0, s0 = 0, s1, m; m = reNumber.exec(path); ++i) {
    if (m.index) {
      var part = path.substring(s0, s1 = m.index);
      if (!/^[, ]$/.test(part)) parts.push(part);
    }
    parts.push(parseFloat(m[0]));
    s0 = reNumber.lastIndex;
  }
  if (s0 < path.length) parts.push(path.substring(s0));
  return parts;
}


function formatPath(path) {
  return path.replace(reNumber, formatNumber);
}


function formatNumber(s) {
  return Math.abs((s = +s) - Math.floor(s)) < 1e-3 ?
    Math.floor(s) : s.toFixed(3);
}
