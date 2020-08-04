# vega-scale

Scales and color schemes for visual encoding.

This pacakge provides [scale](#scale) and [scheme](#scheme) methods for managing scale mappings and color schemes. By default, the scale and scheme registries include all scale types and color schemes provided by the [d3-scale](https://github.com/d3/d3-scale) and [d3-scale-chromatic](https://github.com/d3/d3-scale-chromatic) modules.

This module also provides augmented implementations of `'band'`, `'point'`, and `'sequential'` scales in order to provide improved layout and inversion support for band/point scales, and multi-domain and color range array support for sequential scales.

## API Reference

<a name="scale" href="#scale">#</a>
vega.<b>scale</b>(<i>type</i>[, <i>scale</i>, <i>metadata</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-scale/src/scales.js "Source")

Registry function for adding and accessing scale constructor functions. The *type* argument is a String indicating the name of the scale type. If the *scale* argument is not specified, this method returns the matching scale constructor in the registry, or `null` if not found. If the *scale* argument is provided, it must be a scale constructor function to add to the registry under the given *type* name.

The *metadata* argument provides additional information to guide appropriate use of scales within Vega. The *metadata* can be either a string or string array. The valid string values are:

* `"continuous"` - the scale is defined over a continuous-valued domain.
* `"discrete"` - the scale is defined over a discrete domain and range.
* `"discretizing"` - the scale discretizes a continuous domain to a discrete range.
* `"interpolating"` - the scale range is defined using a color interpolator.
* `"log"` - the scale performs a logarithmic transform of the continuous domain.
* `"temporal"` - the scale domain is defined over date-time values.

By default, the scale registry includes entries for all scale types provided by the [d3-scale](https://github.com/d3/d3-scale) module. Scales created using the constructor returned by this method have an additional `type` property indicating the scale type. All scales supporting either an `invert` or `invertExtent` method are augmented with an additional `invertRange` function that returns an array of corresponding domain values for a given interval in the scale's output range.

```js
// linear scale
var linear = vega.scale('linear');
var scale = linear().domain([0, 10]).range([0, 100]);
scale.type; // 'linear'
scale.invertRange([0, 100]); // [0, 10]
```

```js
var ordinal = vega.scale('ordinal');

// ordinal scale
var scale1 = ordinal().domain(['a', 'b', 'c']).range([0, 1, 2]);
scale1.type; // 'ordinal'

// ordinal scale with range set to the 'category20' color palette
var scale2 = ordinal().range(vega.scheme('category20'));
```

```js
var seq = vega.scale('sequential');

// sequential scale, using the plasma color palette
var scale1 = seq().interpolator(vega.scheme('plasma'));
scale1.type; // 'sequential'
```

<a name="scheme" href="#scheme">#</a>
vega.<b>scheme</b>(<i>name</i>[, <i>scheme</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-scale/src/schemes.js "Source")

Registry function for adding and accessing color schemes. The *name* argument is a String indicating the name of the color scheme. If the *scheme* argument is not specified, this method returns the matching scheme value in the registry, or `null` if not found. If the *scheme* argument is provided, it must be a valid color array or [interpolator](https://github.com/d3/d3-scale#sequential_interpolator) to add to the registry under the given *name*.

By default, the scheme registry includes entries for all scheme types provided by the
[d3-scale-chromatic](https://github.com/d3/d3-scale-chromatic) module. Valid schemes are either arrays of color values (e.g., applicable to `'ordinal'` scales) or [interpolator](https://github.com/d3/d3-scale#sequential_interpolator) functions (e.g., applicable to `'sequential'` scales.)

<a name="interpolate" href="#interpolate">#</a>
vega.<b>interpolate</b>(<i>name</i>[, <i>gamma</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-scale/src/interpolate.js "Source")

Returns the D3 interpolator factory with the given *name* and optional *gamma*. All interpolator types provided by the [d3-interpolate](https://github.com/d3/d3-interpolate) module are supported. However, Vega uses hyphenated rather than camelCase names.

```js
var rgbBasis = vega.interpolate('rgb-basis'); // d3.interpolateRgbBasis
var rgbGamma = vega.interpolate('rgb', 2.2);  // d3.interpolateRgb.gamma(2.2)
```

<a name="interpolateColors" href="#interpolateColors">#</a>
vega.<b>interpolateColors</b>(<i>colors</i>[, <i>type</i>, <i>gamma</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-scale/src/interpolate.js "Source")

Given an array of discrete *colors*, returns an interpolator function that maps the domain [0, 1] to a continuous spectrum of colors using piecewise linear interpolation. The optional parameters *type* and *gamma* specify an interpolation type (default `"rgb"`) and gamma correction (default `1`) supported by the [interpolate](#interpolate) method.

<a name="interpolateRange" href="#interpolateRange">#</a>
vega.<b>interpolateRange</b>(<i>interpolator</i>, <i>range</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-scale/src/interpolate.js "Source")

Given a D3 *interpolator* instance, return a new interpolator with a modified interpolation *range*. The *range* argument should be a two element array whose entries lie in the range [0, 1]. This method is convenient for transforming the range of values over which interpolation is performed.

```js
var number = d3.interpolateNumber(0, 10);
number(0);   // 0
number(0.5); // 5
number(1);   // 10

var range = vega.interpolateRange(number, [0.2, 0.8]);
range(0);   // 2
range(0.5); // 5
range(1);   // 8
```

<a name="quantizeInterpolator" href="#quantizeInterpolator">#</a>
vega.<b>quantizeInterpolator</b>(<i>interpolator</i>, <i>count</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-scale/src/interpolate.js "Source")

Given an *interpolator* function, returns *count* evenly-spaced samples. This method is useful for generating a discrete color scheme from a continuous color interpolator.
