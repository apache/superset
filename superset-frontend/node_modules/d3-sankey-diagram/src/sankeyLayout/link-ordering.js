/** @module edge-ordering */

import linkDirection from './link-direction'

/**
 * Order the edges at all nodes.
 */
export default function orderEdges (G, opts) {
  G.nodes().forEach(u => orderEdgesOne(G, u, opts))
}

/**
 * Order the edges at the given node.
 * The ports have already been setup and sorted.
 */
function orderEdgesOne (G, v) {
  const node = G.node(v)
  node.ports.forEach(port => {
    port.incoming.sort(compareDirection(G, node, false))
    port.outgoing.sort(compareDirection(G, node, true))
  })
}

/**
 * Sort links based on their endpoints & type
 */
function compareDirection (G, node, head = true) {
  return function (a, b) {
    var da = linkDirection(G, a, head)
    var db = linkDirection(G, b, head)
    var c = head ? 1 : -1

    // links between same node, sort on type
    if (a.v === b.v && a.w === b.w && Math.abs(da - db) < 1e-3) {
      if (typeof a.name === 'number' && typeof b.name === 'number') {
        return a.name - b.name
      } else if (typeof a.name === 'string' && typeof b.name === 'string') {
        return a.name.localeCompare(b.name)
      } else {
        return 0
      }
    }

    // loops to same slice based on y-position
    if (Math.abs(da - db) < 1e-3) {
      if (a.w === b.w) {
        return G.node(b.v).y - G.node(a.v).y
      } else if (a.v === b.v) {
        return G.node(b.w).y - G.node(a.w).y
      } else {
        return 0
      }
    }

    // otherwise sort by direction
    return c * (da - db)
  }
}
