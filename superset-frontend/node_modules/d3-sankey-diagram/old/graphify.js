import { map } from 'd3-collection'
import Digraph from './digraph.js'

function defaultNodeId (d) {
  return d.id
}

function defaultNodeBackwards (d) {
  return d.direction && d.direction.toLowerCase() === 'l'
}

function defaultSourceId (d) {
  return d.source
}

function defaultTargetId (d) {
  return d.target
}

function defaultEdgeType (d) {
  return d.type
}

export default function () {
  var nodeId = defaultNodeId
  var nodeBackwards = defaultNodeBackwards
  var sourceId = defaultSourceId
  var targetId = defaultTargetId
  var edgeType = defaultEdgeType

  function graphify (nodeData, edgeData) {
    var i
    var d
    var nn = nodeData.length
    var ne = edgeData.length
    var nodes = new Array(nn)
    var edges = new Array(ne)
    var node
    var nodesByKey = map()
    var sid
    var tid

    for (i = 0; i < nn; ++i) {
      node = nodes[i] = newNode(nodeId(nodeData[i], i), nodeData[i])
      if (nodesByKey.has(node.id)) {
        throw new Error('duplicate node id: ' + node.id)
      }
      nodesByKey.set(node.id, node)
    }

    for (i = 0; i < ne; ++i) {
      d = edgeData[i]
      sid = sourceId(d)
      tid = targetId(d)
      if (!nodesByKey.has(sid)) {
        nodesByKey.set(sid, node = newNode(sid, {}))
        nodes.push(node)
      }
      if (!nodesByKey.has(tid)) {
        nodesByKey.set(tid, node = newNode(tid, {}))
        nodes.push(node)
      }
      edges[i] = {
        source: nodesByKey.get(sid),
        target: nodesByKey.get(tid),
        type: edgeType(d),
        data: d
      }
      edges[i].source.outgoing.push(edges[i])
      edges[i].target.incoming.push(edges[i])
    }

    var graph = new Digraph()
    graph._nodes = nodes
    graph._edges = edges
    return graph
  }

  function newNode (i, d) {
    return { id: i, incoming: [], outgoing: [], backwards: !!nodeBackwards(d), data: d }
  }

  graphify.nodeId = function (x) {
    if (arguments.length) {
      nodeId = required(x)
      return graphify
    }
    return nodeId
  }

  graphify.nodeBackwards = function (x) {
    if (arguments.length) {
      nodeBackwards = required(x)
      return graphify
    }
    return nodeBackwards
  }

  graphify.sourceId = function (x) {
    if (arguments.length) {
      sourceId = required(x)
      return graphify
    }
    return sourceId
  }

  graphify.targetId = function (x) {
    if (arguments.length) {
      targetId = required(x)
      return graphify
    }
    return targetId
  }

  graphify.edgeType = function (x) {
    if (arguments.length) {
      edgeType = required(x)
      return graphify
    }
    return edgeType
  }

  return graphify
}

function required (f) {
  if (typeof f !== 'function') throw new Error()
  return f
}
