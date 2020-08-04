export default function neighbourPositions (G, order, i, j, u, includeLoops = false) {
  // current rank i
  // neighbour rank j
  const thisRank = order[i]
  const otherRank = order[j]

  const positions = []

  // neighbouring positions on other rank
  otherRank.forEach((n, i) => {
    if (G.nodeEdges(n, u).length > 0) {
      positions.push(i)
    }
  })

  if (positions.length === 0 && includeLoops) {
    // if no neighbours in other rank, look for loops to this rank
    // XXX only on one side?
    thisRank.forEach((n, i) => {
      if (G.nodeEdges(n, u).length > 0) {
        positions.push(i + 0.5)
      }
    })
  }

  positions.sort((a, b) => a - b)

  return positions
}
