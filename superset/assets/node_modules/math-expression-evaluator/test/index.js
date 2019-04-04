// This test is for node JS

var assert = require('assert');
var a=require("../src/formula_evaluator.js");
describe('Testing Unit', function () {
  it('should equal 2 to check a number', function () {
    assert.equal(a.lex("2").toPostfix().postfixEval(),2);
  });
  it('checks a math function', function () {
    assert.equal(a.lex("tan(180)").toPostfix().postfixEval(),0);
  });
  it('checks a parenthesis less function', function () {
    assert.equal(a.lex("sin180").toPostfix().postfixEval(),0);
  });
  it('checks a parenthesis less function after a space', function () {
    assert.equal(a.lex("cos 180").toPostfix().postfixEval(),-1);
  });
  it('checks a parenthesis less function after multiple spaces', function () {
    assert.equal(a.lex("cos   180").toPostfix().postfixEval(),-1);
  });
  it('checks consecutive operator', function () {
    assert.equal(a.lex("0+-2").toPostfix().postfixEval(),-2);
  });
  it('checks ^ operator', function () {
    assert.equal(a.lex("2^2").toPostfix().postfixEval(),4);
  });
  it('checks when * is omitted before parenthesis and after', function () {
    assert.equal(a.lex("2(7-4)3").toPostfix().postfixEval(),18);
  });
  it('checks multiplication and exponential in series', function () {
    assert.equal(a.lex("2*7^2").toPostfix().postfixEval(),98);
  });
  it('checks exponential and multiplication in series', function () {
    assert.equal(a.lex("2^5*2").toPostfix().postfixEval(),64);
  });
  it('-3^2=-9', function () {
    assert.equal(a.lex("-3^2").toPostfix().postfixEval(),-9);
  });
  it('3^2-2^2=5', function () {
    assert.equal(a.lex("3^2-2^2").toPostfix().postfixEval(),5);
  });

  it('formula test', function () {
    assert.equal(a.lex("2").toPostfix().formulaEval(),2);
  });
  it('formula test', function () {
    assert.equal(a.lex("sinpi").toPostfix().formulaEval(),"sin(&pi;)");
  });
  it('formula test', function () {
    assert.equal(a.lex("cos pi").toPostfix().formulaEval(),"cos(&pi;)");
  });
  it('formula test', function () {
    assert.equal(a.lex("tan(pi)").toPostfix().formulaEval(),"tan(&pi;)");
  });
  it('formula test', function () {
    assert.equal(a.lex("2(7-4)3").toPostfix().formulaEval(),"(2&times;(7-4))&times;3");
  });
  it('test to check the bug when number contains decimal', function () {
    assert.equal(a.lex("int2.3").toPostfix().postfixEval(),"2");
  });
  it('test to check auto correct of parenthesis mismatch if opening>closing', function () {
    assert.equal(a.lex("(2+(3-4").toPostfix().postfixEval(),"1");
  });
  it('check for negative of a constant', function () {
    assert.equal(a.lex("-e").toPostfix().postfixEval(),-Math.E);
  });
  it('check for constant inside Sigma', function () {
    assert.equal(a.lex("Sigma1,3,2",[{type:3,preced:0,ev:"x",show:"x",token:"x"}]).toPostfix().postfixEval({x:2}),6);
  });
  it('check when arithmetic and n are present inside sigma', function () {
    assert.equal(a.lex("Sigma1,2,n").toPostfix().postfixEval(),3);
  });
  it(' should check when 4C3', function () {
    assert.equal(a.lex("4C3").toPostfix().postfixEval(),4);
  });
  it('check when arithmetic and n are present inside sigma', function () {
    assert.equal(a.lex("Sigma1,2,(n*n)").toPostfix().postfixEval(),5);
  });

  it('check when two parenthesis less functions are consecutive on one parameter', function () {
    assert.equal(a.lex("sinint2.5").toPostfix().postfixEval(),a.lex("sin(int(2.5))").toPostfix().postfixEval());
  });

  it('check eval method with single argument', function () {
    assert.equal(a.eval("5*3"),"15");
  });
  it('check eval method with three argument', function () {
    assert.equal(a.eval("mexp*3",[{type:3,show:"mexp",token:"mexp",value:"mexp",preced:0}],{mexp:5}),"15");
  });
  it('check eval method with two argument when second one is value of constants', function () {
	a.addToken([{type:3,show:"mexp",value:"mexp",preced:0,token:"mexp"}]);
    assert.equal(a.eval("mexp*3",{mexp:5}),"15");
  });
  it('check eval method with two argument when second one is value of constants', function () {
	a.addToken([{type:0,show:"mexp",value:function(a){return 5*a;},preced:11,token:"mexp"}]);
    assert.equal(a.lex("mexp3").toPostfix().postfixEval(),"15");
  });
  it('check eval method with two argument when second one is token list', function () {
	 assert.equal(a.eval("mexp(3)",[{type:0,show:"mexp(",value:function(a){return 5*a;},preced:11,token:"mexp"}]),"15");
  });
  it('Pi', function () {
	 assert.equal(a.eval("Pi1,5,n"),"120");
  });
  it('tan5(6+3)', function () {
	 assert.equal(a.eval("tan5(6+3)"),"1");
  });
  it('tan(40+5)', function () {
	 assert.equal(a.eval("tan(40+5)"),"1");
  });
  it('checks when a 0 is missing in a decimal number', function () {
	 assert.equal(a.eval("5*.8"),"4");
  });
  it('checks root function', function () {
	 assert.equal(a.eval("root4"),"2");
  });
  it('checks + precedence before number insise parenthesis ', function () {
	 assert.equal(a.eval("(-2)"),"-2");
  });
  it('checks multiple allowable operator', function () {
	 assert.equal(a.eval("2+++-++-+-+3"),"-1");
	 assert.equal(a.eval("2*+3"),"6");
  });
});
describe('These expression will check for types of returned result', function () {
  it('should tell to compllete expression', function () {
    assert.equal(typeof a.eval('0'), 'number')
  });
});
describe('These expression will raise error', function () {
  it('should tell to compllete expression', function () {
	try{
		a.eval("2*")
	}
	catch(e){
		assert.equal(e.message,"complete the expression")
	}
  });
  it('should warn about multiple operators', function () {
	try{
		a.eval("2**3")
	}
	catch(e){
		assert.equal(e.message,"* is not allowed after *")
	}
  });
  it('should warn about multiple operators', function () {
	try{
		a.eval("2*Mod*3")
	}
	catch(e){
		assert.equal(e.message,"Mod is not allowed after *")
	}
  });
  it('should warn about operator inside parenthesis', function () {
	try{
		a.eval("(+)")
	}
	catch(e){
		assert.equal(e.message,") is not allowed after +")
	}
  });
  it('should warn about operator inside parenthesis', function () {
	try{
		a.eval("(+)")
	}
	catch(e){
		assert.equal(e.message,") is not allowed after +")
	}
  });

});
