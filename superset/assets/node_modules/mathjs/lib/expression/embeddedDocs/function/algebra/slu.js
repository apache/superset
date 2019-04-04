module.exports = {
  'name': 'slu',
  'category': 'Algebra',
  'syntax': [
    'slu(A, order, threshold)'
  ],
  'description': 'Calculate the Matrix LU decomposition with full pivoting. Matrix A is decomposed in two matrices (L, U) and two permutation vectors (pinv, q) where P * A * Q = L * U',
  'examples': [
    'slu(sparse([4.5, 0, 3.2, 0; 3.1, 2.9, 0, 0.9; 0, 1.7, 3, 0; 3.5, 0.4, 0, 1]), 1, 0.001)'
  ],
  'seealso': [
    'lusolve', 'lsolve', 'usolve', 'matrix', 'sparse', 'lup', 'qr'
  ]
};
