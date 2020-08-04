export default function shallowEqual(objA, objB) {
	if (objA === objB) {
		return true
	}

	const keysA = Object.keys(objA)
	const keysB = Object.keys(objB)

	if (keysA.length !== keysB.length) {
		return false
	}

	// Test for A's keys different from B.
	const hasOwn = Object.prototype.hasOwnProperty
	for (let i = 0; i < keysA.length; i += 1) {
		if (!hasOwn.call(objB, keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
			return false
		}

		const valA = objA[keysA[i]]
		const valB = objB[keysA[i]]

		if (valA !== valB) {
			return false
		}
	}

	return true
}
