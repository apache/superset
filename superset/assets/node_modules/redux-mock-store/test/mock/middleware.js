export default spy => store => next => action => {
  spy()
  return next(action)
}
