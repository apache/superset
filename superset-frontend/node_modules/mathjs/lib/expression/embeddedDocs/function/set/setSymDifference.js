module.exports = {
  'name': 'setSymDifference',
  'category': 'Set',
  'syntax': [
    'setSymDifference(set1, set2)'
  ],
  'description':
      'Create the symmetric difference of two (multi)sets. Multi-dimension arrays will be converted to single-dimension arrays before the operation.',
  'examples': [
    'setSymDifference([1, 2, 3, 4], [3, 4, 5, 6])',
    'setSymDifference([[1, 2], [3, 4]], [[3, 4], [5, 6]])'
  ],
  'seealso': [
    'setUnion', 'setIntersect', 'setDifference'
  ]
};
