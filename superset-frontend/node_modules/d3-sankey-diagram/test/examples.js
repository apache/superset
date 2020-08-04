import { Graph } from 'graphlib'

export function exampleWithLoop () {
  //
  //  f -------,    b<-,
  //  a -- b -- c -- e `
  //    `------ d -'
  //              \
  //      <h---<g-`
  //
  const G = new Graph({directed: true})

  G.setEdge('a', 'b')
  G.setEdge('a', 'd')
  G.setEdge('b', 'c')
  G.setEdge('c', 'e')
  G.setEdge('d', 'e')
  G.setEdge('e', 'b')
  G.setEdge('f', 'c')

  const rankSets = [
    { type: 'same', nodes: ['c', 'd'] }
  ]

  return { G, rankSets }
  // var nodes = [
  //   {id: 'g', direction: 'l'},
  //   {id: 'h', direction: 'l'}
  // ]

  // var edges = [
  //   {source: 'a', target: 'b'},
  //   {source: 'b', target: 'c'},
  //   {source: 'a', target: 'd'},
  //   {source: 'c', target: 'e'},
  //   {source: 'd', target: 'e'},
  //   {source: 'e', target: 'b'},
  //   {source: 'f', target: 'c'},
  //   {source: 'd', target: 'g'},
  //   {source: 'g', target: 'h'}
  // ]

  // var rankSets = [
  //   { type: 'same', nodes: ['c', 'd'] }
  // ]

  // var graph = layeredGraph()(nodes, edges)

  // return { graph: graph, rankSets: rankSets }
}

export function exampleWithReversedNodes () {
  //
  //      a -- b
  //       `
  // d -- c'
  //
  var nodes = [
    {id: 'c', direction: 'l'},
    {id: 'd', direction: 'l'}
  ]

  var edges = [
    {source: 'a', target: 'b'},
    {source: 'a', target: 'c'},
    {source: 'c', target: 'd'}
  ]

  var graph = layeredGraph()(nodes, edges)

  return { graph: graph, rankSets: [] }
}


// export function exampleBlastFurnaceWithDummy() {
//   let G = new Graph({ directed: true });

//   // Simplified example of links through coke oven and blast furnace
//   // Padded to have dummy nodes

//   let ranks = [
//     ['_bf_input_5', 'input', '_oven_input_2'],
//     ['_bf_input_4', 'oven', '_oven_input_1', '_input_sinter_1'],
//     ['_bf_input_3', 'coke', '_input_sinter_2', '_oven_export_1'],
//     ['_bf_input_2', '_coke_bf', 'sinter', '_oven_export_2'],
//     ['_bf_input_1', 'bf', '_sinter_export', '_oven_export_3'],
//     ['output', 'export'],
//   ];

//   ranks.forEach((rank, i) => {
//     rank.forEach(u => {
//       G.setNode(u, { rank: i });
//     });
//   });

//   // main flow
//   G.setEdge('input', 'oven', {});
//   G.setEdge('oven', 'coke', {});
//   G.setEdge('coke', 'sinter', {});
//   G.setEdge('coke', '_coke_bf', {});
//   G.setEdge('_coke_bf', 'bf', {});
//   G.setEdge('sinter', 'bf', {});
//   G.setEdge('bf', 'output', {});
//   G.setEdge('bf', 'export', {});

//   // additional export links, and input-sinter
//   G.setEdge('sinter', '_sinter_export', {});
//   G.setEdge('_sinter_export', 'export', {});
//   G.setEdge('oven', '_oven_export_1', {});
//   G.setEdge('_oven_export_1', '_oven_export_2', {});
//   G.setEdge('_oven_export_2', '_oven_export_3', {});
//   G.setEdge('_oven_export_3', 'export', {});
//   G.setEdge('input', '_input_sinter_1', {});
//   G.setEdge('_input_sinter_1', '_input_sinter_2', {});
//   G.setEdge('_input_sinter_2', 'sinter', {});

//   // return loops
//   G.setEdge('oven', '_oven_input_1', {});
//   G.setEdge('_oven_input_1', '_oven_input_2', {});
//   G.setEdge('_oven_input_2', 'input', {});
//   G.setEdge('bf', '_bf_input_1', {});
//   G.setEdge('_bf_input_1', '_bf_input_2', {});
//   G.setEdge('_bf_input_2', '_bf_input_3', {});
//   G.setEdge('_bf_input_3', '_bf_input_4', {});
//   G.setEdge('_bf_input_4', '_bf_input_5', {});
//   G.setEdge('_bf_input_5', 'input', {});

//   let initialOrder = [
//     ['input', '_oven_input_2', '_bf_input_5'],
//     ['_bf_input_4', '_oven_input_1', '_input_sinter_1', 'oven'],
//     ['coke', '_oven_input_2', '_bf_input_3', '_oven_export_1'],
//     ['_bf_input_2', '_oven_export_2', '_coke_bf', 'sinter'],
//     ['_bf_input_1', 'bf', '_sinter_export', '_oven_export_3'],
//     ['export', 'output'],
//   ];

//   return {G, ranks, initialOrder};
// }
