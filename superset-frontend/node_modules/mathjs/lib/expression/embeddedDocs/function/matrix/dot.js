module.exports = {
  'name': 'dot',
  'category': 'Matrix',
  'syntax': [
    'dot(A, B)',
    'A * B'
  ],
  'description': 'Calculate the dot product of two vectors. ' +
      'The dot product of A = [a1, a2, a3, ..., an] and B = [b1, b2, b3, ..., bn] ' +
      'is defined as dot(A, B) = a1 * b1 + a2 * b2 + a3 * b3 + ... + an * bn',
  'examples': [
    'dot([2, 4, 1], [2, 2, 3])',
    '[2, 4, 1] * [2, 2, 3]'
  ],
  'seealso': [
    'multiply',
    'cross'
  ]
};
