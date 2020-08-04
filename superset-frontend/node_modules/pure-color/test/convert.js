var convert = require("../convert");
var assert = require("assert");
var fixtures = require("./fixtures/convert");

function round(arr) {
  return arr.map(Math.round)
}

function equal(actual, expected) {
  if (!Array.isArray(expected)) {
    assert.equal(actual, expected);
  } else {
    assert.deepEqual(round(actual), expected);
  }
}

function test(from, to, colors) {
  var conversion = convert[from][to];
  colors.forEach(function(color) {
    equal(conversion(color[0]), color[1]);
  });
}

// dyanmically create tests for hwb...
for(var angle = 0; angle <= 360; angle ++) {
  // all extreme value should give black, white or grey
  fixtures.hwb.rgb.push([[angle, 0, 100], [0, 0, 0]]);
  fixtures.hwb.rgb.push([[angle, 100, 0], [255, 255, 255]]);
  fixtures.hwb.rgb.push([[angle, 100, 100], [128, 128, 128]]);
}

// run tests
for (var from in fixtures) {
  for (var to in fixtures[from]) {
    console.log("converting: " + from + "2" + to);
    test(from, to, fixtures[from][to]);
  }
}
