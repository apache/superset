/** @module node-ordering */

import initialOrdering from './initial-ordering.js'
import swapNodes from './swap-nodes.js'
import countCrossings from './count-crossings.js'
import sortNodesOnce from './weighted-median-sort.js'

/**
 * Sorts the nodes in G, setting the `depth` attribute on each.
 *
 * @param {Graph} G - The graph. Nodes must have a `rank` attribute.
 *
 */
export default function sortNodes (G, maxIterations = 25) {
  let ranks = getRanks(G)
  let order = initialOrdering(G, ranks)
  let best = order
  let i = 0

  while (i++ < maxIterations) {
    sortNodesOnce(G, order, (i % 2 === 0))
    swapNodes(G, order)
    if (allCrossings(G, order) < allCrossings(G, best)) {
      // console.log('improved', allCrossings(G, order), order);
      best = copy(order)
    }
  }

  // Assign depth to nodes
  // const depths = map()
  best.forEach(nodes => {
    nodes.forEach((u, i) => {
      // depths.set(u, i)
      G.node(u).depth = i
    })
  })
}

function getRanks (G) {
  const ranks = []
  G.nodes().forEach(u => {
    const r = G.node(u).rank || 0
    while (r >= ranks.length) ranks.push([])
    ranks[r].push(u)
  })
  return ranks
}

function allCrossings (G, order) {
  let count = 0
  for (let i = 0; i < order.length - 1; ++i) {
    count += countCrossings(G, order[i], order[i + 1])
  }
  return count
}

function copy (order) {
  let result = []
  order.forEach(rank => {
    result.push(rank.map(d => d))
  })
  return result
}
