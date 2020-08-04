module.exports = {
  'name': 'zeros',
  'category': 'Matrix',
  'syntax': [
    'zeros(m)',
    'zeros(m, n)',
    'zeros(m, n, p, ...)',
    'zeros([m])',
    'zeros([m, n])',
    'zeros([m, n, p, ...])'
  ],
  'description': 'Create a matrix containing zeros.',
  'examples': [
    'zeros(3)',
    'zeros(3, 5)',
    'a = [1, 2, 3; 4, 5, 6]',
    'zeros(size(a))'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'ones', 'range', 'size', 'squeeze', 'subset', 'trace', 'transpose'
  ]
};
