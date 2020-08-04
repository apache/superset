import union from 'lodash/union'
import without from 'lodash/without'

export default class EnterLeaveCounter {
	constructor() {
		this.entered = []
	}

	enter(enteringNode) {
		const previousLength = this.entered.length

		const isNodeEntered = node =>
			document.documentElement.contains(node) &&
			(!node.contains || node.contains(enteringNode))

		this.entered = union(this.entered.filter(isNodeEntered), [enteringNode])

		return previousLength === 0 && this.entered.length > 0
	}

	leave(leavingNode) {
		const previousLength = this.entered.length

		this.entered = without(
			this.entered.filter(node => document.documentElement.contains(node)),
			leavingNode,
		)

		return previousLength > 0 && this.entered.length === 0
	}

	reset() {
		this.entered = []
	}
}
