module.exports = {
  'name': 'mode',
  'category': 'Statistics',
  'syntax': [
    'mode(a, b, c, ...)',
    'mode(A)',
    'mode(A, a, b, B, c, ...)'
  ],
  'description': 'Computes the mode of all values as an array. In case mode being more than one, multiple values are returned in an array.',
  'examples': [
    'mode(2, 1, 4, 3, 1)',
    'mode([1, 2.7, 3.2, 4, 2.7])',
    'mode(1, 4, 6, 1, 6)'
  ],
  'seealso': [
    'max',
    'mean',
    'min',
    'median',
    'prod',
    'std',
    'sum',
    'var'
  ]
};
