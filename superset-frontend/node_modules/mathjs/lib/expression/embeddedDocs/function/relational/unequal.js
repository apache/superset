module.exports = {
  'name': 'unequal',
  'category': 'Relational',
  'syntax': [
    'x != y',
    'unequal(x, y)'
  ],
  'description':
      'Check unequality of two values. Returns true if the values are unequal, and false if they are equal.',
  'examples': [
    '2+2 != 3',
    '2+2 != 4',
    'a = 3.2',
    'b = 6-2.8',
    'a != b',
    '50cm != 0.5m',
    '5 cm != 2 inch'
  ],
  'seealso': [
    'equal', 'smaller', 'larger', 'smallerEq', 'largerEq', 'compare', 'deepEqual'
  ]
};
