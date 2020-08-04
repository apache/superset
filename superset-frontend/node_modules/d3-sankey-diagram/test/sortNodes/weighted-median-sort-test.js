import sortNodes from '../../src/sortNodes/weighted-median-sort.js'
import { exampleTwoLevel } from './examples'
import tape from 'tape'

tape('sortNodes: forwards', test => {
  let {G, order} = exampleTwoLevel()

  sortNodes(G, order, +1)
  test.deepEqual(order, [
    ['n0', 'n1', 'n2', 'n3', 'n4', 'n5'],
    ['s1', 's0', 's2', 's3', 's4']
  ], 'forward sweep')

  test.end()
})

tape('sortNodes: backwards', test => {
  let {G, order} = exampleTwoLevel()

  sortNodes(G, order, -1)
  test.deepEqual(order, [
    ['n0', 'n3', 'n1', 'n2', 'n4', 'n5'],
    ['s0', 's1', 's2', 's3', 's4']
  ], 'backward sweep')

  test.end()
})
