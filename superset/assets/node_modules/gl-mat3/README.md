# gl-mat3 [![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Part of a fork of [@toji](http://github.com/toji)'s
[gl-matrix](http://github.com/toji/gl-matrix) split into smaller pieces: this
package contains `glMatrix.mat3`.

## Usage

[![NPM](https://nodei.co/npm/gl-mat3.png)](https://nodei.co/npm/gl-mat3/)

### `mat3 = require('gl-mat3')`

Will load all of the module's functionality and expose it on a single
object. Note that any of the methods may also be required directly
from their files.

For example, the following are equivalent:

``` javascript
var scale = require('gl-mat3').scale
var scale = require('gl-mat3/scale')
```

## API

  - [mat3.adjoint()](#mat3adjointoutmat3amat3)
  - [mat3.clone()](#mat3cloneamat3)
  - [mat3.copy()](#mat3copyoutmat3amat3)
  - [mat3.create()](#mat3create)
  - [mat3.determinant()](#mat3determinantamat3)
  - [mat3.frob()](#mat3frobamat3)
  - [mat3.fromMat2d()](#mat3frommat2doutmat3amat2d)
  - [mat3.fromMat4()](#mat3frommat4outmat3amat4)
  - [mat3.fromQuat()](#mat3fromquatoutmat3qquat)
  - [mat3.identity()](#mat3identityoutmat3)
  - [mat3.invert()](#mat3invertoutmat3amat3)
  - [mat3.multiply()](#mat3multiplyoutmat3amat3bmat3)
  - [mat3.normalFromMat4()](#mat3normalfrommat4outmat3amat4)
  - [mat3.rotate()](#mat3rotateoutmat3amat3radnumber)
  - [mat3.scale()](#mat3scaleoutmat3amat3vvec2)
  - [mat3.str()](#mat3strmatmat3)
  - [mat3.translate()](#mat3translateoutmat3amat3vvec2)
  - [mat3.transpose()](#mat3transposeoutmat3amat3)

## mat3.adjoint(out:mat3, a:mat3)

  Calculates the adjugate of a mat3

## mat3.clone(a:mat3)

  Creates a new mat3 initialized with values from an existing matrix

## mat3.copy(out:mat3, a:mat3)

  Copy the values from one mat3 to another

## mat3.create()

  Creates a new identity mat3

## mat3.determinant(a:mat3)

  Calculates the determinant of a mat3

## mat3.frob(a:mat3)

  Returns Frobenius norm of a mat3

## mat3.fromMat2d(out:mat3, a:mat2d)

  Copies the values from a mat2d into a mat3

## mat3.fromMat4(out:mat3, a:mat4)

  Copies the upper-left 3x3 values into the given mat3.

## mat3.fromQuat(out:mat3, q:quat)

  Calculates a 3x3 matrix from the given quaternion

## mat3.identity(out:mat3)

  Set a mat3 to the identity matrix

## mat3.invert(out:mat3, a:mat3)

  Inverts a mat3

## mat3.multiply(out:mat3, a:mat3, b:mat3)

  Multiplies two mat3's

## mat3.normalFromMat4(out:mat3, a:mat4)

  Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix

## mat3.rotate(out:mat3, a:mat3, rad:Number)

  Rotates a mat3 by the given angle

## mat3.scale(out:mat3, a:mat3, v:vec2)

  Scales the mat3 by the dimensions in the given vec2

## mat3.str(mat:mat3)

  Returns a string representation of a mat3

## mat3.translate(out:mat3, a:mat3, v:vec2)

  Translate a mat3 by the given vector

## mat3.transpose(out:mat3, a:mat3)

  Transpose the values of a mat3

## License

[zlib](http://en.wikipedia.org/wiki/Zlib_License). See [LICENSE.md](http://github.com/hughsk/gl-mat3/blob/master/LICENSE.md) for details.
