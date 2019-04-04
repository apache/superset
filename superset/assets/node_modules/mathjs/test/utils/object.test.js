// test object utils
var assert = require('assert'),
    approx = require('../../tools/approx'),
    object = require('../../lib/utils/object');

describe ('object', function () {

  describe('clone', function() {

    it('should clone undefined', function () {
      assert.strictEqual(object.clone(undefined), undefined);
    });

    it('should clone null', function () {
      assert.strictEqual(object.clone(null), null);
    });

    it('should clone booleans', function () {
      assert.strictEqual(object.clone(true), true);
      assert.strictEqual(object.clone(false), false);
      assert.ok(object.clone(new Boolean(true)) instanceof Boolean);
      assert.equal(object.clone(new Boolean(true)), true);
      assert.equal(object.clone(new Boolean(false)), false);
    });

    it('should clone numbers', function () {
      assert.strictEqual(object.clone(2.3), 2.3);
      assert.ok(object.clone(new Number(2.3)) instanceof Number);
      assert.equal(object.clone(new Number(2.3)), 2.3);
    });

    it('should clone strings', function () {
      assert.strictEqual(object.clone('hello'), 'hello');
      assert.ok(object.clone(new String('hello')) instanceof String);
      assert.equal(object.clone(new String('hello')), 'hello');
    });

    it('should (deep) clone objects', function () {
      var obj = {a: {b: 'c', d: new Date(2014,0,1)}};
      var clone = object.clone(obj);

      assert.deepEqual(obj, clone);

      // check whether the clone remains unchanged when changing the original object
      obj.a.b = 'cc';

      assert.equal(clone.a.b, 'c');

      obj.a.d.setMonth(2);
      assert.equal(clone.a.d.valueOf(), new Date(2014,0,1).valueOf());
    });

    it('should clone dates', function () {
      var d1 = new Date(2014,1,1);
      var d2 = object.clone(d1);
      assert.equal(d1.valueOf(), d2.valueOf());
      d1.setMonth(2);
      assert.notEqual(d1, d2);
    });

    it('should (deep) clone arrays', function () {
      var d = new Date(2014,0,1);
      var arr = [1, 2, d, {a: 3}]
      var clone = object.clone(arr);

      assert.deepEqual(arr, clone);
      assert.notStrictEqual(arr, clone);
      assert.notStrictEqual(arr[2], clone[2]);
      assert.notStrictEqual(arr[3], clone[3]);

      // check whether the clone remains unchanged when changing the original object
      arr[2] = null;
      arr[3].a = 1;
      d.setMonth(2);
      assert.equal(clone[2].valueOf(), new Date(2014,0,1).valueOf());
      assert.equal(clone[3].a, 3);
    });

    it('should throw an error in case of an unsupported type', function () {
      assert.throws(function () {object.clone(/a regexp/)}, /Cannot clone/);
    });
  });

  describe('extend', function() {
    it ('should extend an object with all properties of an other object', function () {
      var e = {};
      var o1 = {a: 2, b: 3};
      var o2 = {a: 4, b: null, c: undefined, d: 5, e: e};
      var o3 = object.extend(o1, o2);

      assert.strictEqual(o1, o3);
      assert.strictEqual(o1.e, o3.e);
      assert.deepEqual(o3, {a: 4, b: null, c: undefined, d: 5, e: e});
      assert.deepEqual(o2, {a: 4, b: null, c: undefined, d: 5, e: e}); // should be unchanged
    });

    it('should ignore inherited properties when extending an object', function () {
      Object.prototype.foo = 'bar';
      var o1 = {a: 2, b: 3};
      var o2 = object.extend({}, o1);

      assert.equal(o2['foo'], 'bar');
      assert.equal(o2.hasOwnProperty('foo'), false);

      delete Object.prototype.foo;
    });
  });

  describe('deepExtend', function() {
    it ('should deep extend an object with all properties of an other object', function () {
      var e = {f: {g: 3}};
      var o1 = {a: 2, b: 3};
      var o2 = {a: 4, b: null, c: undefined, d: 5, e: e};
      var o3 = object.deepExtend(o1, o2);

      assert.strictEqual(o1, o3);
      assert.notStrictEqual(o3.e, o2.e);
      assert.deepEqual(o3, {a: 4, b: null, c: undefined, d: 5, e: {f: {g: 3}}});
      assert.deepEqual(o2, {a: 4, b: null, c: undefined, d: 5, e: {f: {g: 3}}}); // should be unchanged

      e.f.g = 4;
      assert.deepEqual(o3, {a: 4, b: null, c: undefined, d: 5, e: {f: {g: 3}}}); // should be unchanged
      assert.deepEqual(o2, {a: 4, b: null, c: undefined, d: 5, e: {f: {g: 4}}}); // should be changed
    });

    it ('should throw an error when deep extending an array (is not yet supported)', function () {
      assert.throws(function () {object.deepExtend({}, [])}, /Arrays are not supported by deepExtend/);
      assert.throws(function () {object.deepExtend({}, {a: []})}, /Arrays are not supported by deepExtend/);
      assert.throws(function () {object.deepExtend({}, {a: {b: []}})}, /Arrays are not supported by deepExtend/);
    });

    it('should ignore inherited properties when deep extending an object', function () {
      Object.prototype.foo = 'bar';
      var o1 = {a: 2, b: 3};
      var o2 = object.deepExtend({}, o1);

      assert.equal(o2['foo'], 'bar');
      assert.equal(o2.hasOwnProperty('foo'), false);

      delete Object.prototype.foo;
    });
  });

  describe('deepEqual', function() {

    it('should deep compare two objects', function () {
      assert.equal(object.deepEqual({}, {}), true);

      assert.equal(object.deepEqual({a: 2, b: 3}, {a: 2, b: 3}), true);
      assert.equal(object.deepEqual({a: 2, b: 3}, {a: 2, b: 4}), false);
      assert.equal(object.deepEqual({a: 2, b: 3}, {a: 2}), false);
      assert.equal(object.deepEqual({a: 2}, {a: 2, b: 3}), false);
      assert.equal(object.deepEqual({a: 2, b: 3}, {a: 2, b: {}}), false);
      assert.equal(object.deepEqual({a: 2, b: {}}, {a: 2, b: {}}), true);

      assert.equal(object.deepEqual({a: 2, b: {c: 4}}, {a: 2, b: {c: 4}}), true);
      assert.equal(object.deepEqual({a: 2, b: {c: 4}}, {a: 2, b: {c : 5}}), false);
      assert.equal(object.deepEqual({a: 2, b: {c: 4}}, {a: 2, b: {}}), false);
      assert.equal(object.deepEqual({a: 2, b: {}}, {a: 2, b: {c: 4}}), false);
    });

    it('should deep compare two arrays', function () {
      assert.equal(object.deepEqual([], []), true);
      assert.equal(object.deepEqual([1, 2], [1, 2]), true);
      assert.equal(object.deepEqual([1, 2], [1, 2, 3]), false);
      assert.equal(object.deepEqual([1, 0, 3], [1, 2, 3]), false);

      assert.equal(object.deepEqual([1, 2, [3, 4]], [1, 2, [3, 4]]), true);
      assert.equal(object.deepEqual([1, 2, [3]], [1, 2, [3, 4]]), false);
      assert.equal(object.deepEqual([1, 2, [3, 4]], [1, 2, [3]]), false);
      assert.equal(object.deepEqual([1, 2, null], [1, 2, [3]]), false);
      assert.equal(object.deepEqual([1, 2, [3]], [1, 2, null]), false);
      assert.equal(object.deepEqual([1, 2, 3], [1, 2, [3]]), false);
      assert.equal(object.deepEqual([1, 2, [3]], [1, 2, 3]), false);
    });

    it('should deep compare mixed objects an arrays', function () {
      assert.equal(object.deepEqual({}, []), false);
      assert.equal(object.deepEqual({a: {}}, {a: []}), false);

      assert.equal(object.deepEqual({a: [1,2,3]}, {a:[1,2,3]}), true);
      assert.equal(object.deepEqual({a: [1,2,{}]}, {a:[1,2,{}]}), true);
      assert.equal(object.deepEqual({a: [1,2,{b: 4}]}, {a:[1,2,{b: 4}]}), true);
      assert.equal(object.deepEqual({a: [1,2,{b: 4}]}, {a:[1,2,{b: 5}]}), false);
      assert.equal(object.deepEqual({a: [1,2,{b: 4}]}, {a:[1,2,{}]}), false);

      assert.equal(object.deepEqual([1, 2, {}], [1, 2, {}]), true);
      assert.equal(object.deepEqual([1, 2, {a: 3}], [1, 2, {a : 3}]), true);
      assert.equal(object.deepEqual([1, 2, {a: 3}], [1, 2, {a : 4}]), false);
      assert.equal(object.deepEqual([1, 2, {a: 3}], [1, 2, 3]), false);
      assert.equal(object.deepEqual([1, 2, 3], [1, 2, {a: 3}]), false);
      assert.equal(object.deepEqual([1, 2, {a: [3, 4]}], [1, 2, {a: [3, 4]}]), true);
      assert.equal(object.deepEqual([1, 2, {a: [3, 4]}], [1, 2, {a: [3, 4, 5]}]), false);
    });

    it('should not ignore inherited properties during comparison', function () {
      Object.prototype.foo = 'bar';

      assert.equal(object.deepEqual({}, {}), true);
      assert.equal(object.deepEqual({foo: 'bar'}, {}), true);

      delete Object.prototype.foo;
    });
  });

  describe('canDefineProperty', function() {

    it('should test whether defineProperty is available', function () {
      assert.equal(object.canDefineProperty(), true);
    });
  });


  describe('lazy', function() {

    it('should get a lazy property', function () {
      var obj = {};
      var count = 0;
      object.lazy(obj, 'x', function () {
        count++;
        return 2;
      });

      var x = obj.x;
      assert.equal(x, 2);
      assert.equal(count, 1);

      var x2 = obj.x;
      assert.equal(x2, 2);
      assert.equal(count, 1);
    });

    it('should set a lazy property', function () {
      var obj = {};
      object.lazy(obj, 'x', function () {
        return 2;
      });

      obj.x = 3;
      var x = obj.x;
      assert.equal(x, 3);
    });

  });

  describe('traverse', function() {

    it('should traverse an existing path into an object', function () {
      var a = {};
      var b = {a: a};
      var c = {b: b};

      assert.strictEqual(object.traverse(c), c);
      assert.strictEqual(object.traverse(c, ''), c);
      assert.strictEqual(object.traverse(c, 'b'), b);
      assert.strictEqual(object.traverse(c, 'b.a'), a);
    });

    it('should append missing piece of a path', function () {
      var a = {};
      var b = {a: a};
      var c = {b: b};

      assert.strictEqual(object.traverse(c), c);
      assert.strictEqual(object.traverse(c, ''), c);
      assert.strictEqual(object.traverse(c, 'b'), b);
      assert.strictEqual(object.traverse(c, 'b.a'), a);
      assert.strictEqual(object.traverse(c, 'b.d'), b.d);
      assert.strictEqual(object.traverse(c, 'b.e.f'), b.e.f);
    });

  });

  describe ('isFactory', function () {

    it('should test whether an object is a factory', function () {
      assert.equal(object.isFactory({}), false);
      assert.equal(object.isFactory({foo: true}), false);
      assert.equal(object.isFactory({name: 'foo'}), false);
      assert.equal(object.isFactory({name: 'foo', factory: 'bar'}), false);
      assert.equal(object.isFactory({name: 2, factory: function () {}}), true);
      assert.equal(object.isFactory({factory: function () {}}), true);

      assert.equal(object.isFactory({name: 'foo', factory: function () {}}), true);
      assert.equal(object.isFactory({name: 'foo', factory: function () {}, foo: 'bar'}), true);
    });

  })
});