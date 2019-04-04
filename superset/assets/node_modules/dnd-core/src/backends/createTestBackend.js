import noop from 'lodash/noop'

class TestBackend {
	constructor(manager) {
		this.actions = manager.getActions()
	}

	setup() {
		this.didCallSetup = true
	}

	teardown() {
		this.didCallTeardown = true
	}

	connectDragSource() {
		return noop
	}

	connectDragPreview() {
		return noop
	}

	connectDropTarget() {
		return noop
	}

	simulateBeginDrag(sourceIds, options) {
		this.actions.beginDrag(sourceIds, options)
	}

	simulatePublishDragSource() {
		this.actions.publishDragSource()
	}

	simulateHover(targetIds, options) {
		this.actions.hover(targetIds, options)
	}

	simulateDrop() {
		this.actions.drop()
	}

	simulateEndDrag() {
		this.actions.endDrag()
	}
}

export default function createBackend(manager) {
	return new TestBackend(manager)
}
