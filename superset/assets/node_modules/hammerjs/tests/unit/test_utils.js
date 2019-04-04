module('utils');

// for the tests, all hammer properties and methods of Hammer are exposed to window.$H

test('get/set prefixed util', function() {
    ok(_.isUndefined($H.prefixed(window, 'FakeProperty')), 'non existent property returns undefined');

    window.webkitFakeProperty = 1337;
    ok($H.prefixed(window, 'FakeProperty') == 'webkitFakeProperty', 'existent prefixed property returns the prefixed name');

    delete window.webkitFakeProperty;
});

test('fnBind', function() {
    var context = { a: true };

    $H.bindFn(function(b) {
        ok(this.a === true, 'bindFn scope');
        ok(b === 123, 'bindFn argument');
    }, context)(123);
});

test('Inherit objects', function() {
    function Base() {
        this.name = true;
    }

    function Child() {
        Base.call(this);
    }

    $H.inherit(Child, Base, {
        newMethod: function() {
        }
    });

    var inst = new Child();

    ok(inst.name == true, 'child has extended from base');
    ok(inst.newMethod, 'child has a new method');
    ok(Child.prototype.newMethod, 'child has a new prototype method');
    ok(inst instanceof Child, 'is instanceof Child');
    ok(inst instanceof Base, 'is instanceof Base');
    ok(inst._super === Base.prototype, '_super is ref to prototype of Base');
});

test('toArray', function() {
    ok(_.isArray($H.toArray({ 0: true, 1: 'second', length: 2 })), 'converted an array-like object to an array');
    ok(_.isArray($H.toArray([true, true])), 'array stays an array');
});

test('inArray', function() {
    ok($H.inArray([1, 2, 3, 4, 'hammer'], 'hammer') === 4, 'found item and returned the index');
    ok($H.inArray([1, 2, 3, 4, 'hammer'], 'notfound') === -1, 'not found an item and returned -1');
    ok($H.inArray([
        {id: 2},
        {id: 24}
    ], '24', 'id') === 1, 'find by key and return the index');
    ok($H.inArray([
        {id: 2},
        {id: 24}
    ], '22', 'id') === -1, 'not found by key and return -1');
});

test('splitStr', function() {
    deepEqual($H.splitStr(' a  b  c d   '), ['a', 'b', 'c', 'd'], 'str split valid');
});

test('uniqueArray', function() {
    deepEqual($H.uniqueArray([
        {id: 1},
        {id: 2},
        {id: 2}
    ], 'id'), [
        {id: 1},
        {id: 2}
    ], 'remove duplicate ids')
});

test('boolOrFn', function() {
    equal($H.boolOrFn(true), true, 'Passing an boolean');
    equal($H.boolOrFn(false), false, 'Passing an boolean');
    equal($H.boolOrFn(function() {
        return true;
    }), true, 'Passing an boolean');
    equal($H.boolOrFn(1), true, 'Passing an integer');
});

test('hasParent', function() {
    var parent = document.createElement('div'),
        child = document.createElement('div');

    document.body.appendChild(parent);
    parent.appendChild(child);

    equal($H.hasParent(child, parent), true, 'Found parent');
    equal($H.hasParent(parent, child), false, 'Not in parent');

    document.body.removeChild(parent);
});

test('each', function() {
    var object = { hi: true };
    var array = ['a', 'b', 'c'];
    var loop;

    loop = false;
    $H.each(object, function(value, key) {
        if (key == 'hi' && value === true) {
            loop = true;
        }
    });
    ok(loop, 'object loop');

    loop = 0;
    $H.each(array, function(value, key) {
        if (value) {
            loop++;
        }
    });
    ok(loop == 3, 'array loop');

    loop = 0;
    array.forEach = null;
    $H.each(array, function(value, key) {
        if (value) {
            loop++;
        }
    });
    ok(loop == 3, 'array loop without Array.forEach');
});

test('assign', function() {
    expect(2);
    deepEqual(
        $H.assign(
            {a: 1, b: 3},
            {b: 2, c: 3}
        ),
        {a: 1, b: 2, c: 3},
        'Simple extend'
    );

    var src = { foo: true };
    var dest = $H.assign({}, src);
    src.foo = false;
    deepEqual(dest, {foo: true}, 'Clone reference');
});

test('test add/removeEventListener', function() {
    function handleEvent() {
        ok(true, 'triggered event');
    }

    expect(2);

    $H.addEventListeners(window, 'testEvent1  testEvent2  ', handleEvent);
    utils.triggerDomEvent(window, 'testEvent1');
    utils.triggerDomEvent(window, 'testEvent2');

    $H.removeEventListeners(window, ' testEvent1 testEvent2 ', handleEvent);
    utils.triggerDomEvent(window, 'testEvent1');
    utils.triggerDomEvent(window, 'testEvent2');
});
