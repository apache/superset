import { set } from 'd3-collection'

/**
 * Take an acyclic graph and assign initial ranks to the nodes
 */
export default function assignInitialRanks (G) {
  // Place nodes on queue when they have no unmarked in-edges. Initially, this
  // means sources.
  const queue = G.sources()
  const seen = set()
  const marked = set()

  // Mark any loops, since they don't affect rank assignment
  G.edges().forEach(e => {
    if (e.v === e.w) marked.add(edgeIdString(e))
  })

  G.nodes().forEach(v => {
    G.node(v).rank = 0
  })

  while (queue.length > 0) {
    const v = queue.shift()
    seen.add(v)

    let V = G.node(v)
    if (!V) G.setNode(v, (V = {}))

    // Set rank to minimum of incoming edges
    V.rank = 0
    G.inEdges(v).forEach(e => {
      const delta = G.edge(e).delta === undefined ? 1 : G.edge(e).delta
      V.rank = Math.max(V.rank, G.node(e.v).rank + delta)
    })

    // Mark outgoing edges
    G.outEdges(v).forEach(e => {
      marked.add(edgeIdString(e))
    })

    // Add nodes to queue when they have no unmarked in-edges.
    G.nodes().forEach(n => {
      if (queue.indexOf(n) < 0 && !seen.has(n) &&
          !G.inEdges(n).some(e => !marked.has(edgeIdString(e)))) {
        queue.push(n)
      }
    })
  }
}

function edgeIdString (e) {
  return e.v + '\x01' + e.w + '\x01' + e.name
}
