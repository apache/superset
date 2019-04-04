var nomnom = require("../nomnom");

exports.testVersion = function(test) {
   test.expect(1);
   
   nomnom().options({
      date: {
         callback: function(date) {
            test.equal(date, "2010-02-03", "date should match value")
         }
      }
   }).parse(["--date=2010-02-03"]);

   test.done();
}

exports.testReturnString = function(test) {
   test.expect(1);

   nomnom().options({
      version: {
         flag: true,
         callback: function() {
            return "v0.3";
         }
      }
   })
   .printer(function(string) { 
      test.equal(0, string.indexOf("v0.3"))
      test.done();
   })
   .parse(["--version"]);
}