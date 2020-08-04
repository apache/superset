glMatrix
=======================
[![NPM Version](https://img.shields.io/npm/v/gl-matrix.svg)](https://www.npmjs.com/package/gl-matrix)
[![Build Status](https://travis-ci.org/toji/gl-matrix.svg)](https://travis-ci.org/toji/gl-matrix)

Javascript has evolved into a language capable of handling realtime 3D graphics, 
via WebGL, and computationally intensive tasks such as physics simulations.
These types of applications demand high performance vector and matrix math,
which is something that Javascript doesn't provide by default.
glMatrix to the rescue!

glMatrix is designed to perform vector and matrix operations stupidly fast! By
hand-tuning each function for maximum performance and encouraging efficient
usage patterns through API conventions, glMatrix will help you get the most out
of your browsers Javascript engine.

Learn More
----------------------
For documentation and news, visit the [glMatrix Homepage](http://glmatrix.net/)

For a tutorial, see [the "introducing glMatrix" section of _Introduction to Computer Graphics_ by David J. Eck](http://math.hws.edu/graphicsbook/c7/s1.html#webgl3d.1.2)

For a babel plugin to make writing the API nicer, see [babel-plugin-transfrom-gl-matrix](https://github.com/akira-cn/babel-plugin-transform-gl-matrix)

Regarding the current performance in modern web browsers, calling `glMatrix.setMatrixArrayType(Array)` to use normal arrays instead of Float32Arrays can greatly increase the performance.

Contributing Guidelines
----------------------
See [CONTRIBUTING.md](./CONTRIBUTING.md)

Building
----------------------
See [BUILDING.md](./BUILDING.md)
