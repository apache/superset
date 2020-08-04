import swapNodes from '../../src/sortNodes/swap-nodes.js'
import { exampleTwoLevel } from './examples'
import tape from 'tape'

tape('iterateSwappingNodes', test => {
  let {G, order} = exampleTwoLevel()

  swapNodes(G, order)

  // it turns out that swapping n2 & n3 and s0 & s1 helps in this example; not
  // sure if there's a better way of testing this.
  const expected = [
    ['n0', 'n1', 'n3', 'n2', 'n4', 'n5'],
    ['s1', 's0', 's2', 's3', 's4']
  ]
  test.deepEqual(order, expected, 'swaps to reduce number of crossings')

  swapNodes(G, order)
  test.deepEqual(order, expected, 'gives same result if called again')

  test.end()
})
