var mocha  = require('mocha')
  , assert = require('chai').assert
  , expect = require('chai').expect
  ;

describe("Testing 'strict' option", function(){
    var dupkeys = '{ "dupkey": "value 1", "dupkey": "value 2"}';
    it("Should show that duplicate keys just get overwritten by default", function(done){
        var JSONbig = require('../index');
        var result = "before";
        function tryParse() {
            result = JSONbig.parse(dupkeys);
        }
        expect(tryParse).to.not.throw("anything");
        expect(result.dupkey).to.equal("value 2");
        done();
    });

    it("Should show that the 'strict' option will fail-fast on duplicate keys", function(done){
        var JSONstrict = require('../index')({"strict": true});
        var result = "before";
        function tryParse() {
            result = JSONstrict.parse(dupkeys);
        }
        expect(tryParse).to.throw({ 
            name: 'SyntaxError',
            message: 'Duplicate key "dupkey"',
            at: 33,
            text: '{ "dupkey": "value 1", "dupkey": "value 2"}' 
        });
        expect(result).to.equal("before");
        done();
    });
});
