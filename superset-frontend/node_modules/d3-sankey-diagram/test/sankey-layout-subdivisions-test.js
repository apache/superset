import sankey from '../src/sankey.js'
import tape from 'tape'
import { assertAlmostEqual } from './assert-almost-equal'

tape('sankey() aligns ports', test => {
  const graph = {
    nodes: [
      {id: '0'},
      {id: '1'},
      {id: '2'}
    ],
    links: [
      {source: '0', target: '2', targetPort: 'a', type: '02a', value: 5},
      {source: '0', target: '2', targetPort: 'b', type: '02b', value: 5},
      {source: '1', target: '2', targetPort: 'a', type: '12a', value: 5}
    ]
  }
  const ordering = [['0', '1'], ['2']]
  const layout = sankey().size([2, 12]).ordering(ordering)
  layout.sortPorts(function (a, b) { return a.id.localeCompare(b.id) })
  layout(graph)

  test.deepEqual(graph.links.map(l => l.dy), [2, 2, 2], 'link thicknesses')

  // Order at node 2 should be link 0, 2, 1
  const n2 = graph.nodes[2]
  assertAlmostEqual(test, graph.links[0].points[1].y, n2.y0 + 1, 1e-3, 'l0')
  assertAlmostEqual(test, graph.links[1].points[1].y, n2.y0 + 5, 1e-3, 'l1')
  assertAlmostEqual(test, graph.links[2].points[1].y, n2.y0 + 3, 1e-3, 'l2')

  // Node 2 should have ports positioned
  test.deepEqual(n2.ports.map(d => ({id: d.id, y: d.y, dy: d.dy})), [
    { id: 'a', y: 0, dy: 4 },
    { id: 'b', y: 4, dy: 2 }
  ], 'ports')

  // Changes order
  // graph.nodes[2].ports = [{id: 'b'}, {id: 'a'}]
  layout.sortPorts(function (a, b) { return b.id.localeCompare(a.id) })
  layout(graph)

  assertAlmostEqual(test, graph.links[0].points[1].y, n2.y0 + 3, 1e-3, 'l0 again')
  assertAlmostEqual(test, graph.links[1].points[1].y, n2.y0 + 1, 1e-3, 'l1 again')
  assertAlmostEqual(test, graph.links[2].points[1].y, n2.y0 + 5, 1e-3, 'l2 again')
  test.deepEqual(n2.ports.map(d => ({id: d.id, y: d.y, dy: d.dy})), [
    { id: 'b', y: 0, dy: 2 },
    { id: 'a', y: 2, dy: 4 }
  ], 'ports again')

  test.end()
})

// tape('sankey() aligns links accouting for ports', test => {
//   const graph = {
//     nodes: [
//       {id: '0'},
//       {id: '1', ports: [{id: 'a'}, {id: 'b'}]}
//     ],
//     links: [
//       {source: '0', target: '1', targetPort: 'a', type: 'a', value: 5},
//       {source: '0', target: '1', targetPort: 'b', type: 'b', value: 5}
//     ]
//   }
//   const ordering = [['0'], ['1']]
//   const layout = sankey().size([2, 8]).ordering(ordering)
//   layout(graph)

//   test.deepEqual(graph.links.map(l => l.dy), [2, 2], 'link thicknesses')

//   test.deepEqual(pointsY(graph.links[0]), [3, 3], 'l0 before')
//   test.deepEqual(pointsY(graph.links[1]), [5, 5], 'l1 before')

//   // Changes order
//   graph.nodes[1].ports = [{id: 'b'}, {id: 'a'}]
//   layout(graph)

//   test.deepEqual(pointsY(graph.links[0]), [5, 5], 'l0 after')
//   test.deepEqual(pointsY(graph.links[1]), [3, 3], 'l1 after')

//   test.end()
// })

function pointsY (link) {
  return link.points.map(d => d.y)
}
