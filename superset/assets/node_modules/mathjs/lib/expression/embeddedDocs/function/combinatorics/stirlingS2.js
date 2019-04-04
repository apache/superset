module.exports = {
  'name': 'stirlingS2',
  'category': 'Combinatorics',
  'syntax': [
    'stirlingS2(n, k)'
  ],
  'description': 'he Stirling numbers of the second kind, counts the number of ways to partition a set of n labelled objects into k nonempty unlabelled subsets. `stirlingS2` only takes integer arguments. The following condition must be enforced: k <= n. If n = k or k = 1, then s(n,k) = 1.',
  'examples': [
    'stirlingS2(5, 3)'
  ],
  'seealso': ['bellNumbers']
};
