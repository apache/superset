import neighbourPositions from '../../src/sortNodes/neighbour-positions.js'
import { exampleTwoLevel, exampleTwoLevelMultigraph } from './examples'
import { Graph } from 'graphlib'
import tape from 'tape'

tape('neighbourPositions', test => {
  let {G, order} = exampleTwoLevel()

  test.deepEqual(neighbourPositions(G, order, 0, 1, 'n2'), [0, 3, 4], 'n2')
  test.deepEqual(neighbourPositions(G, order, 0, 1, 'n0'), [0], 'n0')

  test.deepEqual(neighbourPositions(G, order, 1, 0, 's4'), [2, 5], 's4')
  test.deepEqual(neighbourPositions(G, order, 1, 0, 's0'), [0, 2, 3], 's0')

  test.end()
})

tape('neighbourPositions: multigraph', test => {
  let {G, order} = exampleTwoLevelMultigraph()

  test.deepEqual(neighbourPositions(G, order, 0, 1, 'a'), [0, 2], 'a')
  test.deepEqual(neighbourPositions(G, order, 0, 1, 'b'), [1, 2], 'b')

  test.deepEqual(neighbourPositions(G, order, 1, 0, '1'), [0], '1')
  test.deepEqual(neighbourPositions(G, order, 1, 0, '3'), [0, 1], '3')

  test.end()
})

tape('neighbourPositions: loops', test => {
  //
  //   a --,1
  //      <
  //       `2
  //
  //   b -- 3
  //
  let G = new Graph({ directed: true })
  G.setEdge('a', '1', {})
  G.setEdge('b', '3', {})
  G.setEdge('2', '1', {})

  let order = [
    ['a', 'b'],
    ['1', '2', '3']
  ]

  test.deepEqual(neighbourPositions(G, order, 0, 1, 'a', true), [0], 'a')
  test.deepEqual(neighbourPositions(G, order, 0, 1, 'b', true), [2], 'b')

  // loop gets 0.5 position below other node in this rank, if no other
  // neighbours.
  test.deepEqual(neighbourPositions(G, order, 1, 0, '1', true), [0], '1')
  test.deepEqual(neighbourPositions(G, order, 1, 0, '2', true), [0.5], '2')
  test.deepEqual(neighbourPositions(G, order, 1, 0, '3', true), [1], '3')

  test.end()
})

// tape('neighbourPositions with loops', test => {
//   let {G, order} = exampleTwoLevelWithLoops()

//   test.deepEqual(neighbourPositions(G, order, 0, 1, 'n0'), [0, 2], 'n0')
//   test.deepEqual(neighbourPositions(G, order, 0, 1, 'n1'), [0], 'n1')
//   test.deepEqual(neighbourPositions(G, order, 0, 1, 'n2'), [0, 1], 'n2')

//   test.deepEqual(neighbourPositions(G, order, 1, 0, 's0'), [0, 1], 's0')
//   test.deepEqual(neighbourPositions(G, order, 1, 0, 's1'), [2], 's1')

//   test.end()
// })
