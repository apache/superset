// test performance of the expression parser in node.js

var Benchmark = require('benchmark');
var padRight = require('pad-right');
var math = require('../index');

function pad (text) {
  return padRight(text, 40, ' ');
}

var expr = '2 + 3 * sin(pi / 4) - 4x';
var scope = {x: 2};
var compiled = math.parse(expr).compile();

console.log('expression:', expr);

var suite = new Benchmark.Suite();
suite
    .add(pad('expression parse and evaluate'), function() {
      var res = math.eval(expr, scope);
    })
    .add(pad('expression parse and compile'), function() {
      var c = math.parse('2 + 3 * sin(pi / 4) - 4x').compile();
    })
    .add(pad('expression parse'), function() {
      var node = math.parse('2 + 3 * sin(pi / 4) - 4x');
    })
    .add(pad('evaluate'), function() {
      var res = compiled.eval(scope);
    })
    .on('cycle', function(event) {
      console.log(String(event.target));
    })
    .on('complete', function() {
    })
    .run();
