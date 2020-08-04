# Matrices

Math.js supports multi dimensional matrices and arrays. Matrices can be
created, manipulated, and used in calculations. Both regular JavaScript
arrays as well as the matrix type implemented by math.js can be used
interchangeably in all relevant math.js functions. math.js supports both
dense and sparse matrices.


## Arrays and matrices

Math.js supports two types of matrices:

- `Array`, a regular JavaScript array. A multi dimensional array can be created
  by nesting arrays.
- `Matrix`, a matrix implementation by math.js. A `Matrix` is an object wrapped
  around a regular JavaScript `Array`, providing utility functions for easy
  matrix manipulation such as `subset`, `size`, `resize`, `clone`, and more.

In most cases, the type of matrix output from functions is determined by the
function input: An `Array` as input will return an `Array`, a `Matrix` as input
will return a `Matrix`. In case of mixed input, a `Matrix` is returned.
For functions where the type of output cannot be determined from the
input, the output is determined by the configuration option `matrix`,
which can be a string `'Matrix'` (default) or `'Array'`.

```js
// create an array and a matrix
var array = [[2, 0], [-1, 3]];                // Array
var matrix = math.matrix([[7, 1], [-2, 3]]);  // Matrix

// perform a calculation on an array and matrix
math.square(array);                           // Array,  [[4, 0], [1, 9]]
math.square(matrix);                          // Matrix, [[49, 1], [4, 9]]

// perform calculations with mixed array and matrix input
math.add(array, matrix);                      // Matrix, [[9, 1], [-3, 6]]
math.multiply(array, matrix);                 // Matrix, [[14, 2], [-13, 8]]

// create a matrix. Type of output of function ones is determined by the
// configuration option `matrix`
math.ones(2, 3);                              // Matrix, [[1, 1, 1], [1, 1, 1]]
```


## Creation

A matrix can be created from an array using the function `math.matrix`. The
provided array can contain nested arrays in order to create a multi-dimensional matrix. When called without arguments, an empty matrix will be
created.

```js
// create matrices
math.matrix();                          // Matrix, size [0]
math.matrix([0, 1, 2]);                 // Matrix, size [3]
math.matrix([[0, 1], [2, 3], [4, 5]]);  // Matrix, size [3, 2]
```

Math.js supports regular Arrays. Multiple dimensions can be created
by nesting Arrays in each other.

```js
// create arrays
[];                                     // Array, size [0]
[0, 1, 2] ;                             // Array, size [3]
[[0, 1], [2, 3], [4, 5]];               // Array, size [3, 2]
```

Matrices can contain different types of values: numbers, complex numbers,
units, or strings. Different types can be mixed together in a single matrix.

```js
// create a matrix with mixed types
var a = math.matrix([2.3, 'hello', math.complex(3, -4), math.unit('5.2 mm')]);
a.subset(math.index(1)); // 'hello'
```


There are a number of functions to create a matrix with a specific size and
content: `ones`, `zeros`, `eye`.

```js
// zeros creates a matrix filled with zeros
math.zeros(3);          // Matrix, size [3],    [0, 0, 0]
math.zeros(3, 2);       // Matrix, size [3, 2], [[0, 0], [0, 0], [0, 0]]
math.zeros(2, 2, 2);    // Matrix, size [2, 2, 2],
                        //   [[[0, 0], [0, 0]], [[0, 0], [0, 0]]]

// ones creates a matrix filled with ones
math.ones(3);                       // Matrix, size [3],    [1, 1, 1]
math.multiply(math.ones(2, 2), 5);  // Matrix, size [2, 2], [[5, 5], [5, 5]]

// eye creates an identity matrix
math.eye(3);     // Matrix, size [3, 3], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
math.eye(2, 3);  // Matrix, size [2, 3], [[1, 0, 0], [0, 1, 0]]
```


