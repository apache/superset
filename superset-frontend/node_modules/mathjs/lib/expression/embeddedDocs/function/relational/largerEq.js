module.exports = {
  'name': 'largerEq',
  'category': 'Relational',
  'syntax': [
    'x >= y',
    'largerEq(x, y)'
  ],
  'description':
      'Check if value x is larger or equal to y. Returns true if x is larger or equal to y, and false if not.',
  'examples': [
    '2 >= 1+1',
    '2 > 1+1',
    'a = 3.2',
    'b = 6-2.8',
    '(a >= b)'
  ],
  'seealso': [
    'equal', 'unequal', 'smallerEq', 'smaller', 'compare'
  ]
};
