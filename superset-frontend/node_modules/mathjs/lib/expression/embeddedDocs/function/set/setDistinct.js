module.exports = {
  'name': 'setDistinct',
  'category': 'Set',
  'syntax': [
    'setDistinct(set)'
  ],
  'description':
      'Collect the distinct elements of a multiset. A multi-dimension array will be converted to a single-dimension array before the operation.',
  'examples': [
    'setDistinct([1, 1, 1, 2, 2, 3])'
  ],
  'seealso': [
    'setMultiplicity'
  ]
};
