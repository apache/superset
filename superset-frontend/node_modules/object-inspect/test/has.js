var inspect = require('../');
var test = require('tape');

var withoutProperty = function (object, property, fn) {
    var original;
    if (Object.getOwnPropertyDescriptor) {
        original = Object.getOwnPropertyDescriptor(object, property);
    } else {
        original = object[property];
    }
    delete object[property];
    try {
        fn();
    } finally {
        if (Object.getOwnPropertyDescriptor) {
            Object.defineProperty(object, property, original);
        } else {
            object[property] = original;
        }
    }
};

test('when Object#hasOwnProperty is deleted', function (t) {
    t.plan(1);
    var arr = [1, , 3];
    Array.prototype[1] = 2; // this is needed to account for "in" vs "hasOwnProperty"
    withoutProperty(Object.prototype, 'hasOwnProperty', function () {
        t.equal(inspect(arr), '[ 1, , 3 ]');
    });
	delete Array.prototype[1];
});
