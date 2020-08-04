module.exports = {
  'name': 'median',
  'category': 'Statistics',
  'syntax': [
    'median(a, b, c, ...)',
    'median(A)'
  ],
  'description': 'Compute the median of all values. The values are sorted and the middle value is returned. In case of an even number of values, the average of the two middle values is returned.',
  'examples': [
    'median(5, 2, 7)',
    'median([3, -1, 5, 7])'
  ],
  'seealso': [
    'max',
    'mean',
    'min',
    'prod',
    'std',
    'sum',
    'var',
    'quantileSeq'
  ]
};
