import { map } from 'd3-collection'
import medianValue from './median-value.js'
import neighbourPositions from './neighbour-positions.js'
import sortByPositions from './sort-by-positions.js'

export default function sortNodes (G, order, sweepDirection = 1, includeLoops = false) {
  if (sweepDirection > 0) {
    for (let r = 1; r < order.length; ++r) {
      let medians = map()
      order[r].forEach(u => {
        const neighbour = medianValue(neighbourPositions(G, order, r, r - 1, u, includeLoops))
        medians.set(u, neighbour)
      })
      sortByPositions(order[r], medians)
    }
  } else {
    for (let r = order.length - 2; r >= 0; --r) {
      let medians = map()
      order[r].forEach(u => {
        const neighbour = medianValue(neighbourPositions(G, order, r, r + 1, u, includeLoops))
        medians.set(u, neighbour)
      })
      sortByPositions(order[r], medians)
    }
  }
}
