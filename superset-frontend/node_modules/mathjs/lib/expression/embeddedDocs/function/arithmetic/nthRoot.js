module.exports = {
  'name': 'nthRoot',
  'category': 'Arithmetic',
  'syntax': [
    'nthRoot(a)',
    'nthRoot(a, root)'
  ],
  'description': 'Calculate the nth root of a value. ' +
      'The principal nth root of a positive real number A, ' +
      'is the positive real solution of the equation "x^root = A".',
  'examples': [
    '4 ^ 3',
    'nthRoot(64, 3)',
    'nthRoot(9, 2)',
    'sqrt(9)'
  ],
  'seealso': [
    'sqrt',
    'pow'
  ]
};