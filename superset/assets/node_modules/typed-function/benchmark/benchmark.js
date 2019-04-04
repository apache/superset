var typed = require('../typed-function');

var I_MAX = 1e6;

function benchmark(name, test) {
  var start = +new Date();

  var repetitions = test();

  var end = +new Date();
  var duration = end - start;

  console.log(name + ': ' + repetitions.toExponential() + ' calls, ' +
      Math.round(duration) + ' ms, ' +
      parseFloat((duration / repetitions).toPrecision(4)).toExponential() + ' ms per call');

  return {
    repetitions: repetitions,
    duration: duration
  };
}


//var count = 0;
//function direct() {
//  var args = Array.prototype.slice.apply(arguments);
//  args.forEach(function (arg) {
//    count = count + (arg && arg.length) ? arg.length : 1;
//  });
//  return count;
//}

function direct(text) {
  var reverse = '';
  var i = text.length;
  while (i > 0) {
    reverse += text.substring(i-1, i);
    i--;
  }
  return reverse;
}

//var count = 0;
//function direct() {
//  return count++;
//}

var fn = typed({
  'number': direct,
  'number,boolean': direct,
  'number,number': direct,
  'number,Date': direct,
  'string': direct,
  'string,boolean': direct
});

//console.log(composed.toString())

var directResult = benchmark('Direct', function () {
  var i, r, d = new Date();
  for (i = 0; i < I_MAX; i++) {
    r = direct(1, d);
    r = direct('hello you there', false);
    r = direct(2, 4);
  }

  return I_MAX * 3;
});

var typedResult = benchmark('Composed', function () {
  var i, r, d = new Date();
  for (i = 0; i < I_MAX; i++) {
    r = fn(1, d);
    r = fn('hello you there', false);
    r = fn(2, 4);
  }

  return I_MAX * 3;
});


var overhead = ((typedResult.duration - directResult.duration) / typedResult.repetitions);
var percentage = overhead / (directResult.duration / directResult.repetitions) * 100;
console.log('Overhead: ' + percentage.toPrecision(4) + '%, ' +
    parseFloat(overhead.toPrecision(4)).toExponential() + ' ms per call');

// Output is for example:
//   Direct: 3e+6 calls, 1865 ms, 6.217e-4 ms per call
//   Composed: 3e+6 calls, 1982 ms, 6.607e-4 ms per call
//   Overhead: 6.3%, 3.9e-5 ms per call

