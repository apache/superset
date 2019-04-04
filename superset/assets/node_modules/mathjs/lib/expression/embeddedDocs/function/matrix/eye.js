module.exports = {
  'name': 'eye',
  'category': 'Matrix',
  'syntax': [
    'eye(n)',
    'eye(m, n)',
    'eye([m, n])'
  ],
  'description': 'Returns the identity matrix with size m-by-n. The matrix has ones on the diagonal and zeros elsewhere.',
  'examples': [
    'eye(3)',
    'eye(3, 5)',
    'a = [1, 2, 3; 4, 5, 6]',
    'eye(size(a))'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'inv', 'ones', 'range', 'size', 'squeeze', 'subset', 'trace', 'transpose', 'zeros'
  ]
};
