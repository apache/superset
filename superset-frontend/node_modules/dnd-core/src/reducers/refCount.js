import {
	ADD_SOURCE,
	ADD_TARGET,
	REMOVE_SOURCE,
	REMOVE_TARGET,
} from '../actions/registry'

export default function refCount(state = 0, action) {
	switch (action.type) {
		case ADD_SOURCE:
		case ADD_TARGET:
			return state + 1
		case REMOVE_SOURCE:
		case REMOVE_TARGET:
			return state - 1
		default:
			return state
	}
}
