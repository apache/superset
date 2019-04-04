// test transforms
var assert = require('assert');
var approx = require('../../tools/approx');
var math = require('../../index');
var parse = math.expression.parse;

describe('transforms', function() {

  describe('filter', function () {

    it('should execute filter on an array with one based indices', function () {
      var logs = [];
      var scope = {
        A: [1,2,3],
        callback: function (value, index, matrix) {
          assert.strictEqual(matrix, scope.A);
          // note: we don't copy index, index should be a new Array for every call of callback
          logs.push([value, index]);
          return value > 1;
        }
      };
      var res = math.eval('filter(A, callback)', scope);
      assert.deepEqual(res, [2, 3]);

      assert.deepEqual(logs, [[1, [1]], [2, [2]], [3, [3]]]);
    });

    it('should evaluate filter with a callback function', function () {
      var scope = {};
      parseAndEval('isPositive(x) = x > 0', scope);
      assert.deepEqual(parseAndEval('filter([6, -2, -1, 4, 3], isPositive)', scope),
          math.matrix([6, 4, 3]));
    });

    it('should evaluate filter with an inline expression as callback (1)', function () {
      assert.deepEqual(parseAndEval('filter([6, -2, -1, 4, 3], x > 0)'),
          math.matrix([6, 4, 3]));
    });

    it('should evaluate filter with an inline expression as callback (2)', function () {
      assert.deepEqual(parseAndEval('filter([6, -2, -1, 4, 3], (x > 0))'),
          math.matrix([6, 4, 3]));
    });

    it('should evaluate filter with an inline expression as callback (3)', function () {
      assert.deepEqual(parseAndEval('filter([6, -2, -1, 4, 3], f(x) = x > 0)'),
          math.matrix([6, 4, 3]));
    });

    it('should evaluate filter with an inline expression as callback (4)', function () {
      assert.deepEqual(parseAndEval('filter([6, 0, 1, -0.2], boolean(x))'),
          math.matrix([6, 1, -0.2]));
    });

  });

  describe('map', function () {

    it('should execute map on an array with one based indices', function () {
      var logs = [];
      var scope = {
        A: [1,2,3],
        callback: function (value, index, matrix) {
          assert.strictEqual(matrix, scope.A);
          // note: we don't copy index, index should be a new Array for every call of callback
          logs.push([value, index]);
          return value + 1;
        }
      };
      var res = math.eval('map(A, callback)', scope);
      assert.deepEqual(res, [2,3,4]);

      assert.deepEqual(logs, [[1, [1]], [2, [2]], [3, [3]]]);
    });

    it('should execute map on a Matrix with one based indices', function () {
      var logs = [];
      var scope = {
        A: math.matrix([1,2,3]),
        callback: function (value, index, matrix) {
          assert.strictEqual(matrix, scope.A);
          // note: we don't copy index, index should be a new Array for every call of callback
          logs.push([value, index]);
          return value + 1;
        }
      };
      var res = math.eval('map(A, callback)', scope);
      assert.deepEqual(res, math.matrix([2,3,4]));

      assert.deepEqual(logs, [[1, [1]], [2, [2]], [3, [3]]]);
    });

    it('should evaluate map with a callback', function () {
      assert.deepEqual(parseAndEval('map([6, 2, 3], square)'),
          math.matrix([36, 4, 9]));
    });

    it('should evaluate map with an inline expression as callback (1)', function () {
      assert.deepEqual(parseAndEval('map([6, -2, -1, 4, 3], x > 0)'),
          math.matrix([true, false, false, true, true]));
    });

    it('should evaluate map with an inline expression as callback (2)', function () {
      assert.deepEqual(parseAndEval('map([6, -2, -1, 4, 3], (x > 0))'),
          math.matrix([true, false, false, true, true]));
    });

    it('should evaluate map with an inline expression as callback (3)', function () {
      assert.deepEqual(parseAndEval('map([6, -2, -1, 4, 3], f(x) = x > 0)'),
          math.matrix([true, false, false, true, true]));
    });

    it('should evaluate map with an inline expression as callback (4)', function () {
      assert.deepEqual(parseAndEval('map([6, -2, -1, 4, 3], f(x, index) = index[1])'),
          math.matrix([1, 2, 3, 4, 5]));
    });

    it('should evaluate map with an inline expression as callback (5)', function () {
      assert.deepEqual(parseAndEval('map([6, 0, 1, -0.2], boolean(x))'),
          math.matrix([true, false, true, true]));
    });

  });

  describe('forEach', function () {

    it('should execute forEach on an array with one based indices', function () {
      var logs = [];
      var scope = {
        A: [1,2,3],
        callback: function (value, index, matrix) {
          assert.strictEqual(matrix, scope.A);
          // note: we don't copy index, index should be a new Array for every call of callback
          logs.push([value, index]);
        }
      };
      math.eval('forEach(A, callback)', scope);

      assert.deepEqual(logs, [[1, [1]], [2, [2]], [3, [3]]]);
    });

    it('should execute forEach on a Matrix with one based indices', function () {
      var logs = [];
      var scope = {
        A: math.matrix([1,2,3]),
        callback: function (value, index, matrix) {
          assert.strictEqual(matrix, scope.A);
          // note: we don't copy index, index should be a new Array for every call of callback
          logs.push([value, index]);
        }
      };
      math.eval('forEach(A, callback)', scope);

      assert.deepEqual(logs, [[1, [1]], [2, [2]], [3, [3]]]);
    });

    it('should evaluate forEach with an inline expression as callback (1)', function () {
      var logs1 = [];
      var scope = {
        callback: function (value) {
          assert.strictEqual(arguments.length, 1);
          logs1.push(value);
        }
      };
      parseAndEval('forEach([6, -2, -1, 4, 3], callback(x + 1))', scope);
      assert.deepEqual(logs1, [7, -1, 0, 5, 4]);
    });

    it('should evaluate forEach with an inline expression as callback (2)', function () {
      var logs1 = [];
      var scope = {
        callback: function (value) {
          assert.strictEqual(arguments.length, 1);
          logs1.push(value);
        },
        noop: function () {}
      };
      parseAndEval('forEach([6, -2, -1, 4, 3], x > 0 ? callback(x) : noop())', scope);
      assert.deepEqual(logs1, [6, 4, 3]);
    });

  });


  // TODO: test transforms more thoroughly
});

/**
 * Helper function to parse an expression and immediately evaluate its results
 * @param {String} expr
 * @param {Object} [scope]
 * @return {*} result
 */
function parseAndEval(expr, scope) {
  return parse(expr).eval(scope);
}
