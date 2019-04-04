module.exports = {
  'name': 'diag',
  'category': 'Matrix',
  'syntax': [
    'diag(x)',
    'diag(x, k)'
  ],
  'description': 'Create a diagonal matrix or retrieve the diagonal of a matrix. When x is a vector, a matrix with the vector values on the diagonal will be returned. When x is a matrix, a vector with the diagonal values of the matrix is returned. When k is provided, the k-th diagonal will be filled in or retrieved, if k is positive, the values are placed on the super diagonal. When k is negative, the values are placed on the sub diagonal.',
  'examples': [
    'diag(1:3)',
    'diag(1:3, 1)',
    'a = [1, 2, 3; 4, 5, 6; 7, 8, 9]',
    'diag(a)'
  ],
  'seealso': [
    'concat', 'det', 'eye', 'inv', 'ones', 'range', 'size', 'squeeze', 'subset', 'trace', 'transpose', 'zeros'
  ]
};
