module.exports = {
  'name': 'randomInt',
  'category': 'Probability',
  'syntax': [
    'randomInt(max)',
    'randomInt(min, max)',
    'randomInt(size)',
    'randomInt(size, max)',
    'randomInt(size, min, max)'
  ],
  'description':
      'Return a random integer number',
  'examples': [
    'randomInt(10, 20)',
    'randomInt([2, 3], 10)'
  ],
  'seealso': ['pickRandom', 'random']
};