import sortByPositions from '../../src/sortNodes/sort-by-positions.js'
import { map } from 'd3-collection'
import tape from 'tape'

tape('sortByPositions', test => {
  let arr

  arr = ['a', 'b', 'c']
  sortByPositions(arr, map({'a': 0, 'b': 2, 'c': 1}))
  test.deepEqual(arr, ['a', 'c', 'b'],
              'sorts according to given order')

  arr = ['a', 'b', 'c']
  sortByPositions(arr, map({'a': 2, 'b': 1, 'c': 1}))
  test.deepEqual(arr, ['b', 'c', 'a'],
              'stable sort')

  arr = ['a', 'b', 'c']
  sortByPositions(arr, map({'a': 1, 'b': -1, 'c': 0}))
  test.deepEqual(arr, ['c', 'b', 'a'],
              '-1 means stay in same position')

  test.end()
})
