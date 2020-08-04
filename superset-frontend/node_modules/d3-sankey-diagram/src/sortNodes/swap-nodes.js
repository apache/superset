import countCrossings from './count-crossings'

export default function swapNodes (G, order) {
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < order.length; ++i) {
      for (let j = 0; j < order[i].length - 1; ++j) {
        let count0 = allCrossings(G, order, i)
        transpose(order[i], j, j + 1)
        let count1 = allCrossings(G, order, i)

        if (count1 < count0) {
          improved = true
        } else {
          transpose(order[i], j, j + 1)  // put back
        }
      }
    }
  }
}

function allCrossings (G, order, i) {
  let count = 0
  if (i > 0) {
    count += countCrossings(G, order[i - 1], order[i])
  }
  if (i + 1 < order.length) {
    count += countCrossings(G, order[i], order[i + 1])
  }
  return count
}

function transpose (list, i, j) {
  const tmp = list[i]
  list[i] = list[j]
  list[j] = tmp
}
