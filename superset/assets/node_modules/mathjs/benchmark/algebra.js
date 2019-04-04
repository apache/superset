// test performance of the expression parser in node.js

var Benchmark = require('benchmark');
var padRight = require('pad-right');
var math = require('../index');

function pad (text) {
  return padRight(text, 40, ' ');
}

var simplifyExpr = '2 * 1 * x ^ (2 - 1)';
var derivativeExpr = '2x^2 + log(3x) + 2x + 3';

console.log('simplify ' + simplifyExpr);
console.log('    ' + math.simplify(simplifyExpr));
console.log('derivative ' + derivativeExpr);
console.log('    ' + math.derivative(derivativeExpr, 'x'));

var suite = new Benchmark.Suite();
suite
    .add(pad('algebra simplify '), function() {
      var res = math.simplify(simplifyExpr);
    })
    .add(pad('algebra derivative'), function() {
      var res = math.derivative(derivativeExpr, 'x');
    })
    .on('cycle', function(event) {
      console.log(String(event.target));
    })
    .on('complete', function() {
    })
    .run();
