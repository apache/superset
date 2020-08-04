module.exports = {
  'name': 'flatten',
  'category': 'Matrix',
  'syntax': [
    'flatten(x)'
  ],
  'description': 'Flatten a multi dimensional matrix into a single dimensional matrix.',
  'examples': [
    'a = [1, 2, 3; 4, 5, 6]',
    'size(a)',
    'b = flatten(a)',
    'size(b)'
  ],
  'seealso': [
    'concat', 'resize', 'size', 'squeeze'
  ]
};
