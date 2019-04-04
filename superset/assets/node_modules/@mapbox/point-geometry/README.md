# point-geometry

[![build status](https://secure.travis-ci.org/mapbox/point-geometry.png)](http://travis-ci.org/mapbox/point-geometry) [![Coverage Status](https://coveralls.io/repos/mapbox/point-geometry/badge.svg?branch=master)](https://coveralls.io/r/mapbox/point-geometry?branch=master)

a point geometry with transforms


### `Point(x, y)`

A standalone point geometry with useful accessor, comparison, and
modification methods.


### Parameters

| parameter | type   | description                                                                            |
| --------- | ------ | -------------------------------------------------------------------------------------- |
| `x`       | Number | the x-coordinate. this could be longitude or screen pixels, or any other sort of unit. |
| `y`       | Number | the y-coordinate. this could be latitude or screen pixels, or any other sort of unit.  |


### Example

```js
var point = new Point(-77, 38);
```


### `clone`

Clone this point, returning a new point that can be modified
without affecting the old one.


**Returns** `Point`, the clone


### `add(p)`

Add this point's x & y coordinates to another point,
yielding a new point.

### Parameters

| parameter | type  | description     |
| --------- | ----- | --------------- |
| `p`       | Point | the other point |



**Returns** `Point`, output point


### `sub(p)`

Subtract this point's x & y coordinates to from point,
yielding a new point.

### Parameters

| parameter | type  | description     |
| --------- | ----- | --------------- |
| `p`       | Point | the other point |



**Returns** `Point`, output point


### `multByPoint(p)`

Multiply this point's x & y coordinates by point,
yielding a new point.

### Parameters

| parameter | type  | description     |
| --------- | ----- | --------------- |
| `p`       | Point | the other point |



**Returns** `Point`, output point


### `divByPoint(p)`

Divide this point's x & y coordinates by point,
yielding a new point.

### Parameters

| parameter | type  | description     |
| --------- | ----- | --------------- |
| `p`       | Point | the other point |



**Returns** `Point`, output point


### `mult(k)`

Multiply this point's x & y coordinates by a factor,
yielding a new point.

### Parameters

| parameter | type  | description |
| --------- | ----- | ----------- |
| `k`       | Point | factor      |



**Returns** `Point`, output point


### `div(k)`

Divide this point's x & y coordinates by a factor,
yielding a new point.

### Parameters

| parameter | type  | description |
| --------- | ----- | ----------- |
| `k`       | Point | factor      |



**Returns** `Point`, output point


### `rotate(a)`

Rotate this point around the 0, 0 origin by an angle a,
given in radians

### Parameters

| parameter | type   | description                        |
| --------- | ------ | ---------------------------------- |
| `a`       | Number | angle to rotate around, in radians |



**Returns** `Point`, output point


### `rotateAround(a, p)`

Rotate this point around p point by an angle a,
given in radians

### Parameters

| parameter | type   | description                        |
| --------- | ------ | ---------------------------------- |
| `a`       | Number | angle to rotate around, in radians |
| `p`       | Point  | Point to rotate around             |



**Returns** `Point`, output point


### `matMult(m)`

Multiply this point by a 4x1 transformation matrix

### Parameters

| parameter | type              | description           |
| --------- | ----------------- | --------------------- |
| `m`       | Array\.\<Number\> | transformation matrix |



**Returns** `Point`, output point


### `unit`

Calculate this point but as a unit vector from 0, 0, meaning
that the distance from the resulting point to the 0, 0
coordinate will be equal to 1 and the angle from the resulting
point to the 0, 0 coordinate will be the same as before.


**Returns** `Point`, unit vector point


### `perp`

Compute a perpendicular point, where the new y coordinate
is the old x coordinate and the new x coordinate is the old y
coordinate multiplied by -1


**Returns** `Point`, perpendicular point


### `round`

Return a version of this point with the x & y coordinates
rounded to integers.


**Returns** `Point`, rounded point


### `mag`

Return the magitude of this point: this is the Euclidean
distance from the 0, 0 coordinate to this point's x and y
coordinates.


**Returns** `Number`, magnitude


### `equals(other)`

Judge whether this point is equal to another point, returning
true or false.

### Parameters

| parameter | type  | description     |
| --------- | ----- | --------------- |
| `other`   | Point | the other point |



**Returns** `boolean`, whether the points are equal


### `dist(p)`

Calculate the distance from this point to another point

### Parameters

| parameter | type  | description     |
| --------- | ----- | --------------- |
| `p`       | Point | the other point |



**Returns** `Number`, distance


### `distSqr(p)`

Calculate the distance from this point to another point,
without the square root step. Useful if you're comparing
relative distances.

### Parameters

| parameter | type  | description     |
| --------- | ----- | --------------- |
| `p`       | Point | the other point |



**Returns** `Number`, distance


### `angle`

Get the angle from the 0, 0 coordinate to this point, in radians
coordinates.


**Returns** `Number`, angle


### `angleTo(b)`

Get the angle from this point to another point, in radians

### Parameters

| parameter | type  | description     |
| --------- | ----- | --------------- |
| `b`       | Point | the other point |



**Returns** `Number`, angle


### `angleWith(b)`

Get the angle between this point and another point, in radians

### Parameters

| parameter | type  | description     |
| --------- | ----- | --------------- |
| `b`       | Point | the other point |



**Returns** `Number`, angle


### `angleWithSep(x, y)`

Find the angle of the two vectors, solving the formula for
the cross product a x b = |a||b|sin(θ) for θ.

### Parameters

| parameter | type   | description      |
| --------- | ------ | ---------------- |
| `x`       | Number | the x-coordinate |
| `y`       | Number | the y-coordinate |



**Returns** `Number`, the angle in radians


### `convert(a)`

Construct a point from an array if necessary, otherwise if the input
is already a Point, or an unknown type, return it unchanged

### Parameters

| parameter | type                     | description             |
| --------- | ------------------------ | ----------------------- |
| `a`       | Array\.\<Number\>\,Point | any kind of input value |


### Example

```js
// this
var point = Point.convert([0, 1]);
// is equivalent to
var point = new Point(0, 1);
```


**Returns** `Point`, constructed point, or passed-through value.

## Installation

Requires [nodejs](http://nodejs.org/).

```sh
$ npm install point-geometry
```

## Tests

```sh
$ npm test
```


