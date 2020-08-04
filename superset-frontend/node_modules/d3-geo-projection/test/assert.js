var assert = require("assert");

assert = module.exports = Object.create(assert);

assert.inDelta = function(actual, expected, delta, message) {
  if (!inDelta(actual, expected, delta)) {
    assert.fail(actual, expected, message || "expected {actual} to be in within *" + delta + "* of {expected}", null, assert.inDelta);
  }
};

assert.equalInverse = function(projection, location, point, delta) {
  delta = delta || 1e-6;
  var projected;
  assert.inDelta(projected = projection(location), point, delta);
  assert.inDelta(projection.invert(projected), location, delta);
  assert.inDelta(projection(projection.invert(point)), point, delta);
};

function inDelta(actual, expected, delta) {
  return (Array.isArray(expected) ? inDeltaArray : inDeltaNumber)(actual, expected, delta);
}

function inDeltaArray(actual, expected, delta) {
  var n = expected.length, i = -1;
  if (actual.length !== n) return false;
  while (++i < n) if (!inDelta(actual[i], expected[i], delta)) return false;
  return true;
}

function inDeltaNumber(actual, expected, delta) {
  return actual >= expected - delta && actual <= expected + delta;
}
