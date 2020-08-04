module.exports = {
  'name': 'smallerEq',
  'category': 'Relational',
  'syntax': [
    'x <= y',
    'smallerEq(x, y)'
  ],
  'description':
      'Check if value x is smaller or equal to value y. Returns true if x is smaller than y, and false if not.',
  'examples': [
    '2 <= 1+1',
    '2 < 1+1',
    'a = 3.2',
    'b = 6-2.8',
    '(a <= b)'
  ],
  'seealso': [
    'equal', 'unequal', 'larger', 'smaller', 'largerEq', 'compare'
  ]
};
