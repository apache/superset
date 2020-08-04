/**
 */

import { sum } from 'd3-array'
import assignRanks from './assignRanks/index.js'
import sortNodes from './sortNodes/index.js'
import { addDummyNodes, removeDummyNodes } from './sortNodes/dummy-nodes.js'
import nestGraph from './sankeyLayout/nest-graph.js'
import positionHorizontally from './sankeyLayout/horizontal.js'
import positionVertically from './sankeyLayout/verticalJustified.js'
import prepareNodePorts from './sankeyLayout/prepare-subdivisions.js'
import orderLinks from './sankeyLayout/link-ordering.js'
import layoutLinks from './sankeyLayout/layout-links.js'
import { buildGraph } from './util.js'

function defaultNodes (graph) {
  return graph.nodes
}

function defaultLinks (graph) {
  return graph.links
}

function defaultNodeId (d) {
  return d.id
}

function defaultNodeBackwards (d) {
  return d.direction && d.direction.toLowerCase() === 'l'
}

function defaultSourceId (d) {
  // return typeof d.source === 'object' ? d.source.id : d.source
  return {
    id: typeof d.source === 'object' ? d.source.id : d.source,
    port: typeof d.sourcePort === 'object' ? d.sourcePort.id : d.sourcePort
  }
}

function defaultTargetId (d) {
  // return typeof d.target === 'object' ? d.target.id : d.target
  return {
    id: typeof d.target === 'object' ? d.target.id : d.target,
    port: typeof d.targetPort === 'object' ? d.targetPort.id : d.targetPort
  }
}

function defaultLinkType (d) {
  return d.type
}

function defaultSortPorts (a, b) {
  // XXX weighted sum
  return a.id.localeCompare(b.id)
}

// function defaultNodeSubdivisions

export default function sankeyLayout () {
  var nodes = defaultNodes
  var links = defaultLinks
  var nodeId = defaultNodeId
  var nodeBackwards = defaultNodeBackwards
  var sourceId = defaultSourceId
  var targetId = defaultTargetId
  var linkType = defaultLinkType
  var ordering = null
  var rankSets = []
  var maxIterations = 25 // XXX setter/getter
  var nodePosition = null
  var sortPorts = defaultSortPorts

  // extent
  var x0 = 0
  var y0 = 0
  var x1 = 1
  var y1 = 1

  // node width
  var dx = 1

  var scale = null
  var linkValue = function (e) { return e.value }
  var whitespace = 0.5
  var verticalLayout = positionVertically()

  function sankey () {
    var graph = {nodes: nodes.apply(null, arguments), links: links.apply(null, arguments)}
    var G = buildGraph(graph, nodeId, nodeBackwards, sourceId, targetId, linkType, linkValue)

    setNodeValues(G, linkValue)

    if (nodePosition) {
      // hard-coded node positions

      G.nodes().forEach(u => {
        const node = G.node(u)
        const pos = nodePosition(node.data)
        node.x0 = pos[0]
        node.x1 = pos[0] + dx
        node.y = pos[1]
      })
      setWidths(G, scale)
    } else {
      // calculate node positions

      if (ordering !== null) {
        applyOrdering(G, ordering)
      } else {
        assignRanks(G, rankSets)
        sortNodes(G, maxIterations)
      }

      addDummyNodes(G)
      setNodeValues(G, linkValue)
      if (ordering === null) {
        // XXX sort nodes?
        sortNodes(G, maxIterations)
      }

      const nested = nestGraph(G.nodes().map(u => G.node(u)))
      maybeScaleToFit(G, nested)
      setWidths(G, scale)

      // position nodes
      verticalLayout(nested, y1 - y0, whitespace)
      positionHorizontally(G, x1 - x0, dx)

      // adjust origin
      G.nodes().forEach(u => {
        const node = G.node(u)
        node.x0 += x0
        node.x1 += x0
        node.y += y0
      })
    }

    // sort & position links
    prepareNodePorts(G, sortPorts)
    orderLinks(G)
    layoutLinks(G)

    removeDummyNodes(G)
    addLinkEndpoints(G)

    copyResultsToGraph(G, graph)

    return graph
  }

  sankey.update = function (graph, doOrderLinks) {
    var G = buildGraph(graph, nodeId, nodeBackwards, sourceId, targetId, linkType, linkValue)
    setNodeValues(G, linkValue)
    const nested = nestGraph(G.nodes().map(u => G.node(u)))
    maybeScaleToFit(G, nested)
    setWidths(G, scale)

    prepareNodePorts(G, sortPorts)
    orderLinks(G)
    layoutLinks(G)

    // removeDummyNodes(G)
    addLinkEndpoints(G)

    copyResultsToGraph(G, graph)

    return graph
  }
  //   if (scale === null) sankey.scaleToFit(graph)
  //   // set node and edge sizes
  //   setNodeValues(graph, linkValue, scale)
  //   if (doOrderLinks) {
  //     orderLinks(graph)
  //   }
  //   layoutLinks(graph)
  //   return graph
  // }

  sankey.nodes = function (x) {
    if (arguments.length) {
      nodes = required(x)
      return sankey
    }
    return nodes
  }

  sankey.links = function (x) {
    if (arguments.length) {
      links = required(x)
      return sankey
    }
    return links
  }

  sankey.nodeId = function (x) {
    if (arguments.length) {
      nodeId = required(x)
      return sankey
    }
    return nodeId
  }

  sankey.nodeBackwards = function (x) {
    if (arguments.length) {
      nodeBackwards = required(x)
      return sankey
    }
    return nodeBackwards
  }

  sankey.sourceId = function (x) {
    if (arguments.length) {
      sourceId = required(x)
      return sankey
    }
    return sourceId
  }

  sankey.targetId = function (x) {
    if (arguments.length) {
      targetId = required(x)
      return sankey
    }
    return targetId
  }

  sankey.linkType = function (x) {
    if (arguments.length) {
      linkType = required(x)
      return sankey
    }
    return linkType
  }

  sankey.sortPorts = function (x) {
    if (arguments.length) {
      sortPorts = required(x)
      return sankey
    }
    return sortPorts
  }

  // sankey.scaleToFit = function (graph) {
  function maybeScaleToFit (G, nested) {
    if (scale !== null) return
    const maxValue = sum(nested.bandValues)
    if (maxValue <= 0) {
      scale = 1
    } else {
      scale = (y1 - y0) / maxValue
      if (whitespace !== 1) scale *= (1 - whitespace)
    }
  }

  sankey.ordering = function (x) {
    if (!arguments.length) return ordering
    ordering = x
    return sankey
  }

  sankey.rankSets = function (x) {
    if (!arguments.length) return rankSets
    rankSets = x
    return sankey
  }

  sankey.nodeWidth = function (x) {
    if (!arguments.length) return dx
    dx = x
    return sankey
  }

  sankey.nodePosition = function (x) {
    if (!arguments.length) return nodePosition
    nodePosition = x
    return sankey
  }

  sankey.size = function (x) {
    if (!arguments.length) return [x1 - x0, y1 - y0]
    x0 = y0 = 0
    x1 = +x[0]
    y1 = +x[1]
    return sankey
  }

  sankey.extent = function (x) {
    if (!arguments.length) return [[x0, y0], [x1, y1]]
    x0 = +x[0][0]
    y0 = +x[0][1]
    x1 = +x[1][0]
    y1 = +x[1][1]
    return sankey
  }

  sankey.whitespace = function (x) {
    if (!arguments.length) return whitespace
    whitespace = x
    return sankey
  }

  sankey.scale = function (x) {
    if (!arguments.length) return scale
    scale = x
    return sankey
  }

  sankey.linkValue = function (x) {
    if (!arguments.length) return linkValue
    linkValue = x
    return sankey
  }

  sankey.verticalLayout = function (x) {
    if (!arguments.length) return verticalLayout
    verticalLayout = required(x)
    return sankey
  }

  function applyOrdering (G, ordering) {
    ordering.forEach((x, i) => {
      x.forEach((u, j) => {
        if (u.forEach) {
          u.forEach((v, k) => {
            const d = G.node(v)
            if (d) {
              d.rank = i
              d.band = j
              d.depth = k
            }
          })
        } else {
          const d = G.node(u)
          if (d) {
            d.rank = i
            // d.band = 0
            d.depth = j
          }
        }
      })
    })
  }

  return sankey
}

