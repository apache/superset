module.exports = {
  'name': 'pickRandom',
  'category': 'Probability',
  'syntax': [
    'pickRandom(array)',
    'pickRandom(array, number)',
    'pickRandom(array, weights)',
    'pickRandom(array, number, weights)',
    'pickRandom(array, weights, number)'
  ],
  'description':
      'Pick a random entry from a given array.',
  'examples': [
    'pickRandom(0:10)',
    'pickRandom([1, 3, 1, 6])',
    'pickRandom([1, 3, 1, 6], 2)',
    'pickRandom([1, 3, 1, 6], [2, 3, 2, 1])',
    'pickRandom([1, 3, 1, 6], 2, [2, 3, 2, 1])',
    'pickRandom([1, 3, 1, 6], [2, 3, 2, 1], 2)'
  ],
  'seealso': ['random', 'randomInt']
};
