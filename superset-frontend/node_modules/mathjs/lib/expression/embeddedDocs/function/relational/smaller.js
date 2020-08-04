module.exports = {
  'name': 'smaller',
  'category': 'Relational',
  'syntax': [
    'x < y',
    'smaller(x, y)'
  ],
  'description':
      'Check if value x is smaller than value y. Returns true if x is smaller than y, and false if not.',
  'examples': [
    '2 < 3',
    '5 < 2*2',
    'a = 3.3',
    'b = 6-2.8',
    '(a < b)',
    '5 cm < 2 inch'
  ],
  'seealso': [
    'equal', 'unequal', 'larger', 'smallerEq', 'largerEq', 'compare'
  ]
};
