'use strict';

/* eslint max-statements-per-line: [2, { "max": 2 }] */

var test = require('tape');
var globalCache = require('./');
var hasSymbols = typeof Symbol === 'function' && typeof Symbol('foo') === 'symbol';

test('exceptions', function (t) {
	t['throws'](function () { globalCache.get({}); }, '`get` throws on non-primitive key');
	t['throws'](function () { globalCache.set({}); }, '`set` throws on non-primitive key');
	t['throws'](function () { globalCache.has({}); }, '`has` throws on non-primitive key');
	t['throws'](function () { globalCache['delete']({}); }, '`delete` throws on non-primitive key');
	t['throws'](function () { globalCache.setIfMissingAndGet({}); }, '`setIfMissingAndGet` throws on non-primitive key');

	t.end();
});

test('basic usage', function (t) {
	var key = 'foo';
	var bar = { baz: 'quux' };
	var baz = { quux: 'xyzzy' };

	t.notOk(globalCache.has(key), 'global cache starts out without key');

	t.ok(globalCache.set(key, bar), 'global cache is able to set key');
	t.ok(globalCache.has(key), 'global cache has key');
	t.equal(globalCache.get(key), bar, 'global cache returns value for key');

	t.ok(globalCache.set(key, baz), 'global cache is able to re-set key');
	t.ok(globalCache.has(key), 'global cache still has key');
	t.equal(globalCache.get(key), baz, 'global cache returns new value for key');

	t.notOk(key in global, 'key is not in global object');

	t.ok(globalCache['delete'](key), 'global cache can delete key');
	t.notOk(globalCache.has(key), 'global cache does not have key');
	t.equal(globalCache.get(key), undefined, 'global cache returns undefined for key');

	globalCache.set(key, bar);
	t.ok(globalCache.has(key), 'global cache has key before clear');
	globalCache.clear();
	t.notOk(globalCache.has(key), 'global cache does not have key after clear');

	t.end();
});

test('.setIfMissingThenGet()', function (t) {
	var key = 'missing';
	var a = {};
	var b = {};
	var values = [a, b];
	var thunk = function () { return values.pop(); };

	t.notOk(globalCache.has(key), 'global cache starts out without key');
	t.equal(globalCache.setIfMissingThenGet(key, thunk), b, 'global cache sets result of thunk');
	t.deepEqual(values, [a], 'values array has last item popped off');

	t.equal(globalCache.setIfMissingThenGet(key, thunk), b, 'global cache skips thunk when has key');
	t.deepEqual(values, [a], 'values array is unchanged');

	t.ok(globalCache['delete'](key), 'global cache can delete key');
	t.equal(globalCache.setIfMissingThenGet(key, thunk), a, 'global cache sets result of thunk');
	t.deepEqual(values, [], 'values array has last item popped off');

	t.end();
});

test('symbols', { skip: !hasSymbols }, function (t) {
	var sym = Symbol('foo');
	var bar = { baz: 'quux' };

	t.notOk(globalCache.has(sym), 'global cache starts out without symbol key');

	t.ok(globalCache.set(sym, bar), 'global cache is able to set symbol key');
	t.ok(globalCache.has(sym), 'global cache has symbol key');
	t.equal(globalCache.get(sym), bar, 'global cache returns value for symbol key');

	t.notOk(sym in global, 'symbol key is not in global object');

	t.ok(globalCache['delete'](sym), 'global cache can delete symbol key');
	t.notOk(globalCache.has(sym), 'global cache does not have symbol key');
	t.equal(globalCache.get(sym), undefined, 'global cache returns undefined for symbol key');

	t.test('when the module is included twice', { skip: !require.cache }, function (st) {
		Object.keys(require.cache).some(function (id) {
			if (require.cache[id].exports === globalCache) {
				delete require.cache[id];
				return true;
			}
			return false;
		});
		// eslint-disable-next-line global-require
		var globalCache2 = require('./');
		st.notEqual(globalCache, globalCache2, 'both cache objects are different');

		globalCache.set('foo', bar);
		var bar2 = globalCache2.get('foo');
		st.equal(bar2, bar, 'global cache 2 can retrieve things global cache 1 sets');
		st.end();
	});

	t.end();
});
