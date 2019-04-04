module.exports = {
  'name': 'larger',
  'category': 'Relational',
  'syntax': [
    'x > y',
    'larger(x, y)'
  ],
  'description':
      'Check if value x is larger than y. Returns true if x is larger than y, and false if not.',
  'examples': [
    '2 > 3',
    '5 > 2*2',
    'a = 3.3',
    'b = 6-2.8',
    '(a > b)',
    '(b < a)',
    '5 cm > 2 inch'
  ],
  'seealso': [
    'equal', 'unequal', 'smaller', 'smallerEq', 'largerEq', 'compare'
  ]
};
