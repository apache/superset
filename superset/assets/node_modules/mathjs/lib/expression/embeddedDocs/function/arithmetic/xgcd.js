module.exports = {
  'name': 'xgcd',
  'category': 'Arithmetic',
  'syntax': [
    'xgcd(a, b)'
  ],
  'description': 'Calculate the extended greatest common divisor for two values. The result is an array [d, x, y] with 3 entries, where d is the greatest common divisor, and d = x * a + y * b.',
  'examples': [
    'xgcd(8, 12)',
    'gcd(8, 12)',
    'xgcd(36163, 21199)'
  ],
  'seealso': [ 'gcd', 'lcm' ]
};
