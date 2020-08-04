var nomnom = require("../nomnom");

var opts = {
   debug: {
      flag: true
   },
   verbose: {
      flag: true,
      default: true
   },
   list1: {
      list: true
   },
   list2: {
      list: true
   },
   list3: {
      position: 1,
      list: true
   },
   num1: {
      type: "string"
   },
   def1: {
      default: "val1"
   },
   def2: {
      default: "val1"
   }
}

var parser = nomnom().options(opts);

exports.testFlag = function(test) {
   var options = parser.parse(["--debug", "pos0", "--no-verbose"]);

   test.strictEqual(options.debug, true);
   test.strictEqual(options.verbose, false);
   test.equal(options[0], "pos0");
   test.equal(options._[0], "pos0");
   test.done();
}

exports.testList = function(test) {
   var options = parser.parse(["pos0", "pos1", "--list1=val0", "--list2", "val1",
     "--list2", "val2", "pos2"]);
  
   test.deepEqual(options.list1, ["val0"]);
   test.deepEqual(options.list2, ["val1", "val2"]);
   test.deepEqual(options.list3, ["pos1", "pos2"]);
   test.done();
}

exports.testDefault = function(test) {
   var options = parser.parse(["--def2", "val2", "--def3", "val3"]);

   test.strictEqual(options.def1, "val1");
   test.strictEqual(options.def2, "val2");
   test.strictEqual(options.def3, "val3");
   test.done();
}

exports.testTypes = function(test) {
   var options = parser.parseArgs(["", "-x", "3.14", "-w", "true", "-q", "120",
     "--num1", "4"]);
     
   test.strictEqual(options[0], "");
   test.strictEqual(options.x, 3.14);
   test.strictEqual(options.w, true);
   test.strictEqual(options.q, 120);
   test.strictEqual(options.num1, "4");
   test.done();
}


