'use strict';

var assert = require('assert');
var math = require('../../../index'); 


/**
   * Transform node, array and single type value in a string with no spaces inside. 
   *
   * Syntax:
   *
   *     stri(arg)
   * 
   * @param  {any} arg        Input value
   * @return {string}         String value
   */
function stri(arg) { 
  if (arg===null)  
    return null
  else
    return arg.toString().replace(/ /g,'') 
}
/**
   * Transform Obj properties in an array of string-converted values of 
   * its sorted properties 
   *
   * Syntax:
   *
   *     objToString(obj) 
   * 
   * @param  {object} obj     The input object
   * @return {array}          Arrey of sorted properties converted to strings
   */
function objToStrings(obj) {
  var vet = Object.keys(obj).sort()
  var strObj = {};
  for (var i=0;i<vet.length;i++) { strObj[vet[i]] = stri(obj[vet[i]]);}
  return strObj;
}


///////////////////// rationalize ///////////////////////
describe('rationalize', function() {
  this.timeout(120000);

 it('invalid expression', function() {
    assert.throws(function () { math.rationalize('(x*/2)') }, /Value expected \(char 4\)/)
 });

  it('valid expression but not appropriate', function() {
    assert.throws(function () { math.rationalize('a=2') }, /Unimplemented node type in simplifyConstant: AssignmentNode/)
    assert.throws(function () { math.rationalize('sin(x)+x') }, /There is an unsolved function call/)
    assert.throws(function () { math.rationalize('(x+2)/(x % 2)') }, /Operator % invalid in polynomial expression/)
  });

  it('non-integer exponent', function() {
    assert.throws(function () { math.rationalize('x^2.5 - 2*x + 3') }, /There is a non-integer exponent/)
    assert.throws(function () { math.rationalize('x^x') }, /There is a non-integer exponent/)
    assert.throws(function () { math.rationalize('x^2.5') }, /There is a non-integer exponent/)
  });

  it('calling error', function() {
    assert.throws(function () { math.rationalize('x^2 + 2*x + 3',23) }, /Unexpected type of argument in function rationalize \(expected: boolean or Object, actual: number, index: 1\)/)
  });

  it('processing constant expressions', function() {
    assert.equal(stri(math.rationalize('-2+3+32-32')),'1');     
    assert.equal(stri(math.rationalize('1^2 + 20 + 3')),'24');  
  });

  it('processing simple expressions', function() {
    assert.equal(stri(math.rationalize('x')),'x'); 
    assert.equal(stri(math.rationalize('-x')),'-x');
    assert.equal(stri(math.rationalize('2x')),'2*x');
    assert.equal(stri(math.rationalize('-2x')),'-2*x');
    assert.equal(stri(math.rationalize('x^2')),'x^2');
    assert.equal(stri(math.rationalize('2x^2')),'2*x^2');
    assert.equal(stri(math.rationalize('-2x^2')),'-2*x^2');
    assert.equal(stri(math.rationalize('x+1')),'x+1');
    assert.equal(stri(math.rationalize('2x+1')),'2*x+1');
    assert.equal(stri(math.rationalize('-2x+1')),'-2*x+1');
    assert.equal(stri(math.rationalize('-2x-1')),'-2*x-1');
    assert.equal(stri(math.rationalize('x^2-2x-5')),'x^2-2*x-5');
    assert.equal(stri(math.rationalize('3x^2-2x-5')),'3*x^2-2*x-5');
    assert.equal(stri(math.rationalize('-3x^2-2x-5')),'-3*x^2-2*x-5');
    assert.equal(stri(math.rationalize('4x^4-3x^2-2x-5')),'4*x^4-3*x^2-2*x-5');
    assert.equal(stri(math.rationalize('-4x^4+3x^2-2x-5')),'-4*x^4+3*x^2-2*x-5');
    assert.equal(stri(math.rationalize('-4x^4+3x^2-2x-1')),'-4*x^4+3*x^2-2*x-1');
    assert.equal(stri(math.rationalize('-4x^4+3x^2-2x')),'-4*x^4+3*x^2-2*x');
  });


  it('processing simple and reducible expressions', function() {
    assert.equal(stri(math.rationalize('x+x+x')),'3*x');
    assert.equal(stri(math.rationalize('x-x')),'0');
    assert.equal(stri(math.rationalize('5x^2-5x^2')),'0');
    assert.equal(stri(math.rationalize('2-3x')),'-3*x+2');
    assert.equal(stri(math.rationalize('5x^2-3x-5x^2')),'-3*x');
    assert.equal(stri(math.rationalize('-5x^2-3x+5x^2')),'-3*x'); 
    assert.equal(stri(math.rationalize('-5 -2x^2 + 4x^4')),'4*x^4-2*x^2-5');
    assert.equal(stri(math.rationalize('-5 -2x^2 + 4x^4+5+2x^2-2x^4')),'2*x^4');
    assert.equal(stri(math.rationalize('-5 -2x^2 + 4x^4+5+2x^2-4x^4')),'0');
    assert.equal(stri(math.rationalize('-5 -2x^3 + 5*x^2 + 3*x^6 - 17x^4 + 2 x^5')),'3*x^6+2*x^5-17*x^4-2*x^3+5*x^2-5');
    assert.equal(stri(math.rationalize('x^2^2')),'x^4');
    assert.equal(stri(math.rationalize('x*2*2')),'4*x');
    assert.equal(stri(math.rationalize('x*5')),'5*x');
  });

  it('processing 2 variable expressions', function() {
    assert.equal(stri(math.rationalize('x+y')),'x+y');
    assert.equal(stri(math.rationalize('x^2 + 2*x*y + 3')),'x^2+2*x*y+3');
    assert.equal(stri(math.rationalize('2x/y - y/(x+1)')),'(2*x^2-y^2+2*x)/(x*y+y)');
  });


  it('processing power expressions', function() {
    assert.equal(stri(math.rationalize('(2x+1)^6')),'64*x^6+192*x^5+240*x^4+160*x^3+60*x^2+12*x+1');
    assert.equal(stri(math.rationalize('(2x+1)^3/(x-2)^3')),'(8*x^3+12*x^2+6*x+1)/(x^3-6*x^2+12*x-8)');
  });

  it('processing tougher expressions', function() {
    assert.equal(stri(math.rationalize('2x/(x+2) - x/(x+1)')),'x^2/(x^2+3*x+2)');
    assert.equal(stri(math.rationalize('2x/( (2x-1) / (3x+2) ) - 5x/ ( (3x+4) / (2x^2-5) ) + 3')),
                 '(-20*x^4+28*x^3+104*x^2+6*x-12)/(6*x^2+5*x-4)');
    assert.equal(stri(math.rationalize('x/(1-x)/(x-2)/(x-3)/(x-4) + 2x/ ( (1-2x)/(2-3x) )/ ((3-4x)/(4-5x) )')),
          '(-30*x^7+344*x^6-1506*x^5+3200*x^4-3472*x^3+1846*x^2-381*x)/(-8*x^6+90*x^5-383*x^4+780*x^3-797*x^2+390*x-72)');
    var no = math.parse('2x/( (2x-1) / (3x+2) ) - 5x/ ( (3x+4) / (2x^2-5) ) + 3'); 
    assert.equal(stri(math.rationalize(no)),'(-20*x^4+28*x^3+104*x^2+6*x-12)/(6*x^2+5*x-4)');
  });

  it('testing scope', function() {
    assert.equal(stri(math.rationalize('x+x+x+y',{y:1})),'3*x+1');
    assert.equal(stri(math.rationalize('x+x+x+y',{})),'3*x+y');
  });

  it('testing complete form', function() {
    assert.deepEqual(objToStrings(math.rationalize('x+x+x+y',{},true)),{
      coefficients:'', 
      denominator: null,
      expression:'3*x+y',
      numerator: '3*x+y',
      variables:'x,y'
    }); 
    assert.deepEqual(objToStrings(math.rationalize('2x/y - y/(x+1)',{},true)),{
      coefficients:'', 
      denominator: 'x*y+y',
      expression:'(2*x^2-y^2+2*x)/(x*y+y)',
      numerator: '2*x^2-y^2+2*x',
      variables:'x,y'
    }); 
    assert.deepEqual(objToStrings(math.rationalize('-2+5x^2',{},true)), {
      coefficients:'-2,0,5', 
      denominator: null,
      expression:'5*x^2-2',
      numerator: '5*x^2-2',
      variables:'x'
    }); 
    assert.deepEqual(objToStrings(math.rationalize('x^2 + 2*x*y + 3',{y:5},true)),{
      coefficients:'3,10,1', 
      denominator: null,
      expression:'x^2+10*x+3',
      numerator: 'x^2+10*x+3',
      variables:'x'
    });
    assert.deepEqual(objToStrings(math.rationalize('(x^2 + 2*x*y + 3)/(2y-3x)',{y:5},true)),{
      coefficients:'3,10,1', 
      denominator: '-3*x+10',
      expression:'(x^2+10*x+3)/(-3*x+10)',
      numerator: 'x^2+10*x+3',
      variables:'x'
    });
    assert.deepEqual(objToStrings(math.rationalize('sin(y)+x',{y:math.PI/6},true)),{
      coefficients:'0.49999999999999994,1', 
      denominator: null,
      expression:'x+0.49999999999999994',
      numerator: 'x+0.49999999999999994',
      variables:'x'
    })
  });


})  // Describe rationalize 
