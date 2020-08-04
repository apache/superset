var nomnom = require("../nomnom");

var opts = {
   file: {
      position: 0,
      required: true
   }
}

var parser = nomnom().options(opts);

exports.testFlag = function(test) {
   test.expect(1);

   nomnom().options({
      file: {
         position: 0,
      }
   })
   .printer(function(string) {
      test.equal(0, string.indexOf("'--key1' expects a value"))
      test.done();
   })
   .parse(["--key1"]);
}

exports.testRequired = function(test) {
   test.expect(1);

   nomnom().options({
      file: {
         required: true
      }
   })
   .printer(function(string) {
      test.equal(0, string.trim().indexOf("file argument is required"))
      test.done();
   })
   .nocolors()
   .parse([]);
}

exports.testChoices = function(test) {
   test.expect(2);

   var parser = nomnom().options({
      color: {
         choices: ['green', 'blue']
      }
   })
   .printer(function(string) {
      test.equal(0, string.indexOf("color must be one of: green, blue"))
   });

   parser.parse(['--color', 'red']);

   var options = parser.parse(['--color', 'green']);
   test.equal(options.color, 'green');
   test.done();
}
