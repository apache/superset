import { countBetweenCrossings, countLoopCrossings } from '../../src/sortNodes/count-crossings.js'
import { exampleTwoLevel, exampleTwoLevelWithLoops } from './examples'

import { Graph } from 'graphlib'
import tape from 'tape'

tape('countBetweenCrossings', test => {
  const {G, order} = exampleTwoLevel()

  // layer 1 to layer 2
  const count = countBetweenCrossings(G, order[0], order[1])
  test.equal(count, 12)

  // layer 2 to layer 1
  const G2 = new Graph({ directed: true })
  G.edges().forEach(({v, w}) => G2.setEdge(w, v))
  const count2 = countBetweenCrossings(G2, order[1], order[0])
  test.equal(count2, 12)

  test.end()
})

tape('countLoopCrossings', test => {
  const {G, order} = exampleTwoLevelWithLoops()

  const count = countLoopCrossings(G, order[0], order[1])
  test.equal(count, 1)
  test.end()
})

tape('countLoopCrossings: types', test => {
  const {G, order} = exampleTwoLevelWithLoops('m')

  const count = countLoopCrossings(G, order[0], order[1])
  test.equal(count, 1)
  test.end()
})
