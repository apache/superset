import { Graph } from 'graphlib';


export function exampleTwoLevel() {
  let G = new Graph({ directed: true });

  // Example from Barth2004
  G.setEdge('n0', 's0', {});
  G.setEdge('n1', 's1', {});
  G.setEdge('n1', 's2', {});
  G.setEdge('n2', 's0', {});
  G.setEdge('n2', 's3', {});
  G.setEdge('n2', 's4', {});
  G.setEdge('n3', 's0', {});
  G.setEdge('n3', 's2', {});
  G.setEdge('n4', 's3', {});
  G.setEdge('n5', 's2', {});
  G.setEdge('n5', 's4', {});

  let order = [
    ['n0', 'n1', 'n2', 'n3', 'n4', 'n5'],
    ['s0', 's1', 's2', 's3', 's4'],
  ];

  return {G, order};
}


export function exampleTwoLevelMultigraph() {
  let G = new Graph({ directed: true, multigraph: true });

  G.setEdge('a', '1', {}, 'm1');
  G.setEdge('a', '3', {}, 'm1');
  G.setEdge('a', '3', {}, 'm2');
  G.setEdge('b', '2', {}, 'm1');
  G.setEdge('b', '3', {}, 'm1');
  G.setNode('4', {});

  let order = [
    ['a', 'b'],
    ['1', '2', '3', '4'],
  ];

  return {G, order};
}


export function exampleTwoLevelWithLoops(type=undefined) {
  let G = new Graph({ directed: true, multigraph: type !== undefined });

  G.setEdge('n0', 's0', {}, type);
  G.setEdge('n0', 'n2', {}, type);  // loop
  G.setEdge('n1', 's0', {}, type);
  G.setEdge('n2', 's1', {}, type);

  let order = [
    ['n0', 'n1', 'n2'],
    ['s0', 's1'],
  ];

  return {G, order};
}


// function exampleTwoLevel() {
//   let G = new Graph({ directed: true });

//   G.setEdge('1', 'a');
//   G.setEdge('2', 'b');
//   G.setEdge('2', 'd');
//   G.setEdge('3', 'c');
//   G.setEdge('3', 'd');
//   G.setEdge('4', 'c');
//   G.setEdge('4', 'd');

//   let nodes = [
//     ['1', '2', '3', '4'],
//     ['a', 'b', 'c', 'd'],
//   ];

//   return {G, nodes};
// }
