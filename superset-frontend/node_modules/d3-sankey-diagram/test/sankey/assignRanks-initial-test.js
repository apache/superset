import assignInitialRanks from '../../src/assignRanks/initial-ranks'
import { Graph } from 'graphlib'
import tape from 'tape'

tape('rank assignment: assignInitialRanks', test => {
  const G = new Graph({directed: true})
  G.setNode('a', {})
  G.setNode('b', {})
  G.setNode('cd', {})
  G.setNode('e', {})
  G.setNode('f', {})
  G.setEdge('a', 'b', {})
  G.setEdge('a', 'cd', {})
  G.setEdge('b', 'cd', {})
  G.setEdge('cd', 'e', {})
  G.setEdge('b', 'e', {})  // REVERSED from other example
  G.setEdge('f', 'cd', {})

  assignInitialRanks(G)

  test.deepEqual(G.nodes(), ['a', 'b', 'cd', 'e', 'f'], 'nodes')
  test.deepEqual(G.nodes().map(u => G.node(u).rank),
              [0, 1, 2, 3, 0], 'ranks')

  // Change minimum edge length
  G.setEdge('b', 'cd', { delta: 2 })
  G.setEdge('cd', 'e', { delta: 0 })
  assignInitialRanks(G)

  test.deepEqual(G.nodes().map(u => G.node(u).rank),
              [0, 1, 3, 3, 0], 'updated ranks')
  test.end()
})

tape('rank assignment: assignInitialRanks with loop', test => {
  // loops can easily happen with grouped nodes from rankSets
  const G = new Graph({directed: true})
  G.setNode('a', {})
  G.setNode('b', {})
  G.setNode('c', {})
  G.setEdge('a', 'b', { delta: 1 })
  G.setEdge('b', 'c', { delta: 1 })
  G.setEdge('b', 'b', { delta: 0 })
  assignInitialRanks(G)

  test.deepEqual(G.nodes().map(u => [u, G.node(u).rank]), [
    ['a', 0],
    ['b', 1],
    ['c', 2]
  ], 'node ranks')

  test.end()
})
