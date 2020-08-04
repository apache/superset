import groupedGraph from '../../src/assignRanks/grouped-graph'
import tape from 'tape'
import { Graph } from 'graphlib'

// XXX reversing edges into Smin and out of Smax?
// XXX reversing edges marked as "right to left"?

tape('rank assignment: groupedGraph() produces one group per node, without ranksets', (test) => {
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('a', {})
  graph.setNode('b', {})
  graph.setNode('c', {})
  graph.setEdge('a', 'b', {})
  graph.setEdge('a', 'c', {})
  const GG = groupedGraph(graph)

  test.deepEqual(GG.nodes(), ['0', '1', '2'])
  test.deepEqual(GG.node('0'), {type: 'min', nodes: ['a']})
  test.deepEqual(GG.node('1'), {type: 'same', nodes: ['b']})
  test.deepEqual(GG.node('2'), {type: 'same', nodes: ['c']})
  test.deepEqual(GG.edges(), [{v: '0', w: '1'}, {v: '0', w: '2'}])
  test.end()
})

tape('rank assignment: groupedGraph() ignores repeated edges', (test) => {
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('a', {})
  graph.setNode('b', {})
  graph.setEdge('a', 'b', {}, 'x')
  graph.setEdge('a', 'b', {}, 'y')
  const GG = groupedGraph(graph)

  test.deepEqual(GG.nodes(), ['0', '1'])
  test.deepEqual(GG.node('0'), {type: 'min', nodes: ['a']})
  test.deepEqual(GG.node('1'), {type: 'same', nodes: ['b']})
  test.deepEqual(GG.edges(), [{v: '0', w: '1'}])
  test.end()
})

tape('rank assignment: groupedGraph() produces one group per rankset', (test) => {
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('a', {})
  graph.setNode('b', {})
  graph.setNode('c', {})
  graph.setEdge('a', 'b', {})
  graph.setEdge('a', 'c', {})
  const GG = groupedGraph(graph, [{type: 'same', nodes: ['b', 'c']}])

  test.deepEqual(GG.nodes(), ['0', '1'])
  test.deepEqual(GG.node('0'), {type: 'min', nodes: ['a']})
  test.deepEqual(GG.node('1'), {type: 'same', nodes: ['b', 'c']})
  test.deepEqual(GG.edges(), [{v: '0', w: '1'}])
  test.end()
})

tape('rank assignment: groupedGraph() respects explicit "min" rankset', (test) => {
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('a', {})
  graph.setNode('b', {})
  graph.setNode('c', {})
  graph.setEdge('a', 'b', {})
  graph.setEdge('a', 'c', {})
  const GG = groupedGraph(graph, [{type: 'min', nodes: ['b', 'c']}])

  test.deepEqual(GG.nodes(), ['0', '1'])
  test.deepEqual(GG.node('0'), {type: 'min', nodes: ['b', 'c']})
  test.deepEqual(GG.node('1'), {type: 'same', nodes: ['a']})
  test.deepEqual(GG.edges(), [{v: '1', w: '0'}])
  test.end()
})

function testGroupedGraph (d0, d1) {
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('a', {backwards: d0 === 'l'})
  graph.setNode('b', {backwards: d1 === 'l'})
  graph.setEdge('a', 'b', {})
  return groupedGraph(graph)
}

tape('rank assignment: linkDelta = 0 for links that change direction, 1 otherwise', (test) => {
  test.deepEqual(testGroupedGraph('r', 'r').edge('0', '1'), {delta: 1}, 'rr1')
  test.deepEqual(testGroupedGraph('r', 'r').edge('1', '0'), undefined, 'rr2')

  test.deepEqual(testGroupedGraph('r', 'l').edge('0', '1'), {delta: 0}, 'rl1')
  test.deepEqual(testGroupedGraph('r', 'l').edge('1', '0'), undefined, 'rl2')

  test.deepEqual(testGroupedGraph('l', 'l').edge('1', '0'), {delta: 1}, 'll1')
  test.deepEqual(testGroupedGraph('l', 'l').edge('0', '1'), undefined, 'll2')

  test.deepEqual(testGroupedGraph('l', 'r').edge('1', '0'), {delta: 0}, 'lr1')
  test.deepEqual(testGroupedGraph('l', 'r').edge('0', '1'), undefined, 'lr2')

  test.end()
})

function testGroupedGraphLoop (d) {
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('a', {backwards: d === 'l'})
  graph.setEdge('a', 'a', {})
  return groupedGraph(graph)
}

tape('rank assignment: groupedGraph() sets delta on self-loops to 0', (test) => {
  test.deepEqual(testGroupedGraphLoop('r').edge('0', '0'), {delta: 0}, 'r')
  test.deepEqual(testGroupedGraphLoop('l').edge('0', '0'), {delta: 0}, 'r')
  test.end()
})
