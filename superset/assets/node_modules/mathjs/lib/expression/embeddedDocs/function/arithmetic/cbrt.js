module.exports = {
  'name': 'cbrt',
  'category': 'Arithmetic',
  'syntax': [
    'cbrt(x)',
    'cbrt(x, allRoots)'
  ],
  'description':
      'Compute the cubic root value. If x = y * y * y, then y is the cubic root of x. When `x` is a number or complex number, an optional second argument `allRoots` can be provided to return all three cubic roots. If not provided, the principal root is returned',
  'examples': [
    'cbrt(64)',
    'cube(4)',
    'cbrt(-8)',
    'cbrt(2 + 3i)',
    'cbrt(8i)',
    'cbrt(8i, true)',
    'cbrt(27 m^3)'
  ],
  'seealso': [
    'square',
    'sqrt',
    'cube',
    'multiply'
  ]
};
