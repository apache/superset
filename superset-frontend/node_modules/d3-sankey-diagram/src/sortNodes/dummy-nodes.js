export function addDummyNodes (G) {
  // Add edges & dummy nodes
  if (typeof G.graph() !== 'object') G.setGraph({})
  G.graph().dummyChains = []
  G.edges().forEach(e => normaliseEdge(G, e))
}

// based on https://github.com/cpettitt/dagre/blob/master/lib/normalize.js
function normaliseEdge (G, e) {
  const edge = G.edge(e)
  const dummies = dummyNodes(G.node(e.v), G.node(e.w))
  if (dummies.length === 0) return

  G.removeEdge(e)

  let v = e.v
  dummies.forEach((dummy, i) => {
    const id = `__${e.v}_${e.w}_${i}`
    if (!G.hasNode(id)) {
      dummy.dummy = 'edge'
      G.setNode(id, dummy)
      if (i === 0) {
        G.graph().dummyChains.push(id)
      }
    }
    addDummyEdge(v, (v = id))
  })
  addDummyEdge(v, e.w)

  function addDummyEdge (v, w) {
    const label = { points: [], value: edge.value, origEdge: e, origLabel: edge }
    G.setEdge(v, w, label, e.name)
  }
}

export function removeDummyNodes (G) {
  const chains = G.graph().dummyChains || []
  chains.forEach(v => {
    let node = G.node(v)
    let dummyEdges = G.inEdges(v).map(e => G.edge(e))

    // Set dy and starting point of edge and add back to graph
    dummyEdges.forEach(dummyEdge => {
      dummyEdge.origLabel.dy = dummyEdge.dy
      dummyEdge.origLabel.x0 = dummyEdge.x0
      dummyEdge.origLabel.y0 = dummyEdge.y0
      dummyEdge.origLabel.r0 = dummyEdge.r0
      dummyEdge.origLabel.d0 = dummyEdge.d0
      G.setEdge(dummyEdge.origEdge, dummyEdge.origLabel)
    })
    let r1s = dummyEdges.map(dummyEdge => dummyEdge.r1)

    // Walk through chain
    let w
    while (node.dummy) {
      dummyEdges = G.outEdges(v).map(e => G.edge(e))
      dummyEdges.forEach((dummyEdge, i) => {
        dummyEdge.origLabel.points.push({
          x: (node.x0 + node.x1) / 2,
          y: dummyEdge.y0,
          d: dummyEdge.d0,
          ro: dummyEdge.r0,
          ri: r1s[i]  // from last edge
        })
      })
      r1s = dummyEdges.map(dummyEdge => dummyEdge.r1)

      // move on
      w = G.successors(v)[0]
      G.removeNode(v)
      node = G.node(v = w)
    }

    // Set ending point of edge
    dummyEdges.forEach(dummyEdge => {
      dummyEdge.origLabel.x1 = dummyEdge.x1
      dummyEdge.origLabel.y1 = dummyEdge.y1
      dummyEdge.origLabel.r1 = dummyEdge.r1
      dummyEdge.origLabel.d1 = dummyEdge.d1
    })
  })
}

export function dummyNodes (source, target) {
  const dummyNodes = []
  let r = source.rank

  if (r + 1 <= target.rank) {
    // add more to get forwards
    if (source.backwards) {
      dummyNodes.push({rank: r, backwards: false})  // turn around
    }
    while (++r < target.rank) {
      dummyNodes.push({rank: r, backwards: false})
    }
    if (target.backwards) {
      dummyNodes.push({rank: r, backwards: false})  // turn around
    }
  } else if (r > target.rank) {
    // add more to get backwards
    if (!source.backwards) {
      dummyNodes.push({rank: r, backwards: true})  // turn around
    }
    while (r-- > target.rank + 1) {
      dummyNodes.push({rank: r, backwards: true})
    }
    if (!target.backwards) {
      dummyNodes.push({rank: r, backwards: true})  // turn around
    }
  }

  return dummyNodes
}
