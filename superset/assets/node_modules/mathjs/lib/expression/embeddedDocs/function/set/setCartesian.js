module.exports = {
  'name': 'setCartesian',
  'category': 'Set',
  'syntax': [
    'setCartesian(set1, set2)'
  ],
  'description':
      'Create the cartesian product of two (multi)sets. Multi-dimension arrays will be converted to single-dimension arrays before the operation.',
  'examples': [
    'setCartesian([1, 2], [3, 4])'
  ],
  'seealso': [
    'setUnion', 'setIntersect', 'setDifference', 'setPowerset'
  ]
};
