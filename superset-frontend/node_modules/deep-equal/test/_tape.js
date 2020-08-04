var Test = require('tape/lib/test');
var is = require('object-is');
var equal = require('../');

function equalReversed(t, a, b, isEqual, msg, isStrict, skipReversed) {
  var actual = isStrict ? equal(a, b, { strict: true }) : equal(a, b);
  var suffix = isEqual ? ' are equal' : ' are not equal';
  t.equal(actual, !!isEqual, msg + suffix);
  if (typeof skipReversed === 'boolean' ? !skipReversed : !is(a, b)) {
    var actualReverse = isStrict ? equal(b, a, { strict: true }) : equal(b, a);
    t.equal(actualReverse, !!isEqual, msg + suffix + ' (reversed)');
  }
}
function deepEqualTest(t, a, b, msg, isEqual, isStrictEqual, skipReversed) {
  equalReversed(t, a, b, isEqual, msg, false, skipReversed);
  equalReversed(t, a, b, isStrictEqual, 'strict: ' + msg, true, skipReversed);
}

Test.prototype.deepEqualTest = function (a, b, message, isEqual, isStrictEqual, skipReversed) {
  return deepEqualTest(this, a, b, message, !!isEqual, !!isStrictEqual, skipReversed);
};
