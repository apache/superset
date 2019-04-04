import * as actions from '../actions/index.js'

const initialState = {
  x: 8,
  y: 50
}

export default function draggable (state = initialState, action) {
  switch (action.type) {
    case actions.DRAG:
      return {
        x: action.x,
        y: action.y
      }
    default:
      return state
  }
}
