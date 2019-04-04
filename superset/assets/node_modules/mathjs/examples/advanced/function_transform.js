/**
 * Function transforms
 *
 * When using functions via the expression parser, it is possible to preprocess
 * function arguments and post process a functions return value by writing a
 * *transform* for the function. A transform is a function wrapping around a
 * function to be transformed or completely replaces a function.
 */
var math = require('../../index');

// create a function
function addIt(a, b) {
  return a + b;
}

// attach a transform function to the function addIt
addIt.transform = function (a, b) {
  console.log('input: a=' + a + ', b=' + b);
  // we can manipulate the input arguments here before executing addIt

  var res = addIt(a, b);

  console.log('result: ' + res);
  // we can manipulate the result here before returning

  return res;
};

// import the function into math.js
math.import({
  addIt: addIt
});

// use the function via the expression parser
console.log('Using expression parser:');
console.log('2+4=' + math.eval('addIt(2, 4)'));
// This will output:
//
//     input: a=2, b=4
//     result: 6
//     2+4=6

// when used via plain JavaScript, the transform is not invoked
console.log('');
console.log('Using plain JavaScript:');
console.log('2+4=' + math.addIt(2, 4));
// This will output:
//
//     6
