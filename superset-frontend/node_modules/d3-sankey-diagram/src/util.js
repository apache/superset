import { Graph } from 'graphlib'

export function buildGraph (graph, nodeId, nodeBackwards, sourceId, targetId, linkType, linkValue) {
  var G = new Graph({ directed: true, multigraph: true })
  graph.nodes.forEach(function (node, i) {
    const id = nodeId(node, i)
    if (G.hasNode(id)) throw new Error('duplicate: ' + id)
    G.setNode(id, {
      data: node,
      index: i,
      backwards: nodeBackwards(node, i),
      // XXX don't need these now have nodePositions?
      x0: node.x0,
      x1: node.x1,
      y: node.y0
    })
  })

  graph.links.forEach(function (link, i) {
    const v = idAndPort(sourceId(link, i))
    const w = idAndPort(targetId(link, i))
    var label = {
      data: link,
      sourcePortId: v.port,
      targetPortId: w.port,
      index: i,
      points: [],
      value: linkValue(link, i)
    }
    if (!G.hasNode(v.id)) throw new Error('missing: ' + v.id)
    if (!G.hasNode(w.id)) throw new Error('missing: ' + w.id)
    G.setEdge(v.id, w.id, label, linkType(link, i))
  })

  G.setGraph({})

  return G
}

function idAndPort (x) {
  if (typeof x === 'object') return x
  return {id: x, port: undefined}
}
