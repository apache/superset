module.exports = {
  'name': 'compare',
  'category': 'Relational',
  'syntax': [
    'compare(x, y)'
  ],
  'description':
      'Compare two values. Returns 1 if x is larger than y, -1 if x is smaller than y, and 0 if x and y are equal.',
  'examples': [
    'compare(2, 3)',
    'compare(3, 2)',
    'compare(2, 2)',
    'compare(5cm, 40mm)',
    'compare(2, [1, 2, 3])'
  ],
  'seealso': [
    'equal', 'unequal', 'smaller', 'smallerEq', 'largerEq', 'compareNatural'
  ]
};
