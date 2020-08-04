import orderLinks from '../../src/sankeyLayout/link-ordering.js'
import prepareNodePorts from '../../src/sankeyLayout/prepare-subdivisions.js'
import tape from 'tape'
import { Graph } from 'graphlib'

tape('orderLinks() works between neighbouring layers', test => {
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('0', {x0: 0, x1: 1, y: 0})
  graph.setNode('1', {x0: 0, x1: 1, y: 1})
  graph.setNode('2', {x0: 0, x1: 1, y: 2})
  graph.setNode('3', {x0: 0, x1: 1, y: 3})
  graph.setNode('4', {x0: 2, x1: 3, y: 1.5})
  graph.setEdge('0', '4', {dy: 1})
  graph.setEdge('1', '4', {dy: 1})
  graph.setEdge('2', '4', {dy: 1})
  graph.setEdge('3', '4', {dy: 1})
  prepareNodePorts(graph)
  orderLinks(graph)

  test.deepEqual(incoming(graph.node('4')), ['0', '1', '2', '3'],
                 'incoming')

  // change ordering: put node 3 at top, node 0 at bottom
  graph.node('0').y = 3
  graph.node('3').y = 0
  prepareNodePorts(graph)
  orderLinks(graph)

  test.deepEqual(incoming(graph.node('4')), ['3', '1', '2', '0'],
                'node 4 incoming swapped')

  test.end()
})

tape('orderLinks() starting and ending in same slice', test => {
  //
  //     |--1--|
  //     ||-2-||
  //  0 --- 3 --- 6
  //     ||-4-||
  //     |--5--|
  //
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('0', {x0: 0, x1: 1, y: 4})
  graph.setNode('1', {x0: 2, x1: 3, y: 0, direction: 'l'})
  graph.setNode('2', {x0: 2, x1: 3, y: 2, direction: 'l'})
  graph.setNode('3', {x0: 2, x1: 3, y: 4})
  graph.setNode('4', {x0: 2, x1: 3, y: 10, direction: 'l'})
  graph.setNode('5', {x0: 2, x1: 3, y: 12, direction: 'l'})
  graph.setNode('6', {x0: 4, x1: 5, y: 4})
  graph.setEdge('0', '3', {dy: 1})
  graph.setEdge('1', '3', {dy: 1})
  graph.setEdge('2', '3', {dy: 1})
  graph.setEdge('4', '3', {dy: 1})
  graph.setEdge('5', '3', {dy: 1})
  graph.setEdge('3', '1', {dy: 1})
  graph.setEdge('3', '2', {dy: 1})
  graph.setEdge('3', '4', {dy: 1})
  graph.setEdge('3', '5', {dy: 1})
  graph.setEdge('3', '6', {dy: 1})
  prepareNodePorts(graph)
  orderLinks(graph)

  test.deepEqual(incoming(graph.node('3'), 0), ['2', '1', '0', '5', '4'], 'incoming')
  test.deepEqual(outgoing(graph.node('3'), 1), ['2', '1', '6', '5', '4'], 'outgoing')
  test.end()
})

tape('orderLinks() sorts links with string types', test => {
  //
  //  0 --|
  //  1 --|2 -- 3
  //
  const graph = exampleTypes(['m2', 'm1'])

  prepareNodePorts(graph)
  orderLinks(graph)
  test.deepEqual(incoming(graph.node('2')), ['0/m1', '0/m2', '1/m1', '1/m2'], 'types not aligned')

  test.end()
})

tape('orderLinks() sorts links with numeric types', test => {
  //
  //  0 --|
  //  1 --|2 -- 3
  //
  const graph = exampleTypes([8, 7])

  prepareNodePorts(graph)
  orderLinks(graph)
  test.deepEqual(incoming(graph.node('2')), ['0/7', '0/8', '1/7', '1/8'], 'types not aligned')

  test.end()
})

tape('orderLinks() puts self-loops at the bottom', test => {
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('0', {x0: 0, x1: 1, y: 0})
  graph.setNode('1', {x0: 2, x1: 3, y: 0})
  graph.setNode('2', {x0: 4, x1: 5, y: 0})
  graph.setEdge('0', '1', {dy: 1})
  graph.setEdge('1', '1', {dy: 1})
  graph.setEdge('1', '2', {dy: 1})
  prepareNodePorts(graph)
  orderLinks(graph)

  test.deepEqual(outgoing(graph.node('1'), 1), ['2', '1'], 'node 1 outgoing')
  test.deepEqual(incoming(graph.node('1'), 0), ['0', '1'], 'node 1 incoming')
  test.end()
})

function exampleTypes (types) {
  //
  //  0 --|
  //  1 --|2
  //
  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('0', {x0: 0, x1: 1, y: 0})
  graph.setNode('1', {x0: 0, x1: 1, y: 3})
  graph.setNode('2', {x0: 2, x1: 3, y: 0})
  types.forEach(m => {
    graph.setEdge('0', '2', {dy: 1}, m)
    graph.setEdge('1', '2', {dy: 1}, m)
  })
  return graph
}

function incoming (node, i) {
  if (i === undefined) i = 0
  return node.ports[i].incoming.map(e => e.v + (e.name ? '/' + e.name : ''))
}

function outgoing (node, i) {
  if (i === undefined) i = 0
  return node.ports[i].outgoing.map(e => e.w + (e.name ? '/' + e.name : ''))
}
