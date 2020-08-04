export default function medianValue (positions) {
  const m = Math.floor(positions.length / 2)
  if (positions.length === 0) {
    return -1
  } else if (positions.length % 2 === 1) {
    return positions[m]
  } else if (positions.length === 2) {
    return (positions[0] + positions[1]) / 2
  } else {
    const left = positions[m - 1] - positions[0]
    const right = positions[positions.length - 1] - positions[m]
    return (positions[m - 1] * right + positions[m] * left) / (left + right)
  }
}
