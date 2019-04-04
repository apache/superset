var nomnom = require("../nomnom");

var parser = nomnom()
   .option('debug', {
      abbr: 'x',
      flag: true,
      help: 'Print debugging info'
   })
   .option('config', {
      abbr: 'c',
      default: 'config.json',
      help: 'JSON file with tests to run'
   })
   .option('version', {
      flag: true,
      help: 'print version and exit',
      callback: function() {
         return "version 1.2.4";
      }
   });


exports.testOption = function(test) {
   var opts = parser.parse(["-x", "--no-verbose"]);

   test.strictEqual(opts.debug, true);
   test.equal(opts.config, "config.json");
   test.done();
}


exports.testCommandOption = function(test) {
   var parser = nomnom()
   parser.command('test')
     .option('fruit', {
        abbr: 'f',
        flag: true
     })

   var opts = parser.parse(["test", "-f"]);

   test.strictEqual(opts.fruit, true);
   test.done();
}
