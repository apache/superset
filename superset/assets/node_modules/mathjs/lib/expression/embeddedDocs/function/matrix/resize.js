module.exports = {
  'name': 'resize',
  'category': 'Matrix',
  'syntax': [
    'resize(x, size)',
    'resize(x, size, defaultValue)'
  ],
  'description': 'Resize a matrix.',
  'examples': [
    'resize([1,2,3,4,5], [3])',
    'resize([1,2,3], [5])',
    'resize([1,2,3], [5], -1)',
    'resize(2, [2, 3])',
    'resize("hello", [8], "!")'
  ],
  'seealso': [
    'size', 'subset', 'squeeze', 'reshape'
  ]
};
