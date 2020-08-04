module.exports = {
  'name': 'qr',
  'category': 'Algebra',
  'syntax': [
    'qr(A)'
  ],
  'description':
  'Calculates the Matrix QR decomposition. Matrix `A` is decomposed in two matrices (`Q`, `R`) where `Q` is an orthogonal matrix and `R` is an upper triangular matrix.',
  'examples': [
    'qr([[1, -1,  4], [1,  4, -2], [1,  4,  2], [1,  -1, 0]])'
  ],
  'seealso': [
    'lup', 'slu', 'matrix'
  ]
};
