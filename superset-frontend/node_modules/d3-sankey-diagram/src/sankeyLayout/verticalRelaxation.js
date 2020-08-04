import { sum } from 'd3-array'

export default function positionNodesVertically () {
  var iterations = 25
  var nodePadding = 8

  function layout (nested, height) {
    initializeNodeDepth()
    resolveCollisions()
    for (var alpha = 1, i = iterations; i > 0; --i) {
      relaxRightToLeft(alpha *= 0.99)
      resolveCollisions()
      relaxLeftToRight(alpha)
      resolveCollisions()
    }

    function initializeNodeDepth () {
      nested.forEach(layer => {
        let i = 0
        layer.forEach(band => {
          // ignore bands for this layout
          band.forEach(node => {
            node.y = i++
          })
        })
      })
    }

    function relaxLeftToRight (alpha) {
      nested.forEach(layer => {
        layer.forEach(band => {
          band.forEach(node => {
            var edges = node.incoming || node.edges
            if (edges.length) {
              var y = sum(edges, weightedSource) / sum(edges, value)
              node.y += (y - center(node)) * alpha
            }
          })
        })
      })

      function weightedSource (link) {
        return center(link.source) * link.value
      }
    }

    function relaxRightToLeft (alpha) {
      nested.slice().reverse().forEach(layer => {
        layer.forEach(band => {
          band.forEach(node => {
            var edges = node.outgoing || node.edges
            if (edges.length) {
              var y = sum(edges, weightedTarget) / sum(edges, value)
              node.y += (y - center(node)) * alpha
            }
          })
        })
      })

      function weightedTarget (link) {
        return center(link.target) * link.value
      }
    }

    function resolveCollisions () {
      nested.forEach(layer => {
        layer.forEach(nodes => {
          var node
          var dy
          var y0 = 0
          var n = nodes.length
          var i

          // Push any overlapping nodes down.
          nodes.sort(ascendingDepth)
          for (i = 0; i < n; ++i) {
            node = nodes[i]
            dy = y0 - node.y
            if (dy > 0) node.y += dy
            y0 = node.y + node.dy + nodePadding
          }

          // If the bottommost node goes outside the bounds, push it back up.
          dy = y0 - nodePadding - height
          if (dy > 0) {
            y0 = node.y -= dy

            // Push any overlapping nodes back up.
            for (i = n - 2; i >= 0; --i) {
              node = nodes[i]
              dy = node.y + node.dy + nodePadding - y0
              if (dy > 0) node.y -= dy
              y0 = node.y
            }
          }
        })
      })
    }
  }

  layout.iterations = function (x) {
    if (!arguments.length) return iterations
    iterations = +x
    return layout
  }

  layout.padding = function (x) {
    if (!arguments.length) return nodePadding
    nodePadding = +x
    return layout
  }

  return layout
}

function center (node) {
  return node.y + node.dy / 2
}

function value (link) {
  return link.value
}

function ascendingDepth (a, b) {
  return a.y - b.y
}
