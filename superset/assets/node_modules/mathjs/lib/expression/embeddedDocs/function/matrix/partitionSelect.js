module.exports = {
  'name': 'partitionSelect',
  'category': 'Matrix',
  'syntax': [
    'partitionSelect(x, k)',
    'partitionSelect(x, k, compare)'
  ],
  'description': 'Partition-based selection of an array or 1D matrix. Will find the kth smallest value, and mutates the input array. Uses Quickselect.',
  'examples': [
    'partitionSelect([5, 10, 1], 2)',
    'partitionSelect(["C", "B", "A", "D"], 1)'
  ],
  'seealso': ['sort']
};
