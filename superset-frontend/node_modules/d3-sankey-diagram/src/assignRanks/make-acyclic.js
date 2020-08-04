import { Graph } from 'graphlib'
import { set } from 'd3-collection'

/**
 * Reverse edges in G to make it acyclic
 */
export default function makeAcyclic (G, v0) {
  const tree = findSpanningTree(G, v0)

  G.edges().forEach(e => {
    const rel = nodeRelationship(tree, e.v, e.w)
    if (rel < 0) {
      const label = G.edge(e) || {}
      label.reversed = true
      G.removeEdge(e)
      G.setEdge(e.w, e.v, label)
    }
  })

  return G
}

// find spanning tree, starting from the given node.
// return new graph where nodes have depth and thread
export function findSpanningTree (G, v0) {
  const visited = set()
  const tree = new Graph({directed: true})
  const thread = []

  if (!G.hasNode(v0)) throw Error('node not in graph')

  doDfs(G, v0, visited, tree, thread)
  G.nodes().forEach(u => {
    if (!visited.has(u)) {
      doDfs(G, u, visited, tree, thread)
    }
  })

  thread.forEach((u, i) => {
    tree.node(u).thread = (i + 1 < thread.length) ? thread[i + 1] : thread[0]
  })

  return tree
}

/**
 * Returns 1 if w is a descendent of v, -1 if v is a descendent of w, and 0 if
 * they are unrelated.
 */
export function nodeRelationship (tree, v, w) {
  const V = tree.node(v)
  const W = tree.node(w)
  if (V.depth < W.depth) {
    let u = V.thread  // next node
    while (tree.node(u).depth > V.depth) {
      if (u === w) return 1
      u = tree.node(u).thread
    }
  } else if (W.depth < V.depth) {
    let u = W.thread  // next node
    while (tree.node(u).depth > W.depth) {
      if (u === v) return -1
      u = tree.node(u).thread
    }
  }
  return 0
}

function doDfs (G, v, visited, tree, thread, depth = 0) {
  if (!visited.has(v)) {
    visited.add(v)
    thread.push(v)
    tree.setNode(v, { depth: depth })

    // It doesn't seem to cause a problem with letters as node ids, but numbers
    // are sorted when using G.successors(). So use G.outEdges() instead.
    const next = G.outEdges(v).map(e => e.w)
    next.forEach((w, i) => {
      if (!visited.has(w)) {
        tree.setEdge(v, w, { delta: 1 })
      }
      doDfs(G, w, visited, tree, thread, depth + 1)
    })
  }
}
