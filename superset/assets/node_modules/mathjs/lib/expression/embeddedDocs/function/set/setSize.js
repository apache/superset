module.exports = {
  'name': 'setSize',
  'category': 'Set',
  'syntax': [
    'setSize(set)',
    'setSize(set, unique)'
  ],
  'description':
      'Count the number of elements of a (multi)set. When the second parameter "unique" is true, count only the unique values. A multi-dimension array will be converted to a single-dimension array before the operation.',
  'examples': [
    'setSize([1, 2, 2, 4])',
    'setSize([1, 2, 2, 4], true)'
  ],
  'seealso': [
    'setUnion', 'setIntersect', 'setDifference'
  ]
};
