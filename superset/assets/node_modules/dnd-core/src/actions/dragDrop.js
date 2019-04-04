import invariant from 'invariant'
import isArray from 'lodash/isArray'
import isObject from 'lodash/isObject'
import matchesType from '../utils/matchesType'

export const BEGIN_DRAG = 'dnd-core/BEGIN_DRAG'
export const PUBLISH_DRAG_SOURCE = 'dnd-core/PUBLISH_DRAG_SOURCE'
export const HOVER = 'dnd-core/HOVER'
export const DROP = 'dnd-core/DROP'
export const END_DRAG = 'dnd-core/END_DRAG'

export function beginDrag(
	sourceIds,
	options = { publishSource: true, clientOffset: null },
) {
	const { publishSource, clientOffset, getSourceClientOffset } = options
	invariant(isArray(sourceIds), 'Expected sourceIds to be an array.')

	const monitor = this.getMonitor()
	const registry = this.getRegistry()
	invariant(!monitor.isDragging(), 'Cannot call beginDrag while dragging.')

	for (let i = 0; i < sourceIds.length; i++) {
		invariant(
			registry.getSource(sourceIds[i]),
			'Expected sourceIds to be registered.',
		)
	}

	let sourceId = null
	for (let i = sourceIds.length - 1; i >= 0; i--) {
		if (monitor.canDragSource(sourceIds[i])) {
			sourceId = sourceIds[i]
			break
		}
	}
	if (sourceId === null) {
		return
	}

	let sourceClientOffset = null
	if (clientOffset) {
		invariant(
			typeof getSourceClientOffset === 'function',
			'When clientOffset is provided, getSourceClientOffset must be a function.',
		)
		sourceClientOffset = getSourceClientOffset(sourceId)
	}

	const source = registry.getSource(sourceId)
	const item = source.beginDrag(monitor, sourceId)
	invariant(isObject(item), 'Item must be an object.')

	registry.pinSource(sourceId)

	const itemType = registry.getSourceType(sourceId)
	return {
		type: BEGIN_DRAG,
		itemType,
		item,
		sourceId,
		clientOffset,
		sourceClientOffset,
		isSourcePublic: publishSource,
	}
}

export function publishDragSource() {
	const monitor = this.getMonitor()
	if (!monitor.isDragging()) {
		return
	}

	return { type: PUBLISH_DRAG_SOURCE }
}

export function hover(targetIdsArg, { clientOffset = null } = {}) {
	invariant(isArray(targetIdsArg), 'Expected targetIds to be an array.')
	const targetIds = targetIdsArg.slice(0)

	const monitor = this.getMonitor()
	const registry = this.getRegistry()
	invariant(monitor.isDragging(), 'Cannot call hover while not dragging.')
	invariant(!monitor.didDrop(), 'Cannot call hover after drop.')

	// First check invariants.
	for (let i = 0; i < targetIds.length; i++) {
		const targetId = targetIds[i]
		invariant(
			targetIds.lastIndexOf(targetId) === i,
			'Expected targetIds to be unique in the passed array.',
		)

		const target = registry.getTarget(targetId)
		invariant(target, 'Expected targetIds to be registered.')
	}

	const draggedItemType = monitor.getItemType()

	// Remove those targetIds that don't match the targetType.  This
	// fixes shallow isOver which would only be non-shallow because of
	// non-matching targets.
	for (let i = targetIds.length - 1; i >= 0; i--) {
		const targetId = targetIds[i]
		const targetType = registry.getTargetType(targetId)
		if (!matchesType(targetType, draggedItemType)) {
			targetIds.splice(i, 1)
		}
	}

	// Finally call hover on all matching targets.
	for (let i = 0; i < targetIds.length; i++) {
		const targetId = targetIds[i]
		const target = registry.getTarget(targetId)
		target.hover(monitor, targetId)
	}

	return {
		type: HOVER,
		targetIds,
		clientOffset,
	}
}

export function drop(options = {}) {
	const monitor = this.getMonitor()
	const registry = this.getRegistry()
	invariant(monitor.isDragging(), 'Cannot call drop while not dragging.')
	invariant(
		!monitor.didDrop(),
		'Cannot call drop twice during one drag operation.',
	)

	const targetIds = monitor
		.getTargetIds()
		.filter(monitor.canDropOnTarget, monitor)

	targetIds.reverse()
	targetIds.forEach((targetId, index) => {
		const target = registry.getTarget(targetId)

		let dropResult = target.drop(monitor, targetId)
		invariant(
			typeof dropResult === 'undefined' || isObject(dropResult),
			'Drop result must either be an object or undefined.',
		)
		if (typeof dropResult === 'undefined') {
			dropResult = index === 0 ? {} : monitor.getDropResult()
		}

		this.store.dispatch({
			type: DROP,
			dropResult: {
				...options,
				...dropResult,
			},
		})
	})
}

export function endDrag() {
	const monitor = this.getMonitor()
	const registry = this.getRegistry()
	invariant(monitor.isDragging(), 'Cannot call endDrag while not dragging.')

	const sourceId = monitor.getSourceId()
	const source = registry.getSource(sourceId, true)
	source.endDrag(monitor, sourceId)

	registry.unpinSource()

	return { type: END_DRAG }
}
