import { addDummyNodes, dummyNodes } from '../../src/sortNodes/dummy-nodes.js'
import tape from 'tape'
import { Graph } from 'graphlib'

tape('dummyNodes(edge) adds nothing to short edges', test => {
  test.deepEqual(dummyNodes({rank: 0}, {rank: 1}), [], 'forwards')

  test.deepEqual(dummyNodes({rank: 1, backwards: true},
                            {rank: 0, backwards: true}), [], 'backwards')

  test.end()
})

tape('dummyNodes(edge) adds forwards nodes to forwards-forwards edges', test => {
  test.deepEqual(dummyNodes({rank: 0}, {rank: 2}), [
    {rank: 1, backwards: false}
  ])

  test.deepEqual(dummyNodes({rank: 1}, {rank: 4}), [
    {rank: 2, backwards: false},
    {rank: 3, backwards: false}
  ])

  test.end()
})

tape('dummyNodes(edge) adds backwards nodes to backwards-backwards edges', test => {
  test.deepEqual(dummyNodes({rank: 2, backwards: true},
                            {rank: 0, backwards: true}), [
    {rank: 1, backwards: true}
  ])

  test.deepEqual(dummyNodes({rank: 4, backwards: true},
                            {rank: 1, backwards: true}), [
    {rank: 3, backwards: true},
    {rank: 2, backwards: true}
  ])

  test.end()
})

tape('dummyNodes(edge) adds turn-around nodes to forwards-backwards edges', test => {
  //        a --,
  //            |
  //  b <-- * <-`
  test.deepEqual(dummyNodes({rank: 1, backwards: false},
                            {rank: 0, backwards: true}), [
    {rank: 1, backwards: true}
  ])

  //  a --,
  //      |
  //  b <-`
  test.deepEqual(dummyNodes({rank: 0, backwards: false},
                            {rank: 0, backwards: true}), [])

  //  a --> * --,
  //            |
  //        b <-`
  test.deepEqual(dummyNodes({rank: 0, backwards: false},
                            {rank: 1, backwards: true}), [
    {rank: 1, backwards: false}
  ])

  test.end()
})

tape('dummyNodes(edge) adds turn-around nodes to backwards-forwards edges', test => {
  //  ,-- a
  //  |
  //  `-> * --> b
  test.deepEqual(dummyNodes({rank: 0, backwards: true},
                            {rank: 1, backwards: false}), [
    {rank: 0, backwards: false}
  ])

  //  ,-- a
  //  |
  //  `-> b
  test.deepEqual(dummyNodes({rank: 0, backwards: true},
                            {rank: 0, backwards: false}), [])

  //  ,-- * <-- a
  //  |
  //  `-> b
  test.deepEqual(dummyNodes({rank: 1, backwards: true},
                            {rank: 0, backwards: false}), [
    {rank: 0, backwards: true}
  ])

  test.end()
})

tape('addDummyNodes(G) adds nodes to graph', test => {
  //
  // a -- b -- c
  //  `---*---`
  //
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('a', {rank: 0})
  graph.setNode('b', {rank: 1})
  graph.setNode('c', {rank: 2})
  graph.setEdge('a', 'b', {value: 1})
  graph.setEdge('b', 'c', {value: 1})
  graph.setEdge('a', 'c', {value: 1})

  addDummyNodes(graph)

  test.deepEqual(graph.nodes(), ['a', 'b', 'c', '__a_c_0'])
  test.end()
})
