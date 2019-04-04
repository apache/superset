// test parser

var assert = require('assert'),
    approx = require('../../tools/approx'),
    math = require('../../index'),
    Parser = math.expression.Parser;

describe('parser', function() {

  it ('should create a parser', function () {
    var parser = new Parser();
    assert.ok(parser instanceof Parser);
  });

  it('should have a property isParser', function () {
    var a = new Parser();
    assert.strictEqual(a.isParser, true);
  });

  it('should have a property type', function () {
    var a = new Parser();
    assert.strictEqual(a.type, 'Parser');
  });

  it ('should throw an error when using deprecated function parse', function () {
    var parser = new Parser();

    assert.throws(function () {parser.parse('2 + 3');}, /is deprecated/);
  });

  it ('should throw an error when using deprecated function compile', function () {
    var parser = new Parser();

    assert.throws(function () {parser.compile('2 + 3');}, /is deprecated/);
  });

  it ('should evaluate an expression', function () {
    var parser = new Parser();

    var result = parser.eval('2 + 3');
    assert.equal(result, 5);
  });

  it ('should get variables from the parsers namespace ', function () {
    var parser = new Parser();

    parser.eval('a = 3');
    parser.eval('b = a + 2');
    assert.equal(parser.eval('a'), 3);
    assert.equal(parser.eval('b'), 5);
    assert.equal(parser.get('a'), 3);
    assert.equal(parser.get('b'), 5);
  });

  it ('should get all variables from the parsers namespace ', function () {
    var parser = new Parser();

    parser.eval('a = 3');
    parser.eval('b = a + 2');
    assert.deepEqual(parser.getAll(), {a: 3, b: 5});

    parser.remove('a');
    assert.deepEqual(parser.getAll(), {b: 5});
  });

  it ('should return undefined when getting a non existing variable', function () {
    var parser = new Parser();

    assert.strictEqual(parser.get('non_existing_variable'), undefined);
  });

  it ('should set variables in the parsers namespace ', function () {
    var parser = new Parser();

    assert.equal(parser.set('a', 3), 3);
    assert.equal(parser.eval('a'), 3);
    assert.equal(parser.eval('a + 2'), 5);

    // adjust variable
    assert.equal(parser.eval('a = a + 2'), 5);
    assert.equal(parser.eval('a'), 5);
    assert.equal(parser.get('a'), 5);

    assert.equal(parser.set('a', parser.get('a') - 4), 1);
    assert.equal(parser.eval('a'), 1);
  });

  it ('should remove a variable from the parsers namespace ', function () {
    var parser = new Parser();

    assert.equal(parser.set('qq', 3), 3);
    assert.equal(parser.eval('qq'), 3);
    assert.equal(parser.get('qq'), 3);

    parser.remove('qq');
    assert.equal(parser.get('qq'), null);
    assert.throws(function () {parser.eval('qq')});

    assert.equal(parser.eval('ww = 5'), 5);
    assert.equal(parser.get('ww'), 5);
    parser.remove('ww');
    assert.equal(parser.get('ww'), null);
    assert.throws(function () {parser.eval('ww')});
  });

  it ('should clear the parsers namespace ', function () {
    var parser = new Parser();

    assert.equal(parser.eval('xx = yy = zz = 5'), 5);

    assert.equal(parser.set('pi', 'oops'), 'oops');

    assert.equal(parser.get('xx'), 5);
    assert.equal(parser.get('yy'), 5);
    assert.equal(parser.get('zz'), 5);
    assert.equal(parser.get('pi'), 'oops');

    assert.equal(parser.eval('xx'), 5);
    assert.equal(parser.eval('yy'), 5);
    assert.equal(parser.eval('zz'), 5);
    assert.equal(parser.eval('pi'), 'oops');

    parser.clear();

    assert.equal(parser.get('xx'), null);
    assert.equal(parser.get('yy'), null);
    assert.equal(parser.get('zz'), null);
    approx.equal(parser.get('pi'), null);

    assert.throws(function () {parser.eval('xx')});
    assert.throws(function () {parser.eval('yy')});
    assert.throws(function () {parser.eval('zz')});
    assert.equal(parser.eval('pi'), Math.PI);
  });

  describe ('security', function () {

    it ('should throw an error when accessing inherited properties', function () {
      try {
        var parser = new Parser();

        Object.prototype.foo = 'bar';

        parser.clear();

        assert.throws(function () {parser.get('foo')}, /No access/);
      }
      finally {
        delete Object.prototype.foo;
      }
    });

    it ('should throw an error when assigning an inherited property', function () {

      try {
        var parser = new Parser();
        assert.throws(function () {parser.set('toString', null)}, /No access/);
      }
      finally {
        delete Object.prototype.foo;
      }
    });

  })

  it ('should throw an exception when creating a parser without new', function () {
    assert.throws(function () {Parser()}, /Constructor must be called with the new operator/);
  });
});
