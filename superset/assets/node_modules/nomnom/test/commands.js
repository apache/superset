var nomnom = require("../nomnom");

function strip(str) {
  return str.replace(/\s+/g, '');
}

exports.testCallback = function(test) {
   test.expect(1);

   var parser = nomnom();
   parser.command('run').callback(function(options) {
      test.equal(options.v, 3);
   });
   parser.command('other').callback(function() {
      test.ok(false, "callback for other command shouldn't be called");
   });

   parser.parse(["run","-v", "3"]);
   test.done();
}

exports.testMissingCommand = function(test) {
   test.expect(1);

   var parser = nomnom().scriptName("test");

   parser.command('run');

   parser.printer(function(string) {
      test.equal(string, "test: no such command 'other'");
      test.done();
   });

   parser.parse(["other"]);
}

exports.testNoCommand = function(test) {
   test.expect(2);

   var parser = nomnom();

   parser.nocommand()
     .options({
        version: {
           flag: true
        }
     })
     .callback(function(options) {
        test.strictEqual(options.version, true);
     })
     .usage("fallback usage");

   parser.command('run');

   var options = parser.parse(["--version"]);

   test.strictEqual(options.version, true);
   test.done();
}

function createParser() {
  var parser = nomnom().scriptName("test")
     .options({
        debug: {
           flag: true
        }
     });

  parser.command('run')
    .options({
       file: {
          help: 'file to run'
       }
    })
    .help("run all");

  parser.command('test').usage("test usage");

  parser.nocommand()
    .options({
       verbose: {
          flag: true
       }
    })
    .help("nocommand");

  return parser;
}

exports.testUsage = function(test) {
   test.expect(4);

   var parser = createParser();
   parser.printer(function(string) {
      test.equal(strip(string), "testusage");
   });
   parser.parse(["test", "-h"]);

   parser = createParser().nocolors();
   parser.printer(function(string) {
      test.equal(strip(string), "Usage:testrun[options]Options:--debug--filefiletorunrunall");
   });
   parser.parse(["run", "-h"]);

   parser = createParser().nocolors();
   parser.printer(function(string) {
      test.equal(strip(string), "Usage:test[command][options]commandoneof:run,testOptions:--debug--verbosenocommand");
   });
   parser.parse(["-h"]);

   parser = createParser().nocolors();
   parser.nocommand()
      .usage("fallback");
   parser.printer(function(string) {
      test.equal(strip(string), "fallback");
   });
   parser.parse(["-h"]);

   test.done();
}
