// test string utils
var assert = require('assert');
var approx = require('../../tools/approx');
var BigNumber = require('decimal.js');
var math = require('../../index');
var string = require('../../lib/utils/string');

describe ('string', function () {

  it('isString', function() {
    assert.equal(string.isString('hi'), true);
    assert.equal(string.isString(String('hi')), true);

    assert.equal(string.isString(23), false);
    assert.equal(string.isString(true), false);
    assert.equal(string.isString(new Date()), false);

    // we don't support non primitive Strings anymore
    assert.equal(string.isString(new String('hi')), false);
  });

  it('endsWith', function() {
    assert.equal(string.endsWith('hello', 'hello'), true);
    assert.equal(string.endsWith('hello', 'lo'), true);
    assert.equal(string.endsWith('hello', ''), true);

    assert.equal(string.endsWith('hello!', 'lo'), false);
    assert.equal(string.endsWith('hello', 'LO'), false);
    assert.equal(string.endsWith('hello', 'hellohello'), false);
  });
  
  it('should escape special HTML characters', function() {
	assert.equal(string.escape('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
	assert.equal(string.escape('<script src="script.js?version=1.0&type=js">'), '&lt;script src=&quot;script.js?version=1.0&amp;type=js&quot;&gt;');
  });

  describe('format', function () {

    it ('should format null', function () {
      assert.equal(string.format(null), 'null');
    });

    it ('should format undefined', function () {
      assert.equal(string.format(undefined), 'undefined');
    });

    it ('should format a number', function () {
      assert.equal(string.format(2.3), '2.3');
    });

    it ('should format a bignumber', function () {
      var B = BigNumber.config({
        precision: 20
      });
      assert.equal(string.format(new B(1).div(3)), '0.33333333333333333333');
    });

    it ('should format a fraction without options', function () {
      assert.equal(string.format(math.fraction(1,3)), '1/3');
      assert.equal(string.format(math.fraction(2,6)), '1/3');
      assert.equal(string.format(math.fraction(-0.125)), '-1/8');
    });

    it ('should format a fraction with option fraction=\'ratio\'', function () {
      assert.equal(string.format(math.fraction(1,3), {fraction: 'ratio'}), '1/3');
      assert.equal(string.format(math.fraction(2,6), {fraction: 'ratio'}), '1/3');
    });

    it ('should format a fraction with option fraction=\'decimal\'', function () {
      assert.equal(string.format(math.fraction(1,3), {fraction: 'decimal'}), '0.(3)');
      assert.equal(string.format(math.fraction(2,6), {fraction: 'decimal'}), '0.(3)');
    });

    it ('should format a number with configuration', function () {
      assert.equal(string.format(1.23456, 3), '1.23');
      assert.equal(string.format(1.23456, {precision: 3}), '1.23');
    });

    it ('should format an array', function () {
      assert.equal(string.format([1,2,3]), '[1, 2, 3]');
      assert.equal(string.format([[1,2],[3,4]]), '[[1, 2], [3, 4]]');
    });

    it ('should format a string', function () {
      assert.equal(string.format('string'), '"string"');
    });

    it ('should format an object', function () {
      var obj = {
        a: 1.1111,
        b: math.complex(2.2222,3)
      };

      assert.equal(string.format(obj), '{"a": 1.1111, "b": 2.2222 + 3i}');
      assert.equal(string.format(obj, 3), '{"a": 1.11, "b": 2.22 + 3i}');
    });

    it ('should format an object with its own format function', function () {
      var obj = {
        format: function (options) {
          var str = 'obj';
          if (options !== undefined) {
            str += ' ' + JSON.stringify(options);
          }
          return str;
        }
      };

      assert.equal(string.format(obj), 'obj');
      assert.equal(string.format(obj, 4), 'obj 4');
      assert.equal(string.format(obj, {precision: 4}), 'obj {"precision":4}');
    });

    it ('should format a function', function () {
      assert.equal(string.format(function (a, b) {return a + b}), 'function');
      var f = function (a, b) {return a + b};
      f.syntax = 'f(x, y)';
      assert.equal(string.format(f), 'f(x, y)');
    });

    it ('should format unknown objects by converting them to string', function () {
      assert.equal(string.format({}), '{}');
    });

    it ('should format unknown primitives by converting them to string', function () {
      assert.equal(string.format(true), 'true');
    });

  });

});