var assert = require("assert");
var fixtures = require("./fixtures/parse");

var parsers = {
  rgb   : require("../parse/rgb"),
  hex   : require("../parse/hex"),
  hsl   : require("../parse/hsl"),
  parse : require("../parse")
};

function test(from, colors) {
  var parser = parsers[from];
  colors.forEach(function(color) {
    assert.deepEqual(parser(color[0]), color[1]);
  });
}

for(var space in parsers) {
  console.log("parsing: " + space);
  test(space, fixtures[space]);
}