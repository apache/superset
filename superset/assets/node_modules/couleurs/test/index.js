// Dependencies
var Couleurs = require("../lib")
  , Assert = require("assert")
  , FlatColors = require("flat-colors")
  ;

// Default behavior
it("should support basic color support", function (cb) {
    Assert.equal(
        new Couleurs("Hello World")
            .fg(FlatColors.colors[0])
            .bg(FlatColors.colors[1])
            .bold()
            .toString()
      , "\u001b[1m\u001b[48;5;41m\u001b[38;5;37mHello World\u001b[39m\u001b[49m\u001b[22m"
    );
    cb();
});

// Foreground color in constructor
it("should support foreground color in constructor", function (cb) {
    Assert.equal(
        Couleurs("Hello World", FlatColors.colors[0])
      , "\u001b[38;5;37mHello World\u001b[39m"
    );
    cb();
});

// Proto
it("it should handle prototype calls", function (cb) {
    Couleurs.proto();
    Assert.equal("Hello World".fg(FlatColors.colors[0])
      , "\u001b[38;5;37mHello World\u001b[39m"
    );
    cb();
});
