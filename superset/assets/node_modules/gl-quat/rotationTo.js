var vecDot = require('gl-vec3/dot')
var vecCross = require('gl-vec3/cross')
var vecLength = require('gl-vec3/length')
var vecNormalize = require('gl-vec3/normalize')

var quatNormalize = require('./normalize')
var quatAxisAngle = require('./setAxisAngle')

module.exports = rotationTo

var tmpvec3 = [0, 0, 0]
var xUnitVec3 = [1, 0, 0]
var yUnitVec3 = [0, 1, 0]

/**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {vec3} a the initial vector
 * @param {vec3} b the destination vector
 * @returns {quat} out
 */
function rotationTo (out, a, b) {
  var dot = vecDot(a, b)
  if (dot < -0.999999) {
    vecCross(tmpvec3, xUnitVec3, a)
    if (vecLength(tmpvec3) < 0.000001) {
      vecCross(tmpvec3, yUnitVec3, a)
    }
    vecNormalize(tmpvec3, tmpvec3)
    quatAxisAngle(out, tmpvec3, Math.PI)
    return out
  } else if (dot > 0.999999) {
    out[0] = 0
    out[1] = 0
    out[2] = 0
    out[3] = 1
    return out
  } else {
    vecCross(tmpvec3, a, b)
    out[0] = tmpvec3[0]
    out[1] = tmpvec3[1]
    out[2] = tmpvec3[2]
    out[3] = 1 + dot
    return quatNormalize(out, out)
  }
}
