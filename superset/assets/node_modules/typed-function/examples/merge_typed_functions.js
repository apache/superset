var typed = require('../typed-function');

// create a couple of typed functions
var fn1 = typed({
  'number': function (a) {
    return a + a;
  }
});
var fn2 = typed({
  'string': function (a) {
    var value = +a;
    return value + value;
  }
});

// merge multiple typed functions
var fn3 = typed(fn1, fn2);

// use merged function
console.log(fn3(2));    // outputs 4
console.log(fn3('3'));  // outputs 6
