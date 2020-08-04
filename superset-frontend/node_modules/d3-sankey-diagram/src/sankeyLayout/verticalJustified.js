import { sum } from 'd3-array'

function defaultSeparation (a, b) {
  return 1
}

export default function positionNodesVertically () {
  var separation = defaultSeparation

  function layout (nested, totalHeight, whitespace) {
    nested.forEach(layer => {
      let y = 0
      layer.forEach((band, j) => {
        // Height of this band, based on fraction of value
        const bandHeight = nested.bandValues[j] / sum(nested.bandValues) * totalHeight

        const margin = whitespace * bandHeight / 5
        const height = bandHeight - 2 * margin
        const total = sum(band, d => d.dy)
        const gaps = band.map((d, i) => {
          if (!d.value) return 0
          return band[i + 1] ? separation(band[i], band[i + 1], layout) : 0
        })
        const space = Math.max(0, height - total)
        const kg = sum(gaps) ? space / sum(gaps) : 0

        const isFirst = true
        const isLast = true  // XXX bands

        let yy = y + margin
        if (band.length === 1) {
          // centre vertically
          yy += (height - band[0].dy) / 2
        }

        let prevGap = isFirst ? Number.MAX_VALUE : 0  // edge of graph
        band.forEach((node, i) => {
          node.y = yy
          node.spaceAbove = prevGap
          node.spaceBelow = gaps[i] * kg
          yy += node.dy + node.spaceBelow
          prevGap = node.spaceBelow

          // XXX is this a good idea?
          if (node.data && node.data.forceY !== undefined) {
            node.y = margin + node.data.forceY * (height - node.dy)
          }
        })
        if (band.length > 0) {
          band[band.length - 1].spaceBelow = isLast ? Number.MAX_VALUE : 0  // edge of graph
        }

        y += bandHeight
      })
    })
  }

  layout.separation = function (x) {
    if (!arguments.length) return separation
    separation = required(x)
    return layout
  }

  return layout
}

function required (f) {
  if (typeof f !== 'function') throw new Error()
  return f
}
