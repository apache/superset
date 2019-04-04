# Data Types

The functions of math.js support multiple data types, both native JavaScript
types as well as more advanced types implemented in math.js. The data types can
be mixed together in calculations, for example by adding a Number to a
Complex number or Array.

The supported data types are:

- Boolean
- [Number](numbers.md)
- [BigNumber](bignumbers.md)
- [Complex](complex_numbers.md)
- [Fraction](fractions.md)
- [Array](matrices.md)
- [Matrix](matrices.md)
- [Unit](units.md)
- String

Function [`math.typeof(x)`](../reference/functions/typeof.md) can be used to get
the type of a variable.

Example usage:

```js
// use numbers
math.subtract(7.1, 2.3);        // 4.8
math.round(math.pi, 3);         // 3.142
math.sqrt(4.41e2);              // 21

// use BigNumbers
math.add(math.bignumber(0.1), math.bignumber(0.2)); // BigNumber, 0.3

// use Fractions
math.add(math.fraction(1), math.fraction(3)); // Fraction, 0.(3)

// use strings
math.add('hello ', 'world');    // 'hello world'
math.max('A', 'D', 'C');        // 'D'

// use complex numbers
var a = math.complex(2, 3);     // 2 + 3i
a.re;                           // 2
a.im;                           // 3
var b = math.complex('4 - 2i'); // 4 - 2i
math.add(a, b);                 // 6 + i
math.sqrt(-4);                  // 2i

// use arrays
var array = [1, 2, 3, 4, 5];
math.factorial(array);          // Array,  [1, 2, 6, 24, 120]
math.add(array, 3);             // Array,  [3, 5, 6, 7, 8]

// use matrices
var matrix = math.matrix([1, 4, 9, 16, 25]);  // Matrix, [1, 4, 9, 16, 25]
math.sqrt(matrix);                            // Matrix, [1, 2, 3, 4, 5]

// use units
var a = math.unit(55, 'cm');    // 550 mm
var b = math.unit('0.1m');      // 100 mm
math.add(a, b);                 // 0.65 m

// check the type of a variable
math.typeof(2);                   // 'number'
math.typeof(math.unit('2 inch')); // 'Unit'
math.typeof(math.sqrt(-4));       // 'Complex'
```
