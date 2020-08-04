import sortNodes from '../../src/sortNodes/index.js'
import tape from 'tape'
import { Graph } from 'graphlib'

tape('sortNodes()', test => {
  //
  //  a -- b -- d
  //   `-- c -- e
  //
  const G = new Graph({directed: true, multigraph: true})
  G.setNode('a', {rank: 0})
  G.setNode('b', {rank: 1})
  G.setNode('c', {rank: 1})
  G.setNode('d', {rank: 2})
  G.setNode('e', {rank: 2})
  G.setEdge('a', 'b', {})
  G.setEdge('a', 'c', {})
  G.setEdge('b', 'd', {})
  G.setEdge('c', 'e', {})
  sortNodes(G)

  test.deepEqual(depths(G), {
    'a': 0,
    'b': 0,
    'c': 1,
    'd': 0,
    'e': 1
  })

  test.end()
})

function depths (G) {
  var r = {}
  G.nodes().forEach(u => { r[u] = G.node(u).depth })
  return r
}
