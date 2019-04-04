var typed = require('../typed-function');

// create a typed function
var fn1 = typed({
  'number, string': function (a, b) {
    return 'a is a number, b is a string';
  }
});

// create a typed function with multiple types per argument (type union)
var fn2 = typed({
  'string, number | boolean': function (a, b) {
    return 'a is a string, b is a number or boolean';
  }
});

// create a typed function with any type argument
var fn3 = typed({
  'string, any': function (a, b) {
    return 'a is a string, b can be anything';
  }
});


// use the function
console.log(fn1(2, 'foo')); // outputs 'a is a number, b is a string'

// calling the function with a non-supported type signature will throw an error
try {
  fn2('hello', 'world');
}
catch (err) {
  console.log('Wrong input will throw an error:');
  console.log('  ' + err.toString());
  // outputs:  TypeError: Unexpected type of argument (expected: number or
  //           boolean, actual: string, index: 1)
}