The functions `ones`, `zeros`, and `eye` also accept a single array
or matrix containing the dimensions for the matrix. When the input is an Array,
the functions will output an Array. When the input is a Matrix, the output will
be a Matrix. Note that in case of numbers as arguments, the output is
determined by the option `matrix` as discussed in section
[Arrays and matrices](#arrays-and-matrices).

```js
// Array as input gives Array as output
math.ones([2, 3]);              // Array,  size [3, 2], [[1, 1, 1], [1, 1, 1]]
math.ones(math.matrix([2, 3])); // Matrix, size [3, 2], [[1, 1, 1], [1, 1, 1]]
```

Ranges can be created using the function `range`. The function `range` is
called with parameters start and end, and optionally a parameter step.
The start of the range is included, the end of the range is excluded.

```js
math.range(0, 4);       // [0, 1, 2, 3]
math.range(0, 8, 2);    // [0, 2, 4, 6]
math.range(3, -1, -1);  // [3, 2, 1, 0]
```


## Calculations

All relevant functions of math.js support matrices and arrays.

```js
// perform a calculation on a matrix
var a = math.matrix([1, 4, 9, 16, 25]);   // Matrix, [1, 4, 9, 16, 25]
math.sqrt(a);                             // Matrix, [1, 2, 3, 4, 5]

// perform a calculation on an array
var b = [1, 2, 3, 4, 5];
math.factorial(b);                        // Array,  [1, 2, 6, 24, 120]

// multiply an array with a matrix
var c = [[2, 0], [-1, 3]];                // Array
var d = math.matrix([[7, 1], [-2, 3]]);   // Matrix
math.multiply(c, d);                      // Matrix, [[14, 2], [-13, 8]]

// add a number to a matrix
math.add(c, 2);                           // Array, [[4, 2], [1, 5]]

// calculate the determinant of a matrix
math.det(c);                              // 6
math.det(d);                              // 23
```


## Size and Dimensions

Math.js uses geometric dimensions:

- A scalar is zero-dimensional.
- A vector is one-dimensional.
- A matrix is two or multi-dimensional.

The size of a matrix can be calculated with the function `size`. Function `size`
returns a `Matrix` or `Array`, depending on the configuration option `matrix`.
Furthermore, matrices have a function `size` as well, which always returns
an Array.

```js
// get the size of a scalar
math.size(2.4);                               // Matrix, []
math.size(math.complex(3, 2));                // Matrix, []
math.size(math.unit('5.3 mm'));               // Matrix, []

// get the size of a one-dimensional matrix (a vector) and a string
math.size([0, 1, 2, 3]);                      // Array, [4]
math.size('hello world');                     // Matrix, [11]

// get the size of a two-dimensional matrix
var a = [[0, 1, 2, 3]];                       // Array
var b = math.matrix([[0, 1, 2], [3, 4, 5]]);  // Matrix
math.size(a);                                 // Array, [1, 4]
math.size(b);                                 // Matrix, [2, 3]

// matrices have a function size (always returns an Array)
b.size();                                     // Array, [2, 3]

// get the size of a multi-dimensional matrix
var c = [[[0, 1, 2], [3, 4, 5]], [[6, 7, 8], [9, 10, 11]]];
math.size(c);                                 // Array, [2, 2, 3]
```


## Resizing

Matrices can be resized using their `resize` function. This function is called
with an Array with the new size as the first argument, and accepts an optional
default value. If no default value is provided, new entries will be filled with
zero. To leave new entries uninitialized, specify `math.uninitialized` as the
default value.

```js
var a = math.matrix();  // Matrix, size [0],       []
a.resize([2, 3]);       // Matrix, size [2, 3],    [[0, 0, 0], [0, 0, 0]]
a.resize([2, 2, 2]);    // Matrix, size [2, 2, 2],
                        //   [[[0, 0], [0, 0]], [[0, 0], [0, 0]]]

var b = math.matrix();
b.resize([3], 7);       // Matrix, size [3],    [7, 7, 7]
b.resize([5], 9);       // Matrix, size [5],    [7, 7, 7, 9, 9]
b.resize([2]);          // Matrix, size [2],    [7, 7]
```


Outer dimensions of a matrix can be squeezed using the function `squeeze`. When
getting or setting a subset in a matrix, the subset is automatically squeezed
or unsqueezed.

```js
// squeeze a matrix
var a = [[[0, 1, 2]]];
math.squeeze(a);        // [0, 1, 2]
math.squeeze([[3]]);    // 3

// subsets are automatically squeezed
var b = math.matrix([[0, 1], [2, 3]]);
b.subset([1, 0]);       // 2
```


## Getting or replacing subsets

Subsets of a matrix can be retrieved or replaced using the function `subset`.
Matrices have a `subset` function, which is applied to the matrix itself:
`Matrix.subset(index [, replacement])`. For both matrices and arrays,
the static function `subset(matrix, index [, replacement])` can be used.
When parameter `replacement` is provided, the function will replace a subset
in the matrix, and if not, a subset of the matrix will be returned.

A subset can be defined using an `Index`. An `Index` contains a single value
or a set of values for each dimension of a matrix. An `Index` can be
created using the function `index`.
Matrix indexes in math.js are zero-based, like most programming languages
including JavaScript itself.

Note that mathematical applications like Matlab and Octave work differently,
as they use one-based indexes.

```js
// create some matrices
var a = [0, 1, 2, 3];
var b = [[0, 1], [2, 3]];
var c = math.zeros(2, 2);
var d = math.matrix([[0, 1, 2], [3, 4, 5], [6, 7, 8]]);
var e = math.matrix();

// get a subset
math.subset(a, math.index(1));                // 1
math.subset(a, math.index([2, 3]));           // Array, [2, 3]
math.subset(a, math.index(math.range(0,4)));  // Array, [0, 1, 2, 3]
math.subset(b, math.index(1, 0));             // 2
math.subset(b, math.index(1, [0, 1]));        // Array, [2, 3]
math.subset(b, math.index([0, 1], 0));        // Matrix, [[0], [2]]

// get a subset
d.subset(math.index([1, 2], [0, 1]));         // Matrix, [[3, 4], [6, 7]]
d.subset(math.index(1, 2));                   // 5

// replace a subset. The subset will be applied to a clone of the matrix
math.subset(b, math.index(1, 0), 9);          // Array, [[0, 1], [9, 3]]
math.subset(b, math.index(2, [0, 1]), [4, 5]);// Array, [[0, 1], [2, 3], [4, 5]]

// replace a subset. The subset will be applied to the matrix itself
c.subset(math.index(0, 1),1);                 // Matrix, [[0, 1], [0, 0]]
c.subset(math.index(1, [0, 1]), [2, 3]);      // Matrix, [[0, 1], [2, 3]]
e.resize([2, 3], 0);                          // Matrix, [[0, 0, 0], [0, 0, 0]]
e.subset(math.index(1, 2), 5);                // Matrix, [[0, 0, 0], [0, 0, 5]]
```

## Iterating

Matrices contain functions `map` and `forEach` to iterate over all elements of
the (multidimensional) matrix. The callback function of `map` and `forEach` has
three parameters: `value` (the value of the currently iterated element),
`index` (an array with the index value for each dimension), and `matrix` (the
matrix being iterated). This syntax is similar to the `map` and `forEach`
functions of native JavaScript Arrays, except that the index is no number but
an Array with numbers for each dimension.

```js
var a = math.matrix([[0, 1], [2, 3], [4, 5]]);

// The iteration below will output the following in the console:
//    value: 0 index: [0, 0]
//    value: 1 index: [0, 1]
//    value: 2 index: [1, 0]
//    value: 3 index: [1, 1]
//    value: 4 index: [2, 0]
//    value: 5 index: [2, 1]
a.forEach(function (value, index, matrix) {
  console.log('value:', value, 'index:', index);
});

// Apply a transformation on the matrix
var b = a.map(function (value, index, matrix) {
  return math.multiply(math.sin(value), math.exp(math.abs(value)));
});
console.log(b.format(5)); // [[0, 2.2874], [6.7188, 2.8345], [-41.32, -142.32]]

// Create a matrix with the cumulative of all elements
var count = 0;
var cum = a.map(function (value, index, matrix) {
  count += value;
  return count;
});
console.log(cum.toString()); // [[0, 1], [3, 6], [10, 15]]
```

## Storage types

Math.js supports both dense matrices as well as sparse matrices. Sparse matrices are efficient for matrices largely containing zeros. In that case they save a lot of memory, and calculations can be much faster than for dense matrices.

Math.js supports two type of matrices:

- Dense matrix (`'dense'`, `default`) A regular, dense matrix, supporting multi-dimensional matrices. This is the default matrix type.
- Sparse matrix (`'sparse'`): A two dimensional sparse matrix implementation.

The type of matrix can be selected when creating a matrix using the construction functions `matrix`, `diag`, `eye`, `ones`, and `zeros`.

```js
// create sparse matrices
var m1 = math.matrix([[0, 1], [0, 0]], 'sparse');
var m2 = math.eye(1000, 1000, 'sparse');
```

## API

All relevant functions in math.js support Matrices and Arrays. Functions like `math.add` and `math.subtract`, `math.sqrt` handle matrices element wise. There is a set of functions specifically for creating or manipulating matrices, such as:

- Functions like `math.matrix` and `math.sparse`, `math.ones`, `math.zeros`, and `math.eye` to create a matrix.
- Functions like `math.subset` and `math.index` to get or replace a part of a matrix
- Functions like `math.transpose` and `math.diag` to manipulate matrices.

A full list of matrix functions is available on the [functions reference page](../reference/functions.md#matrix-functions).

Two types of matrix classes are available in math.js, for storage of dense and sparse matrices. Although they contain public functions documented as follows, using the following API directly is *not* recommended. Prefer using the functions in the "math" namespace wherever possible.

- [DenseMatrix](../reference/classes/densematrix.md)
- [SparseMatrix](../reference/classes/sparsematrix.md)
