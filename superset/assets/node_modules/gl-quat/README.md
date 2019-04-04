# gl-quat

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Part of a fork of [@toji](http://github.com/toji)'s
[gl-matrix](http://github.com/toji/gl-matrix) split into smaller pieces: this
package contains `glMatrix.quat`.

## Usage

[![NPM](https://nodei.co/npm/gl-quat.png)](https://nodei.co/npm/gl-quat/)

### `quat = require('gl-quat')`

Will load all of the module's functionality and expose it on a single
object. Note that any of the methods may also be required directly
from their files.

For example, the following are equivalent:

``` javascript
var slerp = require('gl-quat').slerp
var slerp = require('gl-quat/slerp')
```

## API

  - [add()](#addoutquat-aquat-bquat)
  - [calculateW()](#calculatewoutquat-aquat)
  - [copy()](#copyoutquat-aquat)
  - [conjugate()](#conjugateoutquat-aquat)
  - [copy()](#copyoutquat-aquat)
  - [create()](#create)
  - [dot()](#dotaquat-bquat)
  - [fromMat3()](#frommat3outquat-mmat3)
  - [fromValues()](#fromvaluesxnumber-ynumber-znumber-wnumber)
  - [identity()](#identityoutquat)
  - [invert()](#invertoutquat-aquat)
  - [length()](#lengthaquat)
  - [lerp()](#lerpoutquat-aquat-bquat-tnumber)
  - [multiply()](#multiplyoutquat-aquat-bquat)
  - [normalize()](#normalizeoutquat-aquat)
  - [rotateX()](#rotatexoutquat-aquat-radnumber)
  - [rotateY()](#rotateyoutquat-aquat-radnumber)
  - [rotateZ()](#rotatezoutquat-aquat-radnumber)
  - [rotationTo()](#rotationtooutquat-avec3-bvec3)
  - [scale()](#scaleoutquat-aquat-bnumber)
  - [set()](#setoutquat-xnumber-ynumber-znumber-wnumber)
  - [setAxes()](#setaxesviewvec3-rightvec3-upvec3)
  - [setAxisAngle()](#setaxisangleoutquat-axisvec3-radnumber)
  - [slerp()](#slerpoutquat-aquat-bquat-tnumber)
  - [sqlerp()](#sqlerpoutquat-aquat-bquat-cquat-dquat-tnumber)
  - [squaredLength()](#squaredlengthaquat)

## calculateW(out:quat, a:quat)

  Calculates the W component of a quat from the X, Y, and Z components.
  Assumes that quaternion is 1 unit in length.
  Any existing W component will be ignored.

## add(out:quat, a:quat, b:quat)

  Adds two quat's

## conjugate(out:quat, a:quat)

  Calculates the conjugate of a quat
  If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.

## copy(out:quat, a:quat)

  Copy the values from one quat to another

## create()

  Creates a new identity quat

## dot(a:quat, b:quat)

  Calculates the dot product of two quat's

## fromMat3(out:quat, m:mat3)

  Creates a quaternion from the given 3x3 rotation matrix.
  
  NOTE: The resultant quaternion is not normalized, so you should be sure
  to renormalize the quaternion yourself where necessary.

## fromValues(x:Number, y:Number, z:Number, w:Number)


## identity(out:quat)

  Set a quat to the identity quaternion

## invert(out:quat, a:quat)

  Calculates the inverse of a quat

## length(a:quat)

  Calculates the length of a quat

## lerp(out:quat, a:quat, b:quat, t:Number)

  Performs a linear interpolation between two quat's

## multiply(out:quat, a:quat, b:quat)

  Multiplies two quat's

## normalize(out:quat, a:quat)

  Normalize a quat

## rotateX(out:quat, a:quat, rad:number)

  Rotates a quaternion by the given angle about the X axis

## rotateY(out:quat, a:quat, rad:number)

  Rotates a quaternion by the given angle about the Y axis

## rotateZ(out:quat, a:quat, rad:number)

  Rotates a quaternion by the given angle about the Z axis

## rotationTo(out:quat, a:vec3, b:vec3)

  Sets a quaternion to represent the shortest rotation from one
  vector to another.
  
  Both vectors are assumed to be unit length.

## scale(out:quat, a:quat, b:Number)

  Scales a quat by a scalar number

## set(out:quat, x:Number, y:Number, z:Number, w:Number)

  Set the components of a quat to the given values

## setAxes(view:vec3, right:vec3, up:vec3)

  Sets the specified quaternion with values corresponding to the given
  axes. Each axis is a vec3 and is expected to be unit length and
  perpendicular to all other specified axes.

## setAxisAngle(out:quat, axis:vec3, rad:Number)

  Sets a quat from the given angle and rotation axis,
  then returns it.

## slerp(out:quat, a:quat, b:quat, t:Number)

  Performs a spherical linear interpolation between two quat

## sqlerp(out:quat, a:quat, b:quat, c:quat, d:quat, t:Number)

  Performs a spherical linear interpolation with two control points

## squaredLength(a:quat)

  Calculates the squared length of a quat

## License

MIT. See [LICENSE.md](http://github.com/stackgl/gl-quat/blob/master/LICENSE.md) for details.