function setNodeValues (G, linkValue) {
  G.nodes().forEach(u => {
    const d = G.node(u)
    const incoming = sum(G.inEdges(u), e => G.edge(e).value)
    const outgoing = sum(G.outEdges(u), e => G.edge(e).value)
    d.value = Math.max(incoming, outgoing)
  })
}

function setWidths (G, scale) {
  G.edges().forEach(e => {
    const edge = G.edge(e)
    edge.dy = edge.value * scale
  })
  G.nodes().forEach(u => {
    const node = G.node(u)
    node.dy = node.value * scale
  })
}

function required (f) {
  if (typeof f !== 'function') throw new Error()
  return f
}

function addLinkEndpoints (G) {
  G.edges().forEach(e => {
    const edge = G.edge(e)
    edge.points.unshift({x: edge.x0, y: edge.y0, ro: edge.r0, d: edge.d0})
    edge.points.push({x: edge.x1, y: edge.y1, ri: edge.r1, d: edge.d1})
  })
}

function copyResultsToGraph (G, graph) {
  G.nodes().forEach(u => {
    const node = G.node(u)

    // Build lists of edge data objects
    node.data.incoming = []
    node.data.outgoing = []
    node.data.ports = node.ports
    node.data.ports.forEach(port => {
      port.incoming = []
      port.outgoing = []
    })

    node.data.dy = node.dy
    node.data.x0 = node.x0
    node.data.x1 = node.x1
    node.data.y0 = node.y
    node.data.y1 = node.y + node.dy
    node.data.rank = node.rank
    node.data.band = node.band
    node.data.depth = node.depth
    node.data.value = node.value
    node.data.spaceAbove = node.spaceAbove
    node.data.spaceBelow = node.spaceBelow
  })

  G.edges().forEach(e => {
    const edge = G.edge(e)
    edge.data.source = G.node(e.v).data
    edge.data.target = G.node(e.w).data
    edge.data.sourcePort = edge.sourcePort
    edge.data.targetPort = edge.targetPort
    // console.log(edge)
    edge.data.source.outgoing.push(edge.data)
    edge.data.target.incoming.push(edge.data)
    if (edge.data.sourcePort) edge.data.sourcePort.outgoing.push(edge.data)
    if (edge.data.targetPort) edge.data.targetPort.incoming.push(edge.data)
    // edge.data.value = edge.value
    edge.data.dy = edge.dy
    edge.data.points = edge.points || []
    // edge.data.id = `${e.v}-${e.w}-${e.name}`
  })
}
