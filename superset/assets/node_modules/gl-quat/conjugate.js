module.exports = conjugate

/**
 * Calculates the conjugate of a quat
 * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate conjugate of
 * @returns {quat} out
 */
function conjugate (out, a) {
  out[0] = -a[0]
  out[1] = -a[1]
  out[2] = -a[2]
  out[3] = a[3]
  return out
}
