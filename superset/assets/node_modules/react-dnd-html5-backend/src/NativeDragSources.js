import * as NativeTypes from './NativeTypes'

function getDataFromDataTransfer(dataTransfer, typesToTry, defaultValue) {
	const result = typesToTry.reduce(
		(resultSoFar, typeToTry) => resultSoFar || dataTransfer.getData(typeToTry),
		null,
	)

	return result != null // eslint-disable-line eqeqeq
		? result
		: defaultValue
}

const nativeTypesConfig = {
	[NativeTypes.FILE]: {
		exposeProperty: 'files',
		matchesTypes: ['Files'],
		getData: dataTransfer => Array.prototype.slice.call(dataTransfer.files),
	},
	[NativeTypes.URL]: {
		exposeProperty: 'urls',
		matchesTypes: ['Url', 'text/uri-list'],
		getData: (dataTransfer, matchesTypes) =>
			getDataFromDataTransfer(dataTransfer, matchesTypes, '').split('\n'),
	},
	[NativeTypes.TEXT]: {
		exposeProperty: 'text',
		matchesTypes: ['Text', 'text/plain'],
		getData: (dataTransfer, matchesTypes) =>
			getDataFromDataTransfer(dataTransfer, matchesTypes, ''),
	},
}

export function createNativeDragSource(type) {
	const { exposeProperty, matchesTypes, getData } = nativeTypesConfig[type]

	return class NativeDragSource {
		constructor() {
			this.item = {
				get [exposeProperty]() {
					// eslint-disable-next-line no-console
					console.warn(
						`Browser doesn't allow reading "${exposeProperty}" until the drop event.`,
					)
					return null
				},
			}
		}

		mutateItemByReadingDataTransfer(dataTransfer) {
			delete this.item[exposeProperty]
			this.item[exposeProperty] = getData(dataTransfer, matchesTypes)
		}

		canDrag() {
			return true
		}

		beginDrag() {
			return this.item
		}

		isDragging(monitor, handle) {
			return handle === monitor.getSourceId()
		}

		endDrag() {}
	}
}

export function matchNativeItemType(dataTransfer) {
	const dataTransferTypes = Array.prototype.slice.call(dataTransfer.types || [])

	return (
		Object.keys(nativeTypesConfig).filter(nativeItemType => {
			const { matchesTypes } = nativeTypesConfig[nativeItemType]
			return matchesTypes.some(t => dataTransferTypes.indexOf(t) > -1)
		})[0] || null
	)
}
