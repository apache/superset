module.exports = {
  'name': 'equal',
  'category': 'Relational',
  'syntax': [
    'x == y',
    'equal(x, y)'
  ],
  'description':
      'Check equality of two values. Returns true if the values are equal, and false if not.',
  'examples': [
    '2+2 == 3',
    '2+2 == 4',
    'a = 3.2',
    'b = 6-2.8',
    'a == b',
    '50cm == 0.5m'
  ],
  'seealso': [
    'unequal', 'smaller', 'larger', 'smallerEq', 'largerEq', 'compare', 'deepEqual'
  ]
};
