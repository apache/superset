import { map } from 'd3-collection'

/**
 * Sort arr according to order. -1 in order means stay in same position.
 */
export default function sortByPositions (arr, order) {
  const origOrder = map(arr.map((d, i) => [d, i]), d => d[0])

  // console.log('sorting', arr, order, origOrder)
  for (let i = 1; i < arr.length; ++i) {
    // console.group('start', i, arr[i])
    for (let k = i; k > 0; --k) {
      let j = k - 1
      let a = order.get(arr[j])
      let b = order.get(arr[k])

      // count back over any fixed positions (-1)
      while ((a = order.get(arr[j])) === -1 && j > 0) j--

      // console.log(j, k, arr[j], arr[k], a, b)
      if (b === -1 || a === -1) {
        // console.log('found -1', a, b, 'skipping', j, k)
        break
      }

      if (a === b) {
        a = origOrder.get(arr[j])
        b = origOrder.get(arr[k])
        // console.log('a == b, switching to orig order', a, b)
      }

      if (b >= a) {
        // console.log('k > k -1, stopping')
        break
      }
      // console.log('swapping', arr[k], arr[j])
      // swap arr[k], arr[j]
      [arr[k], arr[j]] = [arr[j], arr[k]]
      // console.log(arr)
    }
    // console.groupEnd()
  }
  // console.log('-->', arr)
}
