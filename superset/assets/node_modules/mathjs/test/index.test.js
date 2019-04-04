var assert = require('assert'),
    approx = require('../tools/approx'),
    math = require('../index');

describe('factory', function() {

  it('should get a default instance of mathjs', function() {
    assert.strictEqual(typeof math, 'object');
    assert.deepEqual(math.config(), {
      matrix: 'Matrix',
      number: 'number',
      precision: 64,
      predictable: false,
      epsilon: 1e-12,
      randomSeed: null
    });
  });

  it('should create an instance of math.js with custom configuration', function() {
    var math1 = math.create({
      matrix: 'Array',
      number: 'BigNumber'
    });

    assert.strictEqual(typeof math1, 'object');
    assert.deepEqual(math1.config(), {
      matrix: 'Array',
      number: 'BigNumber',
      precision: 64,
      predictable: false,
      epsilon: 1e-12,
      randomSeed: null
    });
  });

  it('two instances of math.js should be isolated from each other', function() {
    var math1 = math.create();
    var math2 = math.create({
      matrix: 'Array'
    });

    assert.notStrictEqual(math, math1);
    assert.notStrictEqual(math, math2);
    assert.notStrictEqual(math1, math2);
    assert.notDeepEqual(math1.config(), math2.config());
    assert.notDeepEqual(math.config(), math2.config());

    // changing config should not affect the other
    math1.config({number: 'BigNumber'});
    assert.strictEqual(math.config().number, 'number');
    assert.strictEqual(math1.config().number, 'BigNumber');
    assert.strictEqual(math2.config().number, 'number');
  });

  it('should apply configuration using the config function', function() {
    var math1 = math.create();

    var config = math1.config();
    assert.deepEqual(config, {
      matrix: 'Matrix',
      number: 'number',
      precision: 64,
      predictable: false,
      epsilon: 1e-12,
      randomSeed: null
    });

    // restore the original config
    math1.config(config);
  });

  // TODO: test whether the namespace is correct: has functions like sin, constants like pi, objects like type and error.

  it('should throw an error when ES5 is not supported', function() {
    var create = Object.create;
    Object.create = undefined; // fake missing Object.create function

    assert.throws(function () {
      var math1 = math.create();
    }, /ES5 not supported/);

    // restore Object.create
    Object.create = create;
  });

});
