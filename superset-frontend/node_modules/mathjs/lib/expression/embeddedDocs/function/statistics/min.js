module.exports = {
  'name': 'min',
  'category': 'Statistics',
  'syntax': [
    'min(a, b, c, ...)',
    'min(A)',
    'min(A, dim)'
  ],
  'description': 'Compute the minimum value of a list of values.',
  'examples': [
    'min(2, 3, 4, 1)',
    'min([2, 3, 4, 1])',
    'min([2, 5; 4, 3])',
    'min([2, 5; 4, 3], 1)',
    'min([2, 5; 4, 3], 2)',
    'min(2.7, 7.1, -4.5, 2.0, 4.1)',
    'max(2.7, 7.1, -4.5, 2.0, 4.1)'
  ],
  'seealso': [
    'max',
    'mean',
    'median',
    'prod',
    'std',
    'sum',
    'var'
  ]
};
