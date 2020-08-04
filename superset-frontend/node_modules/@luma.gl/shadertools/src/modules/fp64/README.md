# 64-bit Floating Point package

Provides basic 64-bit math support in GPU shaders:

| Function                        | Description           |
| ------------------------------- | --------------------- |
| vec2 `add_fp64`(vec2 a, vec2 b) | |
| vec2 `sub_fp64`(vec2 a, vec2 b) | |
| vec2 `mul_fp64`(vec2 a, vec2 b) | |
| vec2 `div_fp64`(vec2 a, vec2 b) | |
| vec2 `sqrt_fp64`(vec2 a)        | |
| vec2 `exp_fp64`(vec2 a)         | |
| vec2 `log_fp64`(vec2 a)         | |
| vec2 `sin_fp64`(vec2 a)         | |
| vec2 `cos_fp64`(vec2 a)         | |
| vec2 `tan_fp64`(vec2 a)         | |


## Precision

WebGL does not expose native 64-bit floating point number support of
modern desktop GPUs to developers. As an alternative, this module uses
two 32-bit native floating point number to extend and preserve significant
digits and uses algorithms similar to those used in many multiple precision
math libraries to achieve precision close to what IEEE-754 double precision
floating point numbers provide. Generally speaking, this mechanism provide
46 significant digits in mantissa (48 overall) within the normal range of
32-bit single precision float point numbers. This transfers to ~ `1x10^-15`
relative error within ~ `1.2x10^-38` and `1.7x10^+38`.

The error bound as tested on 2015 MacBook Pro with AMD Radeon R9 M370X GPU:

```
Addition and subtraction: < 1 ulp
Multiplication: ~1.5 ulps
Division: ~2 ulps
Square root: ~2.6 ulps
Exponential: ~2.6 ulps
Logarithm: ~11.6 ulps (depends on the accuracy of native log() function)
Trigonometry: ~5 ulps
```
Note: `ulp` = [unit of least precision](https://en.wikipedia.org/wiki/Unit_in_the_last_place)

## Performance Implications

Since 64-bit floating point math is emulated using the multiple precision
arithmetic, it costs significantly more GPU cycles than native 32-bit math
(more than an order of magnitude, not to mention the non-IEEE compliant
"fast-math" functions that most GPUs use to trade accuracy for speed).

However, by using 64-bit math only in accuracy critical paths,
the performance impact of using 64-bit calculations will normally be
significantly less than an order of magnitude.

For many applications, the amount of time spent in e.g.
the vertex shading stage is only part of the time spent in the whole the
rendering pipeline.

There will be a memory impact too, in that all vertex attributes and uniform data
that uses 64-bit maths require double storage space in JavaScirpt. Same as mentioned
above, since a layer usually has some attributes that do not require 64-bit maths,the
total memory impact normally be somewhat less than 2x.

## References

- http://crd-legacy.lbl.gov/~dhbailey/mpdist
- https://gmplib.org
