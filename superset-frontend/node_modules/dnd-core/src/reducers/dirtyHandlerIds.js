import xor from 'lodash/xor'
import intersection from 'lodash/intersection'
import {
	BEGIN_DRAG,
	PUBLISH_DRAG_SOURCE,
	HOVER,
	END_DRAG,
	DROP,
} from '../actions/dragDrop'
import {
	ADD_SOURCE,
	ADD_TARGET,
	REMOVE_SOURCE,
	REMOVE_TARGET,
} from '../actions/registry'

const NONE = []
const ALL = []

export default function dirtyHandlerIds(state = NONE, action, dragOperation) {
	switch (action.type) {
		case HOVER:
			break
		case ADD_SOURCE:
		case ADD_TARGET:
		case REMOVE_TARGET:
		case REMOVE_SOURCE:
			return NONE
		case BEGIN_DRAG:
		case PUBLISH_DRAG_SOURCE:
		case END_DRAG:
		case DROP:
		default:
			return ALL
	}

	const { targetIds } = action
	const { targetIds: prevTargetIds } = dragOperation
	const result = xor(targetIds, prevTargetIds)

	let didChange = false
	if (result.length === 0) {
		for (let i = 0; i < targetIds.length; i++) {
			if (targetIds[i] !== prevTargetIds[i]) {
				didChange = true
				break
			}
		}
	} else {
		didChange = true
	}

	if (!didChange) {
		return NONE
	}

	const prevInnermostTargetId = prevTargetIds[prevTargetIds.length - 1]
	const innermostTargetId = targetIds[targetIds.length - 1]

	if (prevInnermostTargetId !== innermostTargetId) {
		if (prevInnermostTargetId) {
			result.push(prevInnermostTargetId)
		}
		if (innermostTargetId) {
			result.push(innermostTargetId)
		}
	}

	return result
}

export function areDirty(state, handlerIds) {
	if (state === NONE) {
		return false
	}

	if (state === ALL || typeof handlerIds === 'undefined') {
		return true
	}

	return intersection(handlerIds, state).length > 0
}
