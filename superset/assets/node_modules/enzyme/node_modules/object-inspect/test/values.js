var inspect = require('../');
var test = require('tape');

test('values', function (t) {
    t.plan(1);
    var obj = [ {}, [], { 'a-b': 5 } ];
    t.equal(inspect(obj), '[ {}, [], { \'a-b\': 5 } ]');
});

test('arrays with properties', function (t) {
   t.plan(1);
   var arr = [3];
   arr.foo = 'bar';
   var obj = [1, 2, arr];
   obj.baz = 'quux';
   obj.index = -1;
   t.equal(inspect(obj), '[ 1, 2, [ 3, foo: \'bar\' ], baz: \'quux\', index: -1 ]');
});

test('has', function (t) {
    t.plan(1);
    var has = Object.prototype.hasOwnProperty;
    delete Object.prototype.hasOwnProperty;
    t.equal(inspect({ a: 1, b: 2 }), '{ a: 1, b: 2 }');
    Object.prototype.hasOwnProperty = has;
});

test('indexOf seen', function (t) {
    t.plan(1);
    var xs = [ 1, 2, 3, {} ];
    xs.push(xs);
    
    var seen = [];
    seen.indexOf = undefined;
    
    t.equal(
        inspect(xs, {}, 0, seen),
        '[ 1, 2, 3, {}, [Circular] ]'
    );
});

test('seen seen', function (t) {
    t.plan(1);
    var xs = [ 1, 2, 3 ];
    
    var seen = [ xs ];
    seen.indexOf = undefined;
    
    t.equal(
        inspect(xs, {}, 0, seen),
        '[Circular]'
    );
});

test('seen seen seen', function (t) {
    t.plan(1);
    var xs = [ 1, 2, 3 ];
    
    var seen = [ 5, xs ];
    seen.indexOf = undefined;
    
    t.equal(
        inspect(xs, {}, 0, seen),
        '[Circular]'
    );
});

test('symbols', { skip: typeof Symbol !== 'function' }, function (t) {
    var sym = Symbol('foo');
    t.equal(inspect(sym), 'Symbol(foo)', 'Symbol("foo") should be "Symbol(foo)"');
    t.equal(inspect(Object(sym)), 'Object(Symbol(foo))', 'Object(Symbol("foo")) should be "Object(Symbol(foo))"');
    t.end();
});

test('Map', { skip: typeof Map !== 'function' }, function (t) {
    var map = new Map();
    map.set({ a: 1 }, ['b']);
    map.set(3, NaN);
    var expectedString = 'Map (2) {' + inspect({ a: 1 }) + ' => ' + inspect(['b']) + ', 3 => NaN}';
    t.equal(inspect(map), expectedString, 'new Map([[{ a: 1 }, ["b"]], [3, NaN]]) should show size and contents');
    t.equal(inspect(new Map()), 'Map (0) {}', 'empty Map should show as empty');

    var nestedMap = new Map();
    nestedMap.set(nestedMap, map);
    t.equal(inspect(nestedMap), 'Map (1) {[Circular] => ' + expectedString + '}', 'Map containing a Map should work');

    t.end();
});

test('Set', { skip: typeof Set !== 'function' }, function (t) {
    var set = new Set();
    set.add({ a: 1 });
    set.add(['b']);
    var expectedString = 'Set (2) {' + inspect({ a: 1 }) + ', ' + inspect(['b']) + '}';
    t.equal(inspect(set), expectedString, 'new Set([{ a: 1 }, ["b"]]) should show size and contents');
    t.equal(inspect(new Set()), 'Set (0) {}', 'empty Set should show as empty');

    var nestedSet = new Set();
    nestedSet.add(set);
    nestedSet.add(nestedSet);
    t.equal(inspect(nestedSet), 'Set (2) {' + expectedString + ', [Circular]}', 'Set containing a Set should work');

    t.end();
});

test('Strings', function (t) {
    var str = 'abc';

    t.equal(inspect(str), "'" + str + "'", 'primitive string shows as such');
    t.equal(inspect(str, { quoteStyle: 'single' }), "'" + str + "'", 'primitive string shows as such, single quoted');
    t.equal(inspect(str, { quoteStyle: 'double' }), '"' + str + '"', 'primitive string shows as such, double quoted');
    t.equal(inspect(Object(str)), 'Object(' + inspect(str) + ')', 'String object shows as such');
    t.equal(inspect(Object(str), { quoteStyle: 'single' }), 'Object(' + inspect(str, { quoteStyle: 'single' }) + ')', 'String object shows as such, single quoted');
    t.equal(inspect(Object(str), { quoteStyle: 'double' }), 'Object(' + inspect(str, { quoteStyle: 'double' }) + ')', 'String object shows as such, double quoted');

    t.end();
});

test('Numbers', function (t) {
    var num = 42;

    t.equal(inspect(num), String(num), 'primitive number shows as such');
    t.equal(inspect(Object(num)), 'Object(' + inspect(num) + ')', 'Number object shows as such');

    t.end();
});

test('Booleans', function (t) {
    t.equal(inspect(true), String(true), 'primitive true shows as such');
    t.equal(inspect(Object(true)), 'Object(' + inspect(true) + ')', 'Boolean object true shows as such');

    t.equal(inspect(false), String(false), 'primitive false shows as such');
    t.equal(inspect(Object(false)), 'Object(' + inspect(false) + ')', 'Boolean false object shows as such');

    t.end();
});
