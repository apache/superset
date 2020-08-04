/* eslint
   no-plusplus: off,
   no-mixed-operators: off
*/
export default class MonotonicInterpolant {
	constructor(xs, ys) {
		const length = xs.length

		// Rearrange xs and ys so that xs is sorted
		const indexes = []
		for (let i = 0; i < length; i++) {
			indexes.push(i)
		}
		indexes.sort((a, b) => (xs[a] < xs[b] ? -1 : 1))

		// Get consecutive differences and slopes
		const dys = []
		const dxs = []
		const ms = []
		let dx
		let dy
		for (let i = 0; i < length - 1; i++) {
			dx = xs[i + 1] - xs[i]
			dy = ys[i + 1] - ys[i]
			dxs.push(dx)
			dys.push(dy)
			ms.push(dy / dx)
		}

		// Get degree-1 coefficients
		const c1s = [ms[0]]
		for (let i = 0; i < dxs.length - 1; i++) {
			const m = ms[i]
			const mNext = ms[i + 1]
			if (m * mNext <= 0) {
				c1s.push(0)
			} else {
				dx = dxs[i]
				const dxNext = dxs[i + 1]
				const common = dx + dxNext
				c1s.push(3 * common / ((common + dxNext) / m + (common + dx) / mNext))
			}
		}
		c1s.push(ms[ms.length - 1])

		// Get degree-2 and degree-3 coefficients
		const c2s = []
		const c3s = []
		let m
		for (let i = 0; i < c1s.length - 1; i++) {
			m = ms[i]
			const c1 = c1s[i]
			const invDx = 1 / dxs[i]
			const common = c1 + c1s[i + 1] - m - m
			c2s.push((m - c1 - common) * invDx)
			c3s.push(common * invDx * invDx)
		}

		this.xs = xs
		this.ys = ys
		this.c1s = c1s
		this.c2s = c2s
		this.c3s = c3s
	}

	interpolate(x) {
		const { xs, ys, c1s, c2s, c3s } = this

		// The rightmost point in the dataset should give an exact result
		let i = xs.length - 1
		if (x === xs[i]) {
			return ys[i]
		}

		// Search for the interval x is in, returning the corresponding y if x is one of the original xs
		let low = 0
		let high = c3s.length - 1
		let mid
		while (low <= high) {
			mid = Math.floor(0.5 * (low + high))
			const xHere = xs[mid]
			if (xHere < x) {
				low = mid + 1
			} else if (xHere > x) {
				high = mid - 1
			} else {
				return ys[mid]
			}
		}
		i = Math.max(0, high)

		// Interpolate
		const diff = x - xs[i]
		const diffSq = diff * diff
		return ys[i] + c1s[i] * diff + c2s[i] * diffSq + c3s[i] * diff * diffSq
	}
}
