![long.js - A Long class for representing a 64 bit two's-complement integer ](https://raw.github.com/dcodeIO/long.js/master/long.png)
=======
A Long class for representing a 64 bit two's-complement integer value derived from the [Closure Library](https://github.com/google/closure-library)
for stand-alone use and extended with unsigned support.

[![Build Status](https://travis-ci.org/dcodeIO/long.js.svg)](https://travis-ci.org/dcodeIO/long.js)
[![Donate](https://raw.githubusercontent.com/dcodeIO/long.js/master/donate.png)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=dcode%40dcode.io&item_name=%3C3%20long.js)

Background
----------
As of [ECMA-262 5th Edition](http://ecma262-5.com/ELS5_HTML.htm#Section_8.5), "all the positive and negative integers
whose magnitude is no greater than 2<sup>53</sup> are representable in the Number type", which is "representing the
doubleprecision 64-bit format IEEE 754 values as specified in the IEEE Standard for Binary Floating-Point Arithmetic".
The [maximum safe integer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
in JavaScript is 2<sup>53</sup>-1.

Example: 2<sup>64</sup>-1 is 18446744073709551615 but in JavaScript it evaluates to `18446744073709552000`.

Furthermore, bitwise operators in JavaScript "deal only with integers in the range −2<sup>31</sup> through
2<sup>31</sup>−1, inclusive, or in the range 0 through 2<sup>32</sup>−1, inclusive. These operators accept any value of
the Number type but first convert each such value to one of 2<sup>32</sup> integer values."

In some use cases, however, it is required to be able to reliably work with and perform bitwise operations on the full
64 bits. This is where long.js comes into play.

Usage
-----
The class is compatible with CommonJS and AMD loaders and is exposed globally as `dcodeIO.Long` if neither is available.

```javascript
var Long = require("long");

var longVal = new Long(0xFFFFFFFF, 0x7FFFFFFF);
console.log(longVal.toString());
...
```

API
---

#### new Long(low, high=, unsigned=)

Constructs a 64 bit two's-complement integer, given its low and high 32 bit values as *signed* integers.
See the from* functions below for more convenient ways of constructing Longs.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| low             | *number*        | The low (signed) 32 bits of the long 
| high            | *number*        | The high (signed) 32 bits of the long 
| unsigned        | *boolean*       | Whether unsigned or not, defaults to `false` for signed 

---

#### Long.MAX_UNSIGNED_VALUE

Maximum unsigned value.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *!Long*         |

#### Long.MAX_VALUE

Maximum signed value.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *!Long*         |

#### Long.MIN_VALUE

Minimum signed value.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *!Long*         |

#### Long.NEG_ONE

Signed negative one.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *!Long*         |

#### Long.ONE

Signed one.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *!Long*         |

#### Long.UONE

Unsigned one.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *!Long*         |

#### Long.UZERO

Unsigned zero.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *!Long*         |

#### Long.ZERO

Signed zero.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *!Long*         |

#### Long.fromBits(lowBits, highBits, unsigned=)

Returns a Long representing the 64 bit integer that comes by concatenating the given low and high bits. Each is
assumed to use 32 bits.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| lowBits         | *number*        | The low 32 bits 
| highBits        | *number*        | The high 32 bits 
| unsigned        | *boolean*       | Whether unsigned or not, defaults to `false` for signed 
| **@returns**    | *!Long*         | The corresponding Long value 

#### Long.fromInt(value, unsigned=)

Returns a Long representing the given 32 bit integer value.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| value           | *number*        | The 32 bit integer in question 
| unsigned        | *boolean*       | Whether unsigned or not, defaults to `false` for signed 
| **@returns**    | *!Long*         | The corresponding Long value 

#### Long.fromNumber(value, unsigned=)

Returns a Long representing the given value, provided that it is a finite number. Otherwise, zero is returned.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| value           | *number*        | The number in question 
| unsigned        | *boolean*       | Whether unsigned or not, defaults to `false` for signed 
| **@returns**    | *!Long*         | The corresponding Long value 

#### Long.fromString(str, unsigned=, radix=)

Returns a Long representation of the given string, written using the specified radix.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| str             | *string*        | The textual representation of the Long 
| unsigned        | *boolean &#124; number* | Whether unsigned or not, defaults to `false` for signed 
| radix           | *number*        | The radix in which the text is written (2-36), defaults to 10 
| **@returns**    | *!Long*         | The corresponding Long value 

#### Long.isLong(obj)

Tests if the specified object is a Long.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| obj             | ***             | Object 
| **@returns**    | *boolean*       | 

#### Long.fromValue(val)

Converts the specified value to a Long.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| val             | *!Long &#124; number &#124; string &#124; !{low: number, high: number, unsigned: boolean}* | Value 
| **@returns**    | *!Long*         | 

---

#### Long#high

The high 32 bits as a signed value.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *number*        |

#### Long#low

The low 32 bits as a signed value.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *number*        |

#### Long#unsigned

Whether unsigned or not.

|                 |                 |
|-----------------|-----------------|
| **@type**       | *boolean*       |

#### Long#add(addend)

Returns the sum of this and the specified Long.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| addend          | *!Long &#124; number &#124; string* | Addend 
| **@returns**    | *!Long*         | Sum 

#### Long#and(other)

Returns the bitwise AND of this Long and the specified.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other Long 
| **@returns**    | *!Long*         | 

#### Long#compare/comp(other)

Compares this Long's value with the specified's.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other value 
| **@returns**    | *number*        | 0 if they are the same, 1 if the this is greater and -1 if the given one is greater 

#### Long#divide/div(divisor)

Returns this Long divided by the specified.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| divisor         | *!Long &#124; number &#124; string* | Divisor 
| **@returns**    | *!Long*         | Quotient 

#### Long#equals/eq(other)

Tests if this Long's value equals the specified's.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other value 
| **@returns**    | *boolean*       | 

#### Long#getHighBits()

Gets the high 32 bits as a signed integer.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *number*        | Signed high bits 

#### Long#getHighBitsUnsigned()

Gets the high 32 bits as an unsigned integer.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *number*        | Unsigned high bits 

#### Long#getLowBits()

Gets the low 32 bits as a signed integer.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *number*        | Signed low bits 

#### Long#getLowBitsUnsigned()

Gets the low 32 bits as an unsigned integer.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *number*        | Unsigned low bits 

#### Long#getNumBitsAbs()

Gets the number of bits needed to represent the absolute value of this Long.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *number*        | 

#### Long#greaterThan/gt(other)

Tests if this Long's value is greater than the specified's.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other value 
| **@returns**    | *boolean*       | 

#### Long#greaterThanOrEqual/gte(other)

Tests if this Long's value is greater than or equal the specified's.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other value 
| **@returns**    | *boolean*       | 

#### Long#isEven()

Tests if this Long's value is even.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *boolean*       | 

#### Long#isNegative()

Tests if this Long's value is negative.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *boolean*       | 

#### Long#isOdd()

Tests if this Long's value is odd.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *boolean*       | 

#### Long#isPositive()

Tests if this Long's value is positive.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *boolean*       | 

#### Long#isZero()

Tests if this Long's value equals zero.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *boolean*       | 

#### Long#lessThan/lt(other)

Tests if this Long's value is less than the specified's.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other value 
| **@returns**    | *boolean*       | 

#### Long#lessThanOrEqual/lte(other)

Tests if this Long's value is less than or equal the specified's.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other value 
| **@returns**    | *boolean*       | 

#### Long#modulo/mod(divisor)

Returns this Long modulo the specified.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| divisor         | *!Long &#124; number &#124; string* | Divisor 
| **@returns**    | *!Long*         | Remainder 

#### Long#multiply/mul(multiplier)

Returns the product of this and the specified Long.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| multiplier      | *!Long &#124; number &#124; string* | Multiplier 
| **@returns**    | *!Long*         | Product 

#### Long#negate/neg()

Negates this Long's value.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *!Long*         | Negated Long 

#### Long#not()

Returns the bitwise NOT of this Long.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *!Long*         | 

#### Long#notEquals/neq(other)

Tests if this Long's value differs from the specified's.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other value 
| **@returns**    | *boolean*       | 

#### Long#or(other)

Returns the bitwise OR of this Long and the specified.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other Long 
| **@returns**    | *!Long*         | 

#### Long#shiftLeft/shl(numBits)

Returns this Long with bits shifted to the left by the given amount.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| numBits         | *number &#124; !Long* | Number of bits 
| **@returns**    | *!Long*         | Shifted Long 

#### Long#shiftRight/shr(numBits)

Returns this Long with bits arithmetically shifted to the right by the given amount.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| numBits         | *number &#124; !Long* | Number of bits 
| **@returns**    | *!Long*         | Shifted Long 

#### Long#shiftRightUnsigned/shru(numBits)

Returns this Long with bits logically shifted to the right by the given amount.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| numBits         | *number &#124; !Long* | Number of bits 
| **@returns**    | *!Long*         | Shifted Long 

#### Long#subtract/sub(subtrahend)

Returns the difference of this and the specified Long.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| subtrahend      | *!Long &#124; number &#124; string* | Subtrahend 
| **@returns**    | *!Long*         | Difference 

#### Long#toInt()

Converts the Long to a 32 bit integer, assuming it is a 32 bit integer.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *number*        | 

#### Long#toNumber()

Converts the Long to a the nearest floating-point representation of this value (double, 53 bit mantissa).

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *number*        | 

#### Long#toSigned()

Converts this Long to signed.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *!Long*         | Signed long 

#### Long#toString(radix=)

Converts the Long to a string written in the specified radix.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| radix           | *number*        | Radix (2-36), defaults to 10 
| **@returns**    | *string*        | 
| **@throws**     | *RangeError*    | If `radix` is out of range 

#### Long#toUnsigned()

Converts this Long to unsigned.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| **@returns**    | *!Long*         | Unsigned long 

#### Long#xor(other)

Returns the bitwise XOR of this Long and the given one.

| Parameter       | Type            | Description
|-----------------|-----------------|---------------
| other           | *!Long &#124; number &#124; string* | Other Long 
| **@returns**    | *!Long*         | 

Downloads
---------
* [Distributions](https://github.com/dcodeIO/long.js/tree/master/dist)
* [ZIP-Archive](https://github.com/dcodeIO/long.js/archive/master.zip)
* [Tarball](https://github.com/dcodeIO/long.js/tarball/master)

License
-------
Apache License, Version 2.0 - http://www.apache.org/licenses/LICENSE-2.0.html
