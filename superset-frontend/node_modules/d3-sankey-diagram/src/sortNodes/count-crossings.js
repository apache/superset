/** @module node-ordering/count-crossings */

/**
 * Count the total number of crossings between 2 layers.
 *
 * This is the sum of the countBetweenCrossings and countLoopCrossings.
 *
 * @param {Graph} G - The graph.
 * @param {Array} orderA - List of node ids on left side.
 * @param {Array} orderB - List of node ids on right side.
 */
export default function countCrossings (G, orderA, orderB) {
  return (
    countBetweenCrossings(G, orderA, orderB) // +
    // countLoopCrossings(G, orderA, orderB)
  )
}

/**
 * Count the number of crossings of edges passing between 2 layers.
 *
 * Algorithm from
 * http://jgaa.info/accepted/2004/BarthMutzelJuenger2004.8.2.pdf
 *
 * @param {Graph} G - The graph.
 * @param {Array} orderA - List of node ids on left side.
 * @param {Array} orderB - List of node ids on right side.
 */
export function countBetweenCrossings (G, orderA, orderB) {
  let north
  let south
  let q

  if (orderA.length > orderB.length) {
    north = orderA
    south = orderB
  } else {
    north = orderB
    south = orderA
  }
  q = south.length

  // lexicographically sorted edges from north to south
  let southSeq = []
  north.forEach(u => {
    south.forEach((v, j) => {
      if (G.hasEdge(u, v) || G.hasEdge(v, u)) southSeq.push(j)
    })
  })

  // build accumulator tree
  let firstIndex = 1
  while (firstIndex < q) firstIndex *= 2
  const treeSize = 2 * firstIndex - 1  // number of tree nodes
  firstIndex -= 1                      // index of leftmost leaf

  let tree = new Array(treeSize)
  for (let i = 0; i < treeSize; i++) tree[i] = 0

  // count the crossings
  let count = 0
  southSeq.forEach(k => {
    let index = k + firstIndex
    tree[index]++
    while (index > 0) {
      if (index % 2) count += tree[index + 1]
      index = Math.floor((index - 1) / 2)
      tree[index]++
    }
  })

  return count
}

/**
 * Count the number of crossings from within-layer edges.
 *
 * @param {Graph} G - The graph.
 * @param {Array} orderA - List of node ids on left side.
 * @param {Array} orderB - List of node ids on right side.
 */
export function countLoopCrossings (G, orderA, orderB) {
  // Count crossings from edges within orderA and within orderB.
  // Only look for edges on the right of orderA (forward edges)
  // and on the left of orderB (reverse edges)

  // how many edges pass across?
  let crossA = orderA.map(d => 0)
  let crossB = orderB.map(d => 0)

  orderA.forEach((u, i) => {
    G.outEdges(u).forEach(e => {
      if (e.v !== e.w && !G.edge(e).reverse) {
        let index = orderA.indexOf(e.w)
        if (index >= 0) {
          if (i > index) {
            let j = index + 1
            while (j < i) {
              crossA[j++] += 1
            }
          } else {
            let j = i + 1
            while (j < index) {
              crossA[j++] += 1
            }
          }
        }
      }
    })
  })

  orderB.forEach((u, i) => {
    G.outEdges(u).forEach(e => {
      if (e.v !== e.w && G.edge(e).reverse) {
        let index = orderB.indexOf(e.w)
        if (index >= 0) {
          if (i > index) {
            let j = index + 1
            while (j < i) {
              crossB[j++] += 1
            }
          } else {
            let j = i + 1
            while (j < index) {
              crossB[j++] += 1
            }
          }
        }
      }
    })
  })

  let count = 0
  orderA.forEach((u, i) => {
    orderB.forEach((v, j) => {
      const N = G.nodeEdges(u, v).length
      count += N * (crossA[i] + crossB[j])
    })
  })

  return count
}
