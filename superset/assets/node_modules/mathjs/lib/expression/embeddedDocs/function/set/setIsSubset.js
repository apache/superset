module.exports = {
  'name': 'setIsSubset',
  'category': 'Set',
  'syntax': [
    'setIsSubset(set1, set2)'
  ],
  'description':
      'Check whether a (multi)set is a subset of another (multi)set: every element of set1 is the element of set2. Multi-dimension arrays will be converted to single-dimension arrays before the operation.',
  'examples': [
    'setIsSubset([1, 2], [3, 4, 5, 6])',
    'setIsSubset([3, 4], [3, 4, 5, 6])'
  ],
  'seealso': [
    'setUnion', 'setIntersect', 'setDifference'
  ]
};
