import HTML5Backend from './HTML5Backend'
import getEmptyImage from './getEmptyImage'
import * as NativeTypes from './NativeTypes'

export { NativeTypes, getEmptyImage }

export default function createHTML5Backend(manager) {
	return new HTML5Backend(manager)
}
