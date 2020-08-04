import assignRanks from '../../src/assignRanks/index.js'
import tape from 'tape'
import { Graph } from 'graphlib'

tape('rank assignment: overall', test => {
  //
  //  f -------,    b<-,
  //  a -- b -- c -- e `
  //    `------ d -'
  //              \
  //      <h---<g-`
  //
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('a', {})
  graph.setNode('b', {})
  graph.setNode('c', {})
  graph.setNode('d', {})
  graph.setNode('e', {})
  graph.setNode('f', {})
  graph.setNode('g', {backwards: true})
  graph.setNode('h', {backwards: true})
  graph.setEdge('a', 'b', {})
  graph.setEdge('b', 'c', {})
  graph.setEdge('a', 'd', {})
  graph.setEdge('c', 'e', {})
  graph.setEdge('d', 'e', {})
  graph.setEdge('e', 'b', {})
  graph.setEdge('f', 'c', {})
  graph.setEdge('d', 'g', {})
  graph.setEdge('g', 'h', {})

  const rankSets = [
    { type: 'same', nodes: ['c', 'd'] }
  ]

  // Without rankSets
  assignRanks(graph, [])
  test.deepEqual(ranks(graph), {
    'a': 0,
    'b': 1,
    'c': 2,
    'd': 1,
    'e': 3,
    'f': 1,
    'g': 1,
    'h': 0
  }, 'ranks without rankSets')

  assignRanks(graph, rankSets)
  test.deepEqual(ranks(graph), {
    'a': 0,
    'b': 1,
    'c': 2,
    'd': 2,
    'e': 3,
    'f': 1,
    'g': 2,
    'h': 1
  }, 'ranks with rankSets')

  test.end()
})

tape('rank assignment: disconnected', test => {
  //
  //   a -- b
  //        c -- d
  //
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('a', {})
  graph.setNode('b', {})
  graph.setNode('c', {})
  graph.setNode('d', {})
  graph.setEdge('a', 'b', {})
  graph.setEdge('c', 'd', {})

  const rankSets = [
    { type: 'same', nodes: ['b', 'c'] }
  ]

  // Without rankSets
  assignRanks(graph, [])
  test.deepEqual(ranks(graph), {
    'a': 0,
    'b': 1,
    'c': 0,
    'd': 1
  }, 'ranks without rankSets')

  assignRanks(graph, rankSets)
  test.deepEqual(ranks(graph), {
    'a': 0,
    'b': 1,
    'c': 1,
    'd': 2
  }, 'ranks with rankSets')

  test.end()
})

function ranks (graph) {
  var r = {}
  graph.nodes().forEach(u => { r[u] = graph.node(u).rank })
  return r
}
