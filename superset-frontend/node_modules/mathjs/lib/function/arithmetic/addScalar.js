'use strict';

function factory(type, config, load, typed) {

  /**
   * Add two scalar values, `x + y`.
   * This function is meant for internal use: it is used by the public function
   * `add`
   *
   * This function does not support collections (Array or Matrix), and does
   * not validate the number of of inputs.
   *
   * @param  {number | BigNumber | Fraction | Complex | Unit} x   First value to add
   * @param  {number | BigNumber | Fraction | Complex} y          Second value to add
   * @return {number | BigNumber | Fraction | Complex | Unit}                      Sum of `x` and `y`
   * @private
   */
  var add = typed('add', {

    'number, number': function (x, y) {
      return x + y;
    },

    'Complex, Complex': function (x, y) {
      return x.add(y);
    },

    'BigNumber, BigNumber': function (x, y) {
      return x.plus(y);
    },

    'Fraction, Fraction': function (x, y) {
      return x.add(y);
    },

    'Unit, Unit': function (x, y) {
      if (x.value == null) throw new Error('Parameter x contains a unit with undefined value');
      if (y.value == null) throw new Error('Parameter y contains a unit with undefined value');
      if (!x.equalBase(y)) throw new Error('Units do not match');

      var res = x.clone();
      res.value = add(res.value, y.value);
      res.fixPrefix = false;
      return res;
    }
  });

  return add;
}

exports.factory = factory;
