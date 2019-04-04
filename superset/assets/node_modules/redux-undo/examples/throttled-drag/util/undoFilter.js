const IGNORE_TIME = 250

let filter = true
export default function undoFilter (action, currState, prevState) {
  // other filters
  filter = actionsThrottlingFilter(action)
  return filter
}

// Store rapid actions of the same type at most once every x time.
let ignoreRapid = false
let prevActionType
function actionsThrottlingFilter (action) {
  if (action.type !== prevActionType) {
    ignoreRapid = false
    prevActionType = action.type
    return true
  }
  if (ignoreRapid) {
    return false
  }
  ignoreRapid = true
  setTimeout(() => {
    ignoreRapid = false
  }, IGNORE_TIME)
  return true
}
