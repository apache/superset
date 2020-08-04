import layoutLinks from '../../src/sankeyLayout/layout-links.js'
import prepareSubdivisions from '../../src/sankeyLayout/prepare-subdivisions.js'
import tape from 'tape'
import { Graph } from 'graphlib'
import { assertAlmostEqual, assertNotAlmostEqual } from '../assert-almost-equal'

tape('linkLayout: link attributes', test => {
  const graph = example2to1(0)
  prepareSubdivisions(graph)
  layoutLinks(graph)

  // ids
  // test.deepEqual(graph.edges.map(e => id), ['0-2-m1', '1-2-m2'], 'id')
  test.deepEqual(graph.edges(), [
    {v: '0', w: '2', name: 'm1'},
    {v: '1', w: '2', name: 'm2'}
  ], 'ids')

  const edges = graph.edges().map(e => graph.edge(e))

  // x coordinates
  test.deepEqual(edges.map(e => e.x0), [1, 1], 'x0')
  test.deepEqual(edges.map(e => e.x1), [3, 3], 'x1')

  // y coordinates
  test.deepEqual(edges.map(e => e.y0), [0.5, 3.5], 'y0')
  test.deepEqual(edges.map(e => e.y1), [2.5, 3.5], 'y1')

  // directions
  test.deepEqual(edges.map(e => e.d0), ['r', 'r'], 'd0')
  test.deepEqual(edges.map(e => e.d1), ['r', 'r'], 'd1')

  test.end()
})

tape('linkLayout: loose edges', test => {
  const graph = example2to1(0)
  prepareSubdivisions(graph)
  layoutLinks(graph)

  test.deepEqual(graph.edges(), [
    {v: '0', w: '2', name: 'm1'},
    {v: '1', w: '2', name: 'm2'}
  ], 'ids')
  const edges = graph.edges().map(e => graph.edge(e))

  // should not overlap
  test.ok((edges[0].r1 + edges[0].dy / 2) <=
          (edges[1].r1 - edges[1].dy / 2),
          'links should not overlap')

  test.end()
})

tape('linkLayout: tight curvature', test => {
  // setting f= 0.3 moves up the lower link to constrain the curvature at node
  // 2.
  const graph = example2to1(0.3)
  prepareSubdivisions(graph)
  layoutLinks(graph)

  test.deepEqual(graph.edges(), [
    {v: '0', w: '2', name: 'm1'},
    {v: '1', w: '2', name: 'm2'}
  ], 'ids')
  const edges = graph.edges().map(e => graph.edge(e))

  // curvature should no longer be symmetric
  assertNotAlmostEqual(test,
                       edges.map(f => f.r0),
                       edges.map(f => f.r1), 1e-6,
                       'radius should not be equal at both ends')

  // should not overlap
  assertAlmostEqual(test,
                    (edges[0].r1 + edges[0].dy / 2),
                    (edges[1].r1 - edges[1].dy / 2), 1e-6,
                    'link curvatures should just touch')

  test.end()
})

tape('linkLayout: maximum curvature limit', test => {
  // setting f=1 moves up the lower link so far the curvature hits the limit
  // 2.
  const graph = example2to1(1)
  prepareSubdivisions(graph)
  layoutLinks(graph)

  test.deepEqual(graph.edges(), [
    {v: '0', w: '2', name: 'm1'},
    {v: '1', w: '2', name: 'm2'}
  ], 'ids')
  const edges = graph.edges().map(e => graph.edge(e))

  // curvature should no longer be symmetric
  assertNotAlmostEqual(test,
                       edges.map(f => f.r0),
                       edges.map(f => f.r1), 1e-6,
                       'radius should not be equal at both ends')

  assertAlmostEqual(test, (edges[0].r1 - edges[0].dy / 2), 0, 1e-6,
                    'inner link curvature should be zero')

  test.end()
})

function example2to1 (f) {
  // 0|---\
  //       \
  // 1|-\   -|
  //     \---|2
  //

  // f == 0 means 1-2 is level
  // f == 1 means 1-2 is tight below 0-2

  const graph = new Graph({ directed: true, multigraph: true })
  graph.setNode('0', {dy: 1, x0: 0, x1: 1, y: 0, subdivisions: [{incoming: [], outgoing: [{v: '0', w: '2', name: 'm1'}]}]})
  graph.setNode('1', {dy: 1, x0: 0, x1: 1, y: 1 + (1 - f) * 2, subdivisions: [{incoming: [], outgoing: [{v: '1', w: '2', name: 'm2'}]}]})
  graph.setNode('2', {
    dy: 2,
    x0: 3,
    x1: 4,
    y: 2,
    subdivisions: [{
      incoming: [{v: '0', w: '2', name: 'm1'}, {v: '1', w: '2', name: 'm2'}],
      outgoing: []
    }]
  })
  graph.setEdge('0', '2', {dy: 1}, 'm1')
  graph.setEdge('1', '2', {dy: 1}, 'm2')
  return graph
}
