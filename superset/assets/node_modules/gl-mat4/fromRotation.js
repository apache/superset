module.exports = fromRotation

/**
 * Creates a matrix from a given angle around a given axis
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest)
 *     mat4.rotate(dest, dest, rad, axis)
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @param {vec3} axis the axis to rotate around
 * @returns {mat4} out
 */
function fromRotation(out, rad, axis) {
  var s, c, t
  var x = axis[0]
  var y = axis[1]
  var z = axis[2]
  var len = Math.sqrt(x * x + y * y + z * z)

  if (Math.abs(len) < 0.000001) {
    return null
  }

  len = 1 / len
  x *= len
  y *= len
  z *= len

  s = Math.sin(rad)
  c = Math.cos(rad)
  t = 1 - c

  // Perform rotation-specific matrix multiplication
  out[0] = x * x * t + c
  out[1] = y * x * t + z * s
  out[2] = z * x * t - y * s
  out[3] = 0
  out[4] = x * y * t - z * s
  out[5] = y * y * t + c
  out[6] = z * y * t + x * s
  out[7] = 0
  out[8] = x * z * t + y * s
  out[9] = y * z * t - x * s
  out[10] = z * z * t + c
  out[11] = 0
  out[12] = 0
  out[13] = 0
  out[14] = 0
  out[15] = 1
  return out
}
