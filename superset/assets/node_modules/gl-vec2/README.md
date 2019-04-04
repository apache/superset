# gl-vec2

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Part of a fork of [@toji](http://github.com/toji)'s
[gl-matrix](http://github.com/toji/gl-matrix) split into smaller pieces: this
package contains `glMatrix.vec2`.

## Usage

[![NPM](https://nodei.co/npm/gl-vec2.png)](https://nodei.co/npm/gl-vec2/)

### `vec2 = require('gl-vec2')`

Will load all of the module's functionality and expose it on a single
object. Note that any of the methods may also be required directly
from their files.

For example, the following are equivalent:

``` javascript
var scale = require('gl-vec2').scale
var scale = require('gl-vec2/scale')
```

## API

  - [add()](#addoutvec2-avec2-bvec2)
  - [ceil()](#ceiloutvec2-avec2)
  - [clone()](#cloneavec2)
  - [copy()](#copyoutvec2-avec2)
  - [create()](#create)
  - [cross()](#crossoutvec3-avec2-bvec2)
  - [distance()](#distanceavec2-bvec2)
  - [dist()](#distanceavec2-bvec2)
  - [divide()](#divideoutvec2-avec2-bvec2)
  - [div()](#divideoutvec2-avec2-bvec2)
  - [dot()](#dotavec2-bvec2)
  - [equals()](#equalsavec2-bvec2)
  - [exactEquals()](#exactequalsavec2-bvec2)
  - [floor()](#flooroutvec2-avec2)
  - [forEach()](#foreachaarray-stridenumber-offsetnumber-countnumber-fnfunction-argobject)
  - [fromValues()](#fromvaluesxnumber-ynumber)
  - [inverse()](#inverseoutvec2-avec2)
  - [length()](#lengthavec2)
  - [len()](#lengthavec2)
  - [lerp()](#lerpoutvec2-avec2-bvec2-tnumber)
  - [limit()](#limitoutvec2-avec2-maxnumber)
  - [max()](#maxoutvec2-avec2-bvec2)
  - [min()](#minoutvec2-avec2-bvec2)
  - [multiply()](#multiplyoutvec2-avec2-bvec2)
  - [mul()](#multiplyoutvec2-avec2-bvec2)
  - [negate()](#negateoutvec2-avec2)
  - [normalize()](#normalizeoutvec2-avec2)
  - [random()](#randomoutvec2-scalenumber)
  - [rotate()](#rotateoutvec2-avec2-anglenumber)
  - [round()](#roundoutvec2-avec2)
  - [scale()](#scaleoutvec2-avec2-bnumber)
  - [scaleAndAdd()](#scaleandaddoutvec2-avec2-bvec2-scalenumber)
  - [set()](#setoutvec2-xnumber-ynumber)
  - [squaredDistance()](#squareddistanceavec2-bvec2)
  - [sqrDist()](#squareddistanceavec2-bvec2)
  - [squaredLength()](#squaredlengthavec2)
  - [sqrLen()](#squaredlengthavec2)
  - [subtract()](#subtractoutvec2-avec2-bvec2)
  - [sub()](#subtractoutvec2-avec2-bvec2)
  - [transformMat2()](#transformmat2outvec2-avec2-mmat2)
  - [transformMat2d()](#transformmat2doutvec2-avec2-mmat2d)
  - [transformMat3()](#transformmat3outvec2-avec2-mmat3)
  - [transformMat4()](#transformmat4outvec2-avec2-mmat4)

## add(out:vec2, a:vec2, b:vec2)

  Adds two vec2's

## ceil(out:vec2, a:vec2)

  `Math.ceil` the components of a vec2

## clone(a:vec2)

  Creates a new vec2 initialized with values from an existing vector

## copy(out:vec2, a:vec2)

  Copy the values from one vec2 to another

## create()

  Creates a new, empty vec2

## cross(out:vec3, a:vec2, b:vec2)

  Computes the cross product of two vec2's
  Note that the cross product must by definition produce a 3D vector

## distance(a:vec2, b:vec2)

  Calculates the euclidian distance between two vec2's. Aliased as `dist`.

## divide(out:vec2, a:vec2, b:vec2)

  Divides two vec2's. Aliased as `div`.

## dot(a:vec2, b:vec2)

  Calculates the dot product of two vec2's

## equals(a:vec2, b:vec2)

  Returns whether or not the vectors have approximately the same elements in the same position.

## exactEquals(a:vec2, b:vec2)

  Returns whether or not the vectors exactly have the same elements in the same position (when compared with ===)

## floor(out:vec2, a:vec2)

  `Math.floor` the components of a vec2

## forEach(a:Array, stride:Number, offset:Number, count:Number, fn:Function, [arg]:Object)

  Perform some operation over an array of vec2s.

## fromValues(x:Number, y:Number)

  Creates a new vec2 initialized with the given values

## inverse(out:vec2, a:vec2)

  Returns the inverse of the components of a vec2

## length(a:vec2)

  Calculates the length of a vec2. Aliased as `len`.

## lerp(out:vec2, a:vec2, b:vec2, t:Number)

  Performs a linear interpolation between two vec2's

## limit(out:vec2, a:vec2, max:Number)

  Limit the magnitude of this vector to the value used for the `max` parameter

## max(out:vec2, a:vec2, b:vec2)

  Returns the maximum of two vec2's

## min(out:vec2, a:vec2, b:vec2)

  Returns the minimum of two vec2's

## multiply(out:vec2, a:vec2, b:vec2)

  Multiplies two vec2's. Aliased as `mul`.

## negate(out:vec2, a:vec2)

  Negates the components of a vec2

## normalize(out:vec2, a:vec2)

  Normalize a vec2

## random(out:vec2, [scale]:Number)

  Generates a random vector with the given scale

## round(out:vec2, a:vec2)

  `Math.round` the components of a vec2

## rotate(out:vec2, a:vec2, angle:Number)

  Rotates a vec2 by an angle (in radians)

## scale(out:vec2, a:vec2, b:Number)

  Scales a vec2 by a scalar number

## scaleAndAdd(out:vec2, a:vec2, b:vec2, scale:Number)

  Adds two vec2's after scaling the second operand by a scalar value

## set(out:vec2, x:Number, y:Number)

  Set the components of a vec2 to the given values

## squaredDistance(a:vec2, b:vec2)

  Calculates the squared euclidian distance between two vec2's. Aliased as `sqrDist`.

## squaredLength(a:vec2)

  Calculates the squared length of a vec2. Aliased as `sqrLen`.

## subtract(out:vec2, a:vec2, b:vec2)

  Subtracts vector b from vector a. Aliased as `sub`.

## transformMat2(out:vec2, a:vec2, m:mat2)

  Transforms the vec2 with a mat2

## transformMat2d(out:vec2, a:vec2, m:mat2d)

  Transforms the vec2 with a mat2d

## transformMat3(out:vec2, a:vec2, m:mat3)

  Transforms the vec2 with a mat3
  3rd vector component is implicitly '1'

## transformMat4(out:vec2, a:vec2, m:mat4)

  Transforms the vec2 with a mat4
  3rd vector component is implicitly '0'
  4th vector component is implicitly '1'

## License

[zlib](http://en.wikipedia.org/wiki/Zlib_License). See [LICENSE.md](https://github.com/stackgl/gl-vec2/blob/master/LICENSE.md) for details.
