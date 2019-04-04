import { BEGIN_DRAG, HOVER, END_DRAG, DROP } from '../actions/dragDrop'

const initialState = {
	initialSourceClientOffset: null,
	initialClientOffset: null,
	clientOffset: null,
}

function areOffsetsEqual(offsetA, offsetB) {
	if (offsetA === offsetB) {
		return true
	}
	return (
		offsetA && offsetB && offsetA.x === offsetB.x && offsetA.y === offsetB.y
	)
}

export default function dragOffset(state = initialState, action) {
	switch (action.type) {
		case BEGIN_DRAG:
			return {
				initialSourceClientOffset: action.sourceClientOffset,
				initialClientOffset: action.clientOffset,
				clientOffset: action.clientOffset,
			}
		case HOVER:
			if (areOffsetsEqual(state.clientOffset, action.clientOffset)) {
				return state
			}
			return {
				...state,
				clientOffset: action.clientOffset,
			}
		case END_DRAG:
		case DROP:
			return initialState
		default:
			return state
	}
}

export function getSourceClientOffset(state) {
	const { clientOffset, initialClientOffset, initialSourceClientOffset } = state
	if (!clientOffset || !initialClientOffset || !initialSourceClientOffset) {
		return null
	}
	return {
		x: clientOffset.x + initialSourceClientOffset.x - initialClientOffset.x,
		y: clientOffset.y + initialSourceClientOffset.y - initialClientOffset.y,
	}
}

export function getDifferenceFromInitialOffset(state) {
	const { clientOffset, initialClientOffset } = state
	if (!clientOffset || !initialClientOffset) {
		return null
	}
	return {
		x: clientOffset.x - initialClientOffset.x,
		y: clientOffset.y - initialClientOffset.y,
	}
}
