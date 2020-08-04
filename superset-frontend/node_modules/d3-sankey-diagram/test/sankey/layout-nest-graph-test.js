import nestGraph from '../../src/sankeyLayout/nest-graph.js'
import tape from 'tape'

tape('nestGraph()', test => {
  // 0|---\
  //       \
  // 1|-\   -|
  //     \---|4
  // 2|------|
  //       ,-|
  // 3|---/
  //

  const nodes = [
    {id: '0', rank: 0, band: 0, depth: 0},
    {id: '1', rank: 0, band: 1, depth: 0},
    {id: '2', rank: 0, band: 1, depth: 2},
    {id: '3', rank: 0, band: 1, depth: 1},
    {id: '4', rank: 1, band: 1, depth: 0}
  ]
  const nested = nestGraph(nodes)
  test.deepEqual(ids(nested), [
    [ ['0'], ['1', '3', '2'] ],
    [ [], ['4'] ]
  ])
  test.end()
})

tape('nestGraph() calculates band values', test => {
  // 0 -- 2         : band x
  //
  //      1 -- 3    : band y
  //        `- 4    :
  //
  const nodes = [
    {id: '0', rank: 0, band: 0, depth: 0, value: 5},
    {id: '1', rank: 1, band: 1, depth: 0, value: 25},
    {id: '2', rank: 1, band: 0, depth: 0, value: 5},
    {id: '3', rank: 2, band: 1, depth: 0, value: 10},
    {id: '4', rank: 2, band: 1, depth: 1, value: 15}
  ]
  test.deepEqual(nestGraph(nodes).bandValues, [5, 25])
  test.end()
})

function ids (layers) {
  return layers.map(bands => bands.map(nodes => nodes.map(d => d.id)))
}
