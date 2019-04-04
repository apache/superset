'use strict';

var deepMap = require('../../utils/collection/deepMap');


function factory (type, config, load, typed) {
  /**
   * Test whether a value is prime: has no divisors other than itself and one.
   * The function supports type `number`, `bignumber`.
   *
   * The function is evaluated element-wise in case of Array or Matrix input.
   *
   * Syntax:
   *
   *     math.isPrime(x)
   *
   * Examples:
   *
   *    math.isPrime(3);                     // returns true
   *    math.isPrime(-2);                    // returns false
   *    math.isPrime(0);                     // returns false
   *    math.isPrime(-0);                    // returns false
   *    math.isPrime(0.5);                   // returns false
   *    math.isPrime('2');                   // returns true
   *    math.isPrime([2, 17, 100]');           // returns [true, true, false]
   *
   * See also:
   *
   *    isNumeric, isZero, isNegative, isInteger
   *
   * @param {number | BigNumber | Array | Matrix} x  Value to be tested
   * @return {boolean}  Returns true when `x` is larger than zero.
   *                    Throws an error in case of an unknown data type.
   */
  var isPrime = typed('isPrime', {
    'number': function (x) {
      if (x < 2){
        return false;
      }
      if (x == 2){
        return true;
      }
      if (x % 2 == 0){ 
        return false;
      }
      for (var i = 3; i * i <= x; i += 2){
        if (x % i == 0){
          return false;
        }
      }
      return true;
    },

    'BigNumber': function (x) {
      if (x.lt(2)){
        return false;
      }
      if (x.equals(2)){
        return true;
      }
      if (x.mod(2).isZero()){
        return false;
      }
      for(var i = type.BigNumber(3); i.times(i).lte(x); i = i.plus(1)){
        if (x.mod(i).isZero()){
          return false;
        }
      }
      return true;
    },

    'Array | Matrix': function (x) {
      return deepMap(x, isPrime);
    }
  });

  return isPrime;
}

exports.name = 'isPrime';
exports.factory = factory;
