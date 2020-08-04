module.exports = thunkyp

function thunkyp (fn) {
  let running = null

  return ready

  function ready () {
    if (running) return running
    const p = fn()
    if (!(p instanceof Promise)) running = Promise.resolve(p)
    else running = p
    running.catch(onerror)
    return running
  }

  function onerror () {
    running = null
  }
}
