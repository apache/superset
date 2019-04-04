module.exports = {
  'name': 'multinomial',
  'category': 'Probability',
  'syntax': [
    'multinomial(A)'
  ],
  'description': 'Multinomial Coefficients compute the number of ways of picking a1, a2, ..., ai unordered outcomes from `n` possibilities. multinomial takes one array of integers as an argument. The following condition must be enforced: every ai > 0.',
  'examples': [
    'multinomial([1, 2, 1])'
  ],
  'seealso': ['combinations', 'factorial']
};