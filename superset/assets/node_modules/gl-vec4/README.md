# gl-vec4

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Part of a fork of [@toji](http://github.com/toji)'s
[gl-matrix](http://github.com/toji/gl-matrix) split into smaller pieces: this
package contains `glMatrix.vec4`.

## Usage

[![NPM](https://nodei.co/npm/gl-vec4.png)](https://nodei.co/npm/gl-vec4/)

### `vec4 = require('gl-vec4')`

Will load all of the module's functionality and expose it on a single
object. Note that any of the methods may also be required directly
from their files.

For example, the following are equivalent:

``` javascript
var scale = require('gl-vec4').scale
var scale = require('gl-vec4/scale')
```

## API

  - [add()](#addoutvec4-avec4-bvec4)
  - [clone()](#cloneavec4)
  - [copy()](#copyoutvec4-avec4)
  - [create()](#create)
  - [distance()](#distanceavec4-bvec4)
  - [divide()](#divideoutvec4-avec4-bvec4)
  - [dot()](#dotavec4-bvec4)
  - [fromValues()](#fromvaluesxnumber-ynumber-znumber-wnumber)
  - [inverse()](#inverseoutvec4-avec4)
  - [length()](#lengthavec4)
  - [lerp()](#lerpoutvec4-avec4-bvec4-tnumber)
  - [max()](#maxoutvec4-avec4-bvec4)
  - [min()](#minoutvec4-avec4-bvec4)
  - [multiply()](#multiplyoutvec4-avec4-bvec4)
  - [negate()](#negateoutvec4-avec4)
  - [normalize()](#normalizeoutvec4-avec4)
  - [random()](#randomoutvec4-scalenumber)
  - [scale()](#scaleoutvec4-avec4-bnumber)
  - [scaleAndAdd()](#scaleandaddoutvec4-avec4-bvec4-scalenumber)
  - [set()](#setoutvec4-xnumber-ynumber-znumber-wnumber)
  - [squaredDistance()](#squareddistanceavec4-bvec4)
  - [squaredLength()](#squaredlengthavec4)
  - [subtract()](#subtractoutvec4-avec4-bvec4)
  - [transformMat4()](#transformmat4outvec4-avec4-mmat4)
  - [transformQuat()](#transformquatoutvec4-avec4-qquat)

## add(out:vec4, a:vec4, b:vec4)

  Adds two vec4's

## clone(a:vec4)

  Creates a new vec4 initialized with values from an existing vector

## copy(out:vec4, a:vec4)

  Copy the values from one vec4 to another

## create()

  Creates a new, empty vec4

## distance(a:vec4, b:vec4)

  Calculates the euclidian distance between two vec4's

## divide(out:vec4, a:vec4, b:vec4)

  Divides two vec4's

## dot(a:vec4, b:vec4)

  Calculates the dot product of two vec4's

## fromValues(x:Number, y:Number, z:Number, w:Number)

  Creates a new vec4 initialized with the given values

## inverse(out:vec4, a:vec4)

  Returns the inverse of the components of a vec4

## length(a:vec4)

  Calculates the length of a vec4

## lerp(out:vec4, a:vec4, b:vec4, t:Number)

  Performs a linear interpolation between two vec4's

## max(out:vec4, a:vec4, b:vec4)

  Returns the maximum of two vec4's

## min(out:vec4, a:vec4, b:vec4)

  Returns the minimum of two vec4's

## multiply(out:vec4, a:vec4, b:vec4)

  Multiplies two vec4's

## negate(out:vec4, a:vec4)

  Negates the components of a vec4

## normalize(out:vec4, a:vec4)

  Normalize a vec4

## random(out:vec4, [scale]:Number)

  Generates a random vector with the given scale

## scale(out:vec4, a:vec4, b:Number)

  Scales a vec4 by a scalar number

## scaleAndAdd(out:vec4, a:vec4, b:vec4, scale:Number)

  Adds two vec4's after scaling the second operand by a scalar value

## set(out:vec4, x:Number, y:Number, z:Number, w:Number)

  Set the components of a vec4 to the given values

## squaredDistance(a:vec4, b:vec4)

  Calculates the squared euclidian distance between two vec4's

## squaredLength(a:vec4)

  Calculates the squared length of a vec4

## subtract(out:vec4, a:vec4, b:vec4)

  Subtracts vector b from vector a

## transformMat4(out:vec4, a:vec4, m:mat4)

  Transforms the vec4 with a mat4.

## transformQuat(out:vec4, a:vec4, q:quat)

  Transforms the vec4 with a quat

## License

MIT. See [LICENSE.md](http://github.com/stackgl/gl-vec4/blob/master/LICENSE.md) for details.
