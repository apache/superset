module.exports = {
  'name': 'log',
  'category': 'Arithmetic',
  'syntax': [
    'log(x)',
    'log(x, base)'
  ],
  'description': 'Compute the logarithm of a value. If no base is provided, the natural logarithm of x is calculated. If base if provided, the logarithm is calculated for the specified base. log(x, base) is defined as log(x) / log(base).',
  'examples': [
    'log(3.5)',
    'a = log(2.4)',
    'exp(a)',
    '10 ^ 4',
    'log(10000, 10)',
    'log(10000) / log(10)',
    'b = log(1024, 2)',
    '2 ^ b'
  ],
  'seealso': [
    'exp',
    'log10'
  ]
};