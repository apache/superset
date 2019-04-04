var nomnom = require("../nomnom");

function strip(str) {
  return str.replace(/\s+/g, '');
};

var opts = {
   apple: {
      abbr: 'a',
      help: 'how many apples'
   },

   banana: {
      full: "b-nana"
   },

   carrot: {
      string: '-c NUM, --carrots=NUM'
   },

   dill: {
      metavar: 'PICKLE'
   },

   egg: {
      position: 0,
      help: 'robin'
   }
}

var parser = nomnom().options(opts).help("all the best foods").scriptName("test").nocolors();

var expected = "Usage:test[egg][options]eggrobinOptions:-a,--applehowmanyapples--b-nana-cNUM,--carrots=NUM--dillPICKLEallthebestfoods"

exports.testH = function(test) {
   test.expect(1);

   parser.printer(function(string) {
      test.equal(strip(string), expected)
      test.done();
   })
   .nocolors()
   .parse(["-h"]);
}

exports.testHelp = function(test) {
   test.expect(1);

   parser.printer(function(string) {
      test.equal(strip(string), expected)
      test.done();
   })
   .nocolors()
   .parse(["--help"]);
}

exports.testScriptName = function(test) {
   test.expect(1);

   nomnom()
     .script("test")
     .printer(function(string) {
        test.equal(strip(string),"Usage:test")
        test.done();
     })
     .nocolors()
     .parse(["-h"]);
}

exports.testUsage = function(test) {
   test.expect(1);

   parser
      .usage("test usage")
      .printer(function(string) {
         test.equal(string, "test usage")
         test.done();
      })
      .nocolors()
      .parse(["--help"]);
}

exports.testHidden = function(test) {
   test.expect(1);

   nomnom().options({
      file: {
         hidden: true
      }
   })
   .scriptName("test")
   .printer(function(string) {
      test.equal(strip("Usage:test[options]Options:"), strip(string))
      test.done();
   })
   .nocolors()
   .parse(["-h"]);
}

exports.testRequiredOptional = function(test) {
   test.expect(1);

   nomnom().options({
      foo: {
         position: 0,
         required: true,
         help: 'The foo'
      },
      bar: {
         position: 1,
         help: 'The bar'
      }
   })
   .scriptName("test")
   .printer(function(string) {
      test.equal(strip("Usage:test<foo>[bar]fooThefoobarThebar"), strip(string))
      test.done();
   })
   .nocolors()
   .parse(["-h"]);
}
