var typed = require('../typed-function');

// create a typed function with multiple signatures
var fn = typed({
  'number': function (a) {
    return 'a is a number';
  },
  'number, boolean': function (a, b) {
    return 'a is a number, b is a boolean';
  },
  'number, number': function (a, b) {
    return 'a is a number, b is a number';
  }
});

// use the function
console.log(fn(2, true));      // outputs 'a is a number, b is a boolean'
console.log(fn(2));            // outputs 'a is a number'
