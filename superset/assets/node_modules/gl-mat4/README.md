# gl-mat4 [![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Part of a fork of [@toji](http://github.com/toji)'s
[gl-matrix](http://github.com/toji/gl-matrix) split into smaller pieces: this
package contains `glMatrix.mat4`.

## Usage

[![NPM](https://nodei.co/npm/gl-mat4.png)](https://nodei.co/npm/gl-mat4/)

### `mat4 = require('gl-mat4')`

Will load all of the module's functionality and expose it on a single
object. Note that any of the methods may also be required directly
from their files.

For example, the following are equivalent:

``` javascript
var scale = require('gl-mat4').scale
var scale = require('gl-mat4/scale')
```

## API

  - [adjoint()](#adjointoutmat4-amat4)
  - [clone()](#cloneamat4)
  - [copy()](#copyoutmat4-amat4)
  - [create()](#create)
  - [determinant()](#determinantamat4)
  - [fromQuat()](#fromquatoutmat4-qquat4)
  - [fromRotation()](#fromrotationoutmat4-radnumber-axisvec3)
  - [fromRotationTranslation()](#fromrotationtranslationoutmat4-qquat4-vvec3)
  - [fromScaling()](#fromscalingoutmat4-vvec3)
  - [fromTranslation()](#fromtranslationoutmat4-vvec3)
  - [fromXRotation()](#fromxrotationoutmat4-radnumber)
  - [fromYRotation()](#fromyrotationoutmat4-radnumber)
  - [fromZRotation()](#fromzrotationoutmat4-radnumber)
  - [frustum()](#frustumoutmat4-leftnumber-rightnumber-bottomnumber-topnumber-nearnumber-farnumber)
  - [identity()](#identityoutmat4)
  - [invert()](#invertoutmat4-amat4)
  - [lookAt()](#lookatoutmat4-eyevec3-centervec3-upvec3)
  - [multiply()](#multiplyoutmat4-amat4-bmat4)
  - [ortho()](#orthooutmat4-leftnumber-rightnumber-bottomnumber-topnumber-nearnumber-farnumber)
  - [perspective()](#perspectiveoutmat4-fovynumber-aspectnumber-nearnumber-farnumber)
  - [perspectiveFromFieldOfView()](#perspectivefromfieldofviewoutmat4-fovobject-nearnumber-farnumber)
  - [rotate()](#rotateoutmat4-amat4-radnumber-axisvec3)
  - [rotateX()](#rotatexoutmat4-amat4-radnumber)
  - [rotateY()](#rotateyoutmat4-amat4-radnumber)
  - [rotateZ()](#rotatezoutmat4-amat4-radnumber)
  - [scale()](#scaleoutmat4-amat4-vvec3)
  - [str()](#strmatmat4)
  - [translate()](#translateoutmat4-amat4-vvec3)
  - [transpose()](#transposeoutmat4-amat4)

## adjoint(out:mat4, a:mat4)

  Calculates the adjugate of a mat4

## clone(a:mat4)

  Creates a new mat4 initialized with values from an existing matrix

## copy(out:mat4, a:mat4)

  Copy the values from one mat4 to another

## create()

  Creates a new identity mat4

## determinant(a:mat4)

  Calculates the determinant of a mat4

## fromQuat(out:mat4, q:quat4)

  Creates a matrix from a quaternion rotation.

## fromRotation(out:mat4, rad:number, axis:vec3)

  Creates a matrix from a given angle around a given axis
  This is equivalent to (but much faster than):

```js
  mat4.identity(dest);
  mat4.rotate(dest, dest, rad, axis);
```

## fromRotationTranslation(out:mat4, q:quat4, v:vec3)

  Creates a matrix from a quaternion rotation and vector translation. This is equivalent to (but much faster than):
  
```js
  mat4.identity(dest);
  mat4.translate(dest, vec);
  var quatMat = mat4.create();
  quat4.toMat4(quat, quatMat);
  mat4.multiply(dest, quatMat);
```

## fromScaling(out:mat4, v:vec3)
  Creates a matrix from a vector scaling. This is equivalent to (but much faster than):
 
```js
  mat4.identity(dest);
  mat4.translate(dest, dest, vec);
```

## fromTranslation(out:mat4, v:vec3)
  Creates a matrix from a vector translation. This is equivalent to (but much faster than):
 
```js
  mat4.identity(dest);
  mat4.translate(dest, dest, vec);
```

## fromTranslation(out:mat4, v:vec3)
  Creates a matrix from a vector translation
  This is equivalent to (but much faster than):
 
```js
  mat4.identity(dest);
  mat4.translate(dest, dest, vec);
```

## fromXRotation(out:mat4, rad:Number)

  Creates a matrix from the given angle around the X axis
  This is equivalent to (but much faster than):
  
```js
  mat4.identity(dest)
  mat4.rotateX(dest, dest, rad)
```

## fromYRotation(out:mat4, rad:Number)

  Creates a matrix from the given angle around the Y axis
  This is equivalent to (but much faster than):
  
```js
  mat4.identity(dest)
  mat4.rotateY(dest, dest, rad)
```

## fromZRotation(out:mat4, rad:Number)

  Creates a matrix from the given angle around the Z axis
  This is equivalent to (but much faster than):
  
```js
  mat4.identity(dest)
  mat4.rotateZ(dest, dest, rad)
```

## frustum(out:mat4, left:Number, right:Number, bottom:Number, top:Number, near:Number, far:Number)

  Generates a frustum matrix with the given bounds

## identity(out:mat4)

  Set a mat4 to the identity matrix

## invert(out:mat4, a:mat4)

  Inverts a mat4

## lookAt(out:mat4, eye:vec3, center:vec3, up:vec3)

  Generates a look-at matrix with the given eye position, focal point, and up axis

## multiply(out:mat4, a:mat4, b:mat4)

  Multiplies two mat4's

## ortho(out:mat4, left:number, right:number, bottom:number, top:number, near:number, far:number)

  Generates a orthogonal projection matrix with the given bounds

## perspective(out:mat4, fovy:number, aspect:number, near:number, far:number)

  Generates a perspective projection matrix with the given bounds

## perspectiveFromFieldOfView(out:mat4, fov:object, near:number, far:number)

  Generates a perspective projection matrix with the given field of view.

## rotate(out:mat4, a:mat4, rad:Number, axis:vec3)

  Rotates a mat4 by the given angle

## rotateX(out:mat4, a:mat4, rad:Number)

  Rotates a matrix by the given angle around the X axis

## rotateY(out:mat4, a:mat4, rad:Number)

  Rotates a matrix by the given angle around the Y axis

## rotateZ(out:mat4, a:mat4, rad:Number)

  Rotates a matrix by the given angle around the Z axis

## scale(out:mat4, a:mat4, v:vec3)

  Scales the mat4 by the dimensions in the given vec3

## str(mat:mat4)

  Returns a string representation of a mat4

## translate(out:mat4, a:mat4, v:vec3)

  Translate a mat4 by the given vector

## transpose(out:mat4, a:mat4)

  Transpose the values of a mat4

## License

[zlib](http://en.wikipedia.org/wiki/Zlib_License). See [LICENSE.md](https://github.com/stackgl/gl-mat4/blob/master/LICENSE.md) for details.
