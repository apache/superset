# 32-bit Floating Point package

Provides "improved" 32-bit math support to GPU shaders on certain platforms,
mainly compensating for non-IEEE compliant "fast-math" functions that
GPU vendors use to trade accuracy for speed.

| Function                        | Description           |
| ------------------------------- | --------------------- |
| vec2 `tan_fp32`(vec2 a)         | Improved accuracy `tan` - falls back to `tan` on non-Intel platforms |


## Performance Implications

Since 32-bit floating point trigonometric is using more accurate Taylor approximations,
they cost more GPU cycles than built-in versions.
If you need the precision, it is typically worth the cost.
