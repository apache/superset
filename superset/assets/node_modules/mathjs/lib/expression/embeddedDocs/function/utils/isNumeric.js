module.exports = {
  'name': 'isNumeric',
  'category': 'Utils',
  'syntax': [
    'isNumeric(x)'
  ],
  'description': 'Test whether a value is a numeric value. ' +
    'Returns true when the input is a number, BigNumber, Fraction, or boolean.',
  'examples': [
    'isNumeric(2)',
    'isNumeric(0)',
    'isNumeric(bignumber(500))',
    'isNumeric(fraction(0.125))',
    'isNumeric("3")',
    'isNumeric(2 + 3i)',
    'isNumeric([2.3, "foo", false])'
  ],
  'seealso': ['isInteger', 'isZero', 'isNegative', 'isPositive', 'isNaN']
};
