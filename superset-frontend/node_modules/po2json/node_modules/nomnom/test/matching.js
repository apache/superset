var nomnom = require("../nomnom");
    
var opts = {
   pos1: {
      position: 0
   },
   pos2: {
      position: 1
   },
   flag1: {
      flag: true
   },
   debug: {
      abbr: 'd'
   },
   numLines: {
      abbr: 'n',
      full: 'num-lines'
   },
   version: {
      string: '-v, --version'
   },
   config: {
      string: '-c FILE, --config=FILE'
   },
   skey : {
      string: '-k val'
   },
   skey2: {
      string: '-k2 val2, --key2 val2'
   },
   skey3: {
      string: '--key3=val'
   },
   skey4: {
      string: '--key4=val, -y val'
   }
}

var parser = nomnom().options(opts);

exports.testPositional = function(test) {
   var options = parser.parse(["--flag1", "val1", "--config", "file", "val2"]);
   
   test.equal(options.pos1, "val1");
   test.equal(options.pos2, "val2");
   test.deepEqual(options._, ["val1", "val2"])
   test.done();
}

exports.testAbbr = function(test) {
   var options = parser.parse(["-d", "yes", "--num-lines", "3"]);
   
   test.equal(options.debug, "yes")
   test.equal(options.numLines, 3)
   test.done();
}

exports.testString = function(test) {
   var options = parser.parse(["-k", "val", "--config=test.js",
      "--key2", "val2", "--key3", "val3", "--key4=val4", "-v", "v0.3"]);

   test.equal(options.version, "v0.3")
   test.equal(options.config, "test.js")
   test.equal(options.skey, "val")
   test.equal(options.skey2, "val2")
   test.equal(options.skey3, "val3")
   test.equal(options.skey4, "val4")
   test.done();
}
