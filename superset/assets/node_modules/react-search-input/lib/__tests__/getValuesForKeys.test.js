'use strict';

var _immutable = require('immutable');

var _util = require('../util');

/* globals test expect */
test('should get the values to search on in an object', function () {
  var value = (0, _util.getValuesForKey)('foo', {
    foo: 'bar'
  });
  expect(value).toEqual(['bar']);
});

test('should get the values to search on in an array', function () {
  var value = (0, _util.getValuesForKey)('foo', [{
    foo: 'bar'
  }]);
  expect(value).toEqual(['bar']);
});

test('should get the values to search on in a nested object', function () {
  var value = (0, _util.getValuesForKey)('foo.bar', {
    foo: {
      bar: 'baz'
    }
  });
  expect(value).toEqual(['baz']);
});

test('should get the values to search on in a nested array', function () {
  var value = (0, _util.getValuesForKey)('foo', {
    foo: ['bar', 'baz']
  });
  expect(value).toEqual(['bar', 'baz']);
});

test('should get the values to search on in a nested array', function () {
  var value = (0, _util.getValuesForKey)('foo.bar', {
    foo: [{
      bar: 'baz'
    }, {
      bar: 'baz2'
    }]
  });
  expect(value).toEqual(['baz', 'baz2']);
});

test('should get the values to search on in a nested array with an index', function () {
  var value = (0, _util.getValuesForKey)('foo.1.bar', {
    foo: [{
      bar: 'baz'
    }, {
      bar: 'baz2'
    }]
  });
  expect(value).toEqual(['baz2']);
});

test('should ignore undefined values', function () {
  var value = (0, _util.getValuesForKey)('fooz', {
    foo: [{
      bar: 'baz'
    }, {
      bar: 'baz2'
    }]
  });
  expect(value).toEqual([]);
});

test('should get the values to search on in an immutable map', function () {
  var value = (0, _util.getValuesForKey)('foo.bar', (0, _immutable.Map)({
    foo: {
      bar: 'baz'
    }
  }));
  expect(value).toEqual(['baz']);
});

test('should ignore non-string and non-number values', function () {
  var value = (0, _util.getValuesForKey)('foo.bar', {
    foo: [{
      bar: []
    }, {
      bar: []
    }]
  });
  expect(value).toEqual([]);
});