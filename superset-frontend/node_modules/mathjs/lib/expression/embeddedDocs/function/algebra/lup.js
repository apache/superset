module.exports = {
  'name': 'lup',
  'category': 'Algebra',
  'syntax': [
    'lup(m)'
  ],
  'description':
  'Calculate the Matrix LU decomposition with partial pivoting. Matrix A is decomposed in three matrices (L, U, P) where P * A = L * U',
  'examples': [
    'lup([[2, 1], [1, 4]])',
    'lup(matrix([[2, 1], [1, 4]]))',
    'lup(sparse([[2, 1], [1, 4]]))'
  ],
  'seealso': [
    'lusolve', 'lsolve', 'usolve', 'matrix', 'sparse', 'slu', 'qr'
  ]
};
