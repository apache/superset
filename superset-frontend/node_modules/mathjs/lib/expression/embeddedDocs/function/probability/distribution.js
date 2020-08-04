module.exports = {
  'name': 'distribution',
  'category': 'Probability',
  'syntax': [
    'distribution(name)',
    'distribution(name, arg1, arg2, ...)'
  ],
  'description':
      'Create a distribution object of a specific type. ' +
          'A distribution object contains functions `random([size,] [min,] [max])`, ' +
          '`randomInt([size,] [min,] [max])` and `pickRandom(array)`. ' +
          'Available types of distributions: "uniform", "normal". ' +
          'Note that the function distribution is currently not available via the expression parser.',
  'examples': [
  ],
  'seealso': ['random', 'randomInt']
};
