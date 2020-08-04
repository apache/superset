import { Graph } from 'graphlib'
import { map } from 'd3-collection'
/**
 * Create a new graph where nodes in the same rank set are merged into one node.
 *
 * Depends on the "backwards" attribute of the nodes in G, and the "delta"
 * atribute of the edges.
 *
 */
export default function groupedGraph (G, rankSets = []) {
  // Not multigraph because this is only used for calculating ranks
  const GG = new Graph({directed: true})
  if (G.nodes().length === 0) return GG

  // Make sure there is a minimum-rank set
  rankSets = ensureSmin(G, rankSets)

  // Construct map of node ids to the set they are in, if any
  const nodeSets = map()
  var set
  var id
  var i
  var j
  for (i = 0; i < rankSets.length; ++i) {
    set = rankSets[i]
    if (!set.nodes || set.nodes.length === 0) continue
    id = '' + i
    for (j = 0; j < set.nodes.length; ++j) {
      nodeSets.set(set.nodes[j], id)
    }
    GG.setNode(id, { type: set.type, nodes: set.nodes })
  }

  // use i to keep counting new ids
  var nodes = G.nodes()
  G.nodes().forEach(u => {
    const d = G.node(u)
    if (!nodeSets.has(u)) {
      id = '' + (i++)
      set = { type: 'same', nodes: [u] }
      nodeSets.set(u, id)
      GG.setNode(id, set)
    }
  })

  // Add edges between nodes/groups
  G.edges().forEach(e => {
    const d = G.edge(e)
    const sourceSet = nodeSets.get(e.v)
    const targetSet = nodeSets.get(e.w)

    // Minimum edge length depends on direction of nodes:
    //  -> to -> : 1
    //  -> to <- : 0
    //  <- to -> : 0 (in opposite direction??)
    //  <- to <- : 1 in opposite direction
    const edge = GG.edge(sourceSet, targetSet) || { delta: 0 }
    if (sourceSet === targetSet) {
      edge.delta = 0
      GG.setEdge(sourceSet, targetSet, edge)
    } else if (G.node(e.v).backwards) {
      edge.delta = Math.max(edge.delta, G.node(e.w).backwards ? 1 : 0)
      GG.setEdge(targetSet, sourceSet, edge)
    } else {
      edge.delta = Math.max(edge.delta, G.node(e.w).backwards ? 0 : 1)
      GG.setEdge(sourceSet, targetSet, edge)
    }
  })

  return GG
}

// export function linkDelta (nodeBackwards, link) {
//   if (nodeBackwards(link.source)) {
//     return nodeBackwards(link.target) ? 1 : 0
//   } else {
//     return nodeBackwards(link.target) ? 0 : 1
//   }
// }

function ensureSmin (G, rankSets) {
  for (var i = 0; i < rankSets.length; ++i) {
    if (rankSets[i].type === 'min') {
      return rankSets  // ok
    }
  }

  // find the first sourceSet node, or else use the first node
  var sources = G.sources()
  var n0 = sources.length ? sources[0] : G.nodes()[0]
  return [{ type: 'min', nodes: [ n0 ] }].concat(rankSets)
}
