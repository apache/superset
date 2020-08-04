import makeAcyclic, { findSpanningTree, nodeRelationship } from '../../src/assignRanks/make-acyclic'
import { Graph, alg } from 'graphlib'
import tape from 'tape'

tape('rank assignment: makeAcyclic()', tape => {
  //
  // ,--<----------,
  // \       ,- d -`
  //  a -- b -- c
  //    `-----'
  //
  const G = new Graph({directed: true})
  G.setEdge('a', 'b', {})
  G.setEdge('b', 'c', {})
  G.setEdge('a', 'c', {})
  G.setEdge('b', 'd', {})
  G.setEdge('d', 'a', {})

  tape.ok(!alg.isAcyclic(G), 'initially has a cycle')
  makeAcyclic(G, 'a')
  tape.ok(alg.isAcyclic(G), 'made acyclic')

  tape.deepEqual(G.nodes(), ['a', 'b', 'c', 'd'], 'nodes')
  tape.deepEqual(G.edges(), [
    {v: 'a', w: 'b'},
    {v: 'b', w: 'c'},
    {v: 'a', w: 'c'},
    {v: 'b', w: 'd'},
    {v: 'a', w: 'd'}   // REVERSED!
  ], 'edges')
  tape.deepEqual(G.edges().map(e => G.edge(e)), [
    {},
    {},
    {},
    {},
    { reversed: true }
  ], 'edges labels')

  tape.end()
})

tape('rank assignment: find spanning tree', test => {
  const G = new Graph({directed: true})
  G.setEdge('a', 'b')
  G.setEdge('b', 'c')
  G.setEdge('a', 'c')
  G.setEdge('b', 'd')
  G.setEdge('d', 'a')

  test.ok(!alg.isAcyclic(G), 'not acyclic to start with')

  const tree = findSpanningTree(G, 'a')

  test.ok(alg.isAcyclic(tree), 'tree should not have cycles')
  test.deepEqual(tree.nodes(), ['a', 'b', 'c', 'd'], 'all nodes in tree')
  test.deepEqual(
    tree.nodes().map(u => tree.node(u)),
    [
      { depth: 0, thread: 'b' },
      { depth: 1, thread: 'c' },
      { depth: 2, thread: 'd' },
      { depth: 2, thread: 'a' }
    ],
    'depth and thread in tree')
  test.deepEqual(tree.edges(), [
    {v: 'a', w: 'b'},
    {v: 'b', w: 'c'},
    {v: 'b', w: 'd'}
  ], 'tree edges')

  // add same edges in a different order: a-c before b-c
  const G2 = new Graph({directed: true})
  G2.setEdge('a', 'c')
  G2.setEdge('a', 'b')
  G2.setEdge('b', 'c')
  G2.setEdge('b', 'd')
  G2.setEdge('d', 'a')

  const tree2 = findSpanningTree(G2, 'a')

  test.ok(alg.isAcyclic(tree2), 'tree2 should not have cycles')
  test.deepEqual(tree2.nodes(), ['a', 'c', 'b', 'd'], 'all nodes in tree2')
  test.deepEqual(tree2.edges(), [
    {v: 'a', w: 'c'},
    {v: 'a', w: 'b'},
    {v: 'b', w: 'd'}
  ], 'tree2 edges')

  test.end()
})

tape('rank assignment: find spanning tree - multiple solutions', test => {
  // this is a simple version of the double paths in the other examples

  // It doesn'test seem to cause a problem with letters as node ids, but
  // numbers are sorted when using G.successors().

  const G1 = new Graph({directed: true})
  G1.setEdge('0', '1')
  G1.setEdge('1', '2')
  G1.setEdge('0', '2')

  const G2 = new Graph({directed: true})
  G2.setEdge('0', '2')  // different order
  G2.setEdge('0', '1')
  G2.setEdge('1', '2')

  const tree1 = findSpanningTree(G1, '0')
  const tree2 = findSpanningTree(G2, '0')

  test.deepEqual(tree1.edges(), [
    {v: '0', w: '1'},
    {v: '1', w: '2'}
  ], 'tree1 edges')

  test.deepEqual(tree2.edges(), [
    {v: '0', w: '2'},
    {v: '0', w: '1'}
  ], 'tree2 edges')

  test.end()
})

// tape('rank assignment: find spanning tree with reversed edges', test => {
//   // const G = new Graph({directed: true})
//   // G.setEdge('a', 'b')
//   // G.setEdge('b', 'c')
//   // G.setEdge('c', 'd')
//   // G.setNode('c', { reversed: true })
//   // G.setNode('d', { reversed: true })

//   // // test.ok(!alg.isAcyclic(G), 'not acyclic to start with')

//   // const tree = findSpanningTree(G, 'a')

//   // test.ok(alg.isAcyclic(tree), 'tree should not have cycles')
//   // test.deepEqual(tree.nodes(), ['a', 'b', 'c', 'd'], 'all nodes in tree')
//   // test.deepEqual(tree.nodes().map(u => tree.node(u)),
//   //             [
//   //               { depth: 0, thread: 'b' },
//   //               { depth: 1, thread: 'c' },
//   //               { depth: 2, thread: 'd' },
//   //               { depth: 3, thread: 'a' },
//   //             ],
//   //             'depth and thread in tree')
//   // test.deepEqual(tree.edges(), [
//   //   {v: 'a', w: 'b'},
//   //   {v: 'b', w: 'c'},
//   //   {v: 'c', w: 'd'},
//   // ], 'tree edges')

//   // // add same edges in a different order: a-c before b-c
//   // const G2 = new Graph({directed: true})
//   // G2.setEdge('a', 'c')
//   // G2.setEdge('a', 'b')
//   // G2.setEdge('b', 'c')
//   // G2.setEdge('b', 'd')
//   // G2.setEdge('d', 'a')

//   // const tree2 = findSpanningTree(G2, 'a')

//   // test.ok(alg.isAcyclic(tree2), 'tree2 should not have cycles')
//   // test.deepEqual(tree2.nodes(), ['a', 'c', 'b', 'd'], 'all nodes in tree2')
//   // test.deepEqual(tree2.edges(), [
//   //   {v: 'a', w: 'c'},
//   //   {v: 'a', w: 'b'},
//   //   {v: 'b', w: 'd'},
//   // ], 'tree2 edges')

//   test.end()
// })

tape('rank assignment: relationship of nodes in tree', test => {
  // Same spanning tree as before:
  //           ,- c
  //  a -- b -<
  //           `- d
  //
  const tree = new Graph({directed: true})
  tree.setNode('a', { depth: 0, thread: 'b' })
  tree.setNode('b', { depth: 1, thread: 'c' })
  tree.setNode('c', { depth: 2, thread: 'd' })
  tree.setNode('d', { depth: 2, thread: 'a' })
  tree.setEdge('a', 'b')
  tree.setEdge('b', 'c')
  tree.setEdge('b', 'd')

  test.equal(nodeRelationship(tree, 'a', 'b'), 1, 'a-b: descendent')
  test.equal(nodeRelationship(tree, 'b', 'd'), 1, 'b-d: descendent')
  test.equal(nodeRelationship(tree, 'c', 'b'), -1, 'c-b: ancestor')
  test.equal(nodeRelationship(tree, 'c', 'd'), 0, 'c-d: unrelated')

  test.end()
})
