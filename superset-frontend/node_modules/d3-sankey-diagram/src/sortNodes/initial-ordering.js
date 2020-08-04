import { alg } from 'graphlib'
import { map } from 'd3-collection'

export default function initialOrdering (G, ranks) {
  let order = []
  if (ranks.length === 0) return order

  // Start with sources & nodes in rank 0
  let start = G.sources()
  let nodeRanks = map()
  ranks.forEach((nodes, i) => {
    order.push([])
    nodes.forEach(u => {
      if (i === 0 && start.indexOf(u) < 0) start.push(u)
      nodeRanks.set(u, i)
    })
  })

  alg.preorder(G, start).forEach(u => {
    order[nodeRanks.get(u)].push(u)
  })

  return order
}
