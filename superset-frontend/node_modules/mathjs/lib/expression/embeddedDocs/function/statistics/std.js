module.exports = {
  'name': 'std',
  'category': 'Statistics',
  'syntax': [
    'std(a, b, c, ...)',
    'std(A)',
    'std(A, normalization)'
  ],
  'description': 'Compute the standard deviation of all values, defined as std(A) = sqrt(var(A)). Optional parameter normalization can be "unbiased" (default), "uncorrected", or "biased".',
  'examples': [
    'std(2, 4, 6)',
    'std([2, 4, 6, 8])',
    'std([2, 4, 6, 8], "uncorrected")',
    'std([2, 4, 6, 8], "biased")',
    'std([1, 2, 3; 4, 5, 6])'
  ],
  'seealso': [
    'max',
    'mean',
    'min',
    'median',
    'min',
    'prod',
    'sum',
    'var'
  ]
};
