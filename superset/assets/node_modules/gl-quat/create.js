module.exports = create

/**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */
function create () {
  var out = new Float32Array(4)
  out[0] = 0
  out[1] = 0
  out[2] = 0
  out[3] = 1
  return out
}
