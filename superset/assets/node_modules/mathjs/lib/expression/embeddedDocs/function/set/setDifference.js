module.exports = {
  'name': 'setDifference',
  'category': 'Set',
  'syntax': [
    'setDifference(set1, set2)'
  ],
  'description':
      'Create the difference of two (multi)sets: every element of set1, that is not the element of set2. Multi-dimension arrays will be converted to single-dimension arrays before the operation.',
  'examples': [
    'setDifference([1, 2, 3, 4], [3, 4, 5, 6])',
    'setDifference([[1, 2], [3, 4]], [[3, 4], [5, 6]])'
  ],
  'seealso': [
    'setUnion', 'setIntersect', 'setSymDifference'
  ]
};
