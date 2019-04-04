'use strict';

var _util = require('../util');

test('should return true if the term is in the strings', function () {
  var res = (0, _util.searchStrings)(['foobar', 'bar'], 'foo');
  expect(res).toBe(true);
}); /* globals test expect */


test('should return false if the term isn\'t in the strings', function () {
  var res = (0, _util.searchStrings)(['barbaz', 'bar'], 'foo');
  expect(res).toBe(false);
});

test('should return false if the term is in the strings but doesn\'t have the right case', function () {
  var res = (0, _util.searchStrings)(['foobaz', 'bar'], 'Foo');
  expect(res).toBe(false);
});