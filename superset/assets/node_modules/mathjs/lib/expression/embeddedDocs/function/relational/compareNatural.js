module.exports = {
  'name': 'compareNatural',
  'category': 'Relational',
  'syntax': [
    'compareNatural(x, y)'
  ],
  'description': 'Compare two values of any type in a deterministic, natural way.',
  'examples': [
    'compareNatural(2, 3)',
    'compareNatural(3, 2)',
    'compareNatural(2, 2)',
    'compareNatural(5cm, 40mm)',
    'compareNatural("2", "10")',
    'compareNatural(2 + 3i, 2 + 4i)',
    'compareNatural([1, 2, 4], [1, 2, 3])',
    'compareNatural([1, 5], [1, 2, 3])',
    'compareNatural([1, 2], [1, 2])',
    'compareNatural({a: 2}, {a: 4})'
  ],
  'seealso': [
    'equal', 'unequal', 'smaller', 'smallerEq', 'largerEq', 'compare'
  ]
};
