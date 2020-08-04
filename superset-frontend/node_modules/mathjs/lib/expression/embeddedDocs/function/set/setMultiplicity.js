module.exports = {
  'name': 'setMultiplicity',
  'category': 'Set',
  'syntax': [
    'setMultiplicity(element, set)'
  ],
  'description':
      'Count the multiplicity of an element in a multiset. A multi-dimension array will be converted to a single-dimension array before the operation.',
  'examples': [
    'setMultiplicity(1, [1, 2, 2, 4])',
    'setMultiplicity(2, [1, 2, 2, 4])'
  ],
  'seealso': [
    'setDistinct', 'setSize'
  ]
};
