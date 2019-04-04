# d3-scale

Scales are a convenient abstraction for a fundamental task in visualization: mapping a dimension of abstract data to a visual representation. Although most often used for position-encoding quantitative data, such as mapping a measurement in meters to a position in pixels for dots in a scatterplot, scales can represent virtually any visual encoding, such as diverging colors, stroke widths, or symbol size. Scales can also be used with virtually any type of data, such as named categorical data or discrete data that requires sensible breaks.

For [continuous](#continuous-scales) quantitative data, you typically want a [linear scale](#linear-scales). (For time series data, a [time scale](#time-scales).) If the distribution calls for it, consider transforming data using a [power](#power-scales) or [log](#log-scales) scale. A [quantize scale](#quantize-scales) may aid differentiation by rounding continuous data to a fixed set of discrete values; similarly, a [quantile scale](#quantile-scales) computes quantiles from a sample population, and a [threshold scale](#threshold-scales) allows you to specify arbitrary breaks in continuous data. Several built-in [sequential color schemes](#sequential-scales) are also provided; see [d3-scale-chromatic](https://github.com/d3/d3-scale-chromatic) for more.

For discrete ordinal (ordered) or categorical (unordered) data, an [ordinal scale](#ordinal-scales) specifies an explicit mapping from a set of data values to a corresponding set of visual attributes (such as colors). The related [band](#band-scales) and [point](#point-scales) scales are useful for position-encoding ordinal data, such as bars in a bar chart or dots in an categorical scatterplot. Several built-in [categorical color scales](#category-scales) are also provided.

Scales have no intrinsic visual representation. However, most scales can [generate](#continuous_ticks) and [format](#continuous_tickFormat) ticks for reference marks to aid in the construction of axes.

For a longer introduction, see these recommended tutorials:

* [Introducing d3-scale](https://medium.com/@mbostock/introducing-d3-scale-61980c51545f) by Mike Bostock

* [Chapter 7. Scales](http://chimera.labs.oreilly.com/books/1230000000345/ch07.html) of *Interactive Data Visualization for the Web* by Scott Murray

* [d3: scales, and color.](http://www.jeromecukier.net/blog/2011/08/11/d3-scales-and-color/) by Jérôme Cukier

## Installing

If you use NPM, `npm install d3-scale`. Otherwise, download the [latest release](https://github.com/d3/d3-scale/releases/latest). You can also load directly from [d3js.org](https://d3js.org), either as a [standalone library](https://d3js.org/d3-scale.v1.min.js) or as part of [D3 4.0](https://github.com/d3/d3). AMD, CommonJS, and vanilla environments are supported. In vanilla, a `d3` global is exported:

```html
<script src="https://d3js.org/d3-array.v1.min.js"></script>
<script src="https://d3js.org/d3-collection.v1.min.js"></script>
<script src="https://d3js.org/d3-color.v1.min.js"></script>
<script src="https://d3js.org/d3-format.v1.min.js"></script>
<script src="https://d3js.org/d3-interpolate.v1.min.js"></script>
<script src="https://d3js.org/d3-time.v1.min.js"></script>
<script src="https://d3js.org/d3-time-format.v2.min.js"></script>
<script src="https://d3js.org/d3-scale.v1.min.js"></script>
<script>

var x = d3.scaleLinear();

</script>
```

(You can omit d3-time and d3-time-format if you’re not using [d3.scaleTime](#scaleTime) or [d3.scaleUtc](#scaleUtc).)

[Try d3-scale in your browser.](https://tonicdev.com/npm/d3-scale)

## API Reference

* [Continuous](#continuous-scales) ([Linear](#linear-scales), [Power](#power-scales), [Log](#log-scales), [Identity](#identity-scales), [Time](#time-scales))
* [Sequential](#sequential-scales)
* [Quantize](#quantize-scales)
* [Quantile](#quantile-scales)
* [Threshold](#threshold-scales)
* [Ordinal](#ordinal-scales) ([Band](#band-scales), [Point](#point-scales), [Category](#category-scales))

### Continuous Scales

Continuous scales map a continuous, quantitative input [domain](#continuous_domain) to a continuous output [range](#continuous_range). If the range is also numeric, the mapping may be [inverted](#continuous_invert). A continuous scale is not constructed directly; instead, try a [linear](#linear-scales), [power](#power-scales), [log](#log-scales), [identity](#identity-scales), [time](#time-scales) or [sequential color](#sequential-scales) scale.

<a name="_continuous" href="#_continuous">#</a> <i>continuous</i>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/continuous.js#L69 "Source")

Given a *value* from the [domain](#continuous_domain), returns the corresponding value from the [range](#continuous_range). If the given *value* is outside the domain, and [clamping](#continuous_clamp) is not enabled, the mapping may be extrapolated such that the returned value is outside the range. For example, to apply a position encoding:

```js
var x = d3.scaleLinear()
    .domain([10, 130])
    .range([0, 960]);

x(20); // 80
x(50); // 320
```

Or to apply a color encoding:

```js
var color = d3.scaleLinear()
    .domain([10, 100])
    .range(["brown", "steelblue"]);

color(20); // "#9a3439"
color(50); // "#7b5167"
```

<a name="continuous_invert" href="#continuous_invert">#</a> <i>continuous</i>.<b>invert</b>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/continuous.js#L88 "Source")

Given a *value* from the [range](#continuous_range), returns the corresponding value from the [domain](#continuous_domain). Inversion is useful for interaction, say to determine the data value corresponding to the position of the mouse. For example, to invert a position encoding:

```js
var x = d3.scaleLinear()
    .domain([10, 130])
    .range([0, 960]);

x.invert(80); // 20
x.invert(320); // 50
```

If the given *value* is outside the range, and [clamping](#continuous_clamp) is not enabled, the mapping may be extrapolated such that the returned value is outside the domain. This method is only supported if the range is numeric. If the range is not numeric, returns NaN.

For a valid value *y* in the range, <i>continuous</i>(<i>continuous</i>.invert(<i>y</i>)) approximately equals *y*; similarly, for a valid value *x* in the domain, <i>continuous</i>.invert(<i>continuous</i>(<i>x</i>)) approximately equals *x*. The scale and its inverse may not be exact due to the limitations of floating point precision.

<a name="continuous_domain" href="#continuous_domain">#</a> <i>continuous</i>.<b>domain</b>([<i>domain</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/continuous.js#L92 "Source")

If *domain* is specified, sets the scale’s domain to the specified array of numbers. The array must contain two or more elements. If the elements in the given array are not numbers, they will be coerced to numbers. If *domain* is not specified, returns a copy of the scale’s current domain.

Although continuous scales typically have two values each in their domain and range, specifying more than two values produces a piecewise scale. For example, to create a diverging color scale that interpolates between white and red for negative values, and white and green for positive values, say:

```js
var color = d3.scaleLinear()
    .domain([-1, 0, 1])
    .range(["red", "white", "green"]);

color(-0.5); // "rgb(255, 128, 128)"
color(+0.5); // "rgb(128, 192, 128)"
```

Internally, a piecewise scale performs a [binary search](https://github.com/d3/d3-array#bisect) for the range interpolator corresponding to the given domain value. Thus, the domain must be in ascending or descending order. If the domain and range have different lengths *N* and *M*, only the first *min(N,M)* elements in each are observed.

<a name="continuous_range" href="#continuous_range">#</a> <i>continuous</i>.<b>range</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/continuous.js#L96 "Source")

If *range* is specified, sets the scale’s range to the specified array of values. The array must contain two or more elements. Unlike the [domain](#continuous_domain), elements in the given array need not be numbers; any value that is supported by the underlying [interpolator](#continuous_interpolate) will work, though note that numeric ranges are required for [invert](#continuous_invert). If *range* is not specified, returns a copy of the scale’s current range. See [*continuous*.interpolate](#continuous_interpolate) for more examples.

<a name="continuous_rangeRound" href="#continuous_rangeRound">#</a> <i>continuous</i>.<b>rangeRound</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/continuous.js#L100 "Source")

Sets the scale’s [*range*](#continuous_range) to the specified array of values while also setting the scale’s [interpolator](#continuous_interpolate) to [interpolateRound](https://github.com/d3/d3-interpolate#interpolateRound). This is a convenience method equivalent to:

```js
continuous
    .range(range)
    .interpolate(d3.interpolateRound);
```

The rounding interpolator is sometimes useful for avoiding antialiasing artifacts, though also consider the [shape-rendering](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/shape-rendering) “crispEdges” styles. Note that this interpolator can only be used with numeric ranges.

<a name="continuous_clamp" href="#continuous_clamp">#</a> <i>continuous</i>.<b>clamp</b>(<i>clamp</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/continuous.js#L104 "Source")

If *clamp* is specified, enables or disables clamping accordingly. If clamping is disabled and the scale is passed a value outside the [domain](#continuous_domain), the scale may return a value outside the [range](#continuous_range) through extrapolation. If clamping is enabled, the return value of the scale is always within the scale’s range. Clamping similarly applies to [*continuous*.invert](#continuous_invert). For example:

```js
var x = d3.scaleLinear()
    .domain([10, 130])
    .range([0, 960]);

x(-10); // -160, outside range
x.invert(-160); // -10, outside domain

x.clamp(true);
x(-10); // 0, clamped to range
x.invert(-160); // 10, clamped to domain
```

If *clamp* is not specified, returns whether or not the scale currently clamps values to within the range.

<a name="continuous_interpolate" href="#continuous_interpolate">#</a> <i>continuous</i>.<b>interpolate</b>(<i>interpolate</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/continuous.js#L108 "Source")

If *interpolate* is specified, sets the scale’s [range](#continuous_range) interpolator factory. This interpolator factory is used to create interpolators for each adjacent pair of values from the range; these interpolators then map a normalized domain parameter *t* in [0, 1] to the corresponding value in the range. If *factory* is not specified, returns the scale’s current interpolator factory, which defaults to [interpolate](https://github.com/d3/d3-interpolate#interpolate). See [d3-interpolate](https://github.com/d3/d3-interpolate) for more interpolators.

For example, consider a diverging color scale with three colors in the range:

```js
var color = d3.scaleLinear()
    .domain([-100, 0, +100])
    .range(["red", "white", "green"]);
```

Two interpolators are created internally by the scale, equivalent to:

```js
var i0 = d3.interpolate("red", "white"),
    i1 = d3.interpolate("white", "green");
```

A common reason to specify a custom interpolator is to change the color space of interpolation. For example, to use [HCL](https://github.com/d3/d3-interpolate#interpolateHcl):

```js
var color = d3.scaleLinear()
    .domain([10, 100])
    .range(["brown", "steelblue"])
    .interpolate(d3.interpolateHcl);
```

Or for [Cubehelix](https://github.com/d3/d3-interpolate#interpolateCubehelix) with a custom gamma:

```js
var color = d3.scaleLinear()
    .domain([10, 100])
    .range(["brown", "steelblue"])
    .interpolate(d3.interpolateCubehelix.gamma(3));
```

Note: the [default interpolator](https://github.com/d3/d3-interpolate#interpolate) **may reuse return values**. For example, if the range values are objects, then the value interpolator always returns the same object, modifying it in-place. If the scale is used to set an attribute or style, this is typically acceptable (and desirable for performance); however, if you need to store the scale’s return value, you must specify your own interpolator or make a copy as appropriate.

<a name="continuous_ticks" href="#continuous_ticks">#</a> <i>continuous</i>.<b>ticks</b>([<i>count</i>])

Returns approximately *count* representative values from the scale’s [domain](#continuous_domain). If *count* is not specified, it defaults to 10. The returned tick values are uniformly spaced, have human-readable values (such as multiples of powers of 10), and are guaranteed to be within the extent of the domain. Ticks are often used to display reference lines, or tick marks, in conjunction with the visualized data. The specified *count* is only a hint; the scale may return more or fewer values depending on the domain. See also d3-array’s [ticks](https://github.com/d3/d3-array#ticks).

<a name="continuous_tickFormat" href="#continuous_tickFormat">#</a> <i>continuous</i>.<b>tickFormat</b>([<i>count</i>[, <i>specifier</i>]]) [<>](https://github.com/d3/d3-scale/blob/master/src/tickFormat.js "Source")

Returns a [number format](https://github.com/d3/d3-format) function suitable for displaying a tick value, automatically computing the appropriate precision based on the fixed interval between tick values. The specified *count* should have the same value as the count that is used to generate the [tick values](#continuous_ticks).

An optional *specifier* allows a [custom format](https://github.com/d3/d3-format#locale_format) where the precision of the format is automatically set by the scale as appropriate for the tick interval. For example, to format percentage change, you might say:

```js
var x = d3.scaleLinear()
    .domain([-1, 1])
    .range([0, 960]);

var ticks = x.ticks(5),
    tickFormat = x.tickFormat(5, "+%");

ticks.map(tickFormat); // ["-100%", "-50%", "+0%", "+50%", "+100%"]
```

If *specifier* uses the format type `s`, the scale will return a [SI-prefix format](https://github.com/d3/d3-format#locale_formatPrefix) based on the largest value in the domain. If the *specifier* already specifies a precision, this method is equivalent to [*locale*.format](https://github.com/d3/d3-format#locale_format).

<a name="continuous_nice" href="#continuous_nice">#</a> <i>continuous</i>.<b>nice</b>([<i>count</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/nice.js "Source")

Extends the [domain](#continuous_domain) so that it starts and ends on nice round values. This method typically modifies the scale’s domain, and may only extend the bounds to the nearest round value. An optional tick *count* argument allows greater control over the step size used to extend the bounds, guaranteeing that the returned [ticks](#continuous_ticks) will exactly cover the domain. Nicing is useful if the domain is computed from data, say using [extent](https://github.com/d3/d3-array#extent), and may be irregular. For example, for a domain of [0.201479…, 0.996679…], a nice domain might be [0.2, 1.0]. If the domain has more than two values, nicing the domain only affects the first and last value. See also d3-array’s [tickStep](https://github.com/d3/d3-array#tickStep).

Nicing a scale only modifies the current domain; it does not automatically nice domains that are subsequently set using [*continuous*.domain](#continuous_domain). You must re-nice the scale after setting the new domain, if desired.

<a name="continuous_copy" href="#continuous_copy">#</a> <i>continuous</i>.<b>copy</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/continuous.js#L59 "Source")

Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.

#### Linear Scales

<a name="scaleLinear" href="#scaleLinear">#</a> d3.<b>scaleLinear</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/linear.js "Source")

Constructs a new [continuous scale](#continuous-scales) with the unit [domain](#continuous_domain) [0, 1], the unit [range](#continuous_range) [0, 1], the [default](https://github.com/d3/d3-interpolate#interpolate) [interpolator](#continuous_interpolate) and [clamping](#continuous_clamp) disabled. Linear scales are a good default choice for continuous quantitative data because they preserve proportional differences. Each range value *y* can be expressed as a function of the domain value *x*: *y* = *mx* + *b*.

#### Power Scales

Power scales are similar to [linear scales](#linear-scales), except an exponential transform is applied to the input domain value before the output range value is computed. Each range value *y* can be expressed as a function of the domain value *x*: *y* = *mx^k* + *b*, where *k* is the [exponent](#pow_exponent) value. Power scales also support negative domain values, in which case the input value and the resulting output value are multiplied by -1.

<a name="scalePow" href="#scalePow">#</a> d3.<b>scalePow</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/pow.js "Source")

Constructs a new [continuous scale](#continuous-scales) with the unit [domain](#continuous_domain) [0, 1], the unit [range](#continuous_range) [0, 1], the [exponent](#pow_exponent) 1, the [default](https://github.com/d3/d3-interpolate#interpolate) [interpolator](#continuous_interpolate) and [clamping](#continuous_clamp) disabled. (Note that this is effectively a [linear](#linear-scales) scale until you set a different exponent.)

<a name="pow" href="#_pow">#</a> <i>pow</i>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/pow.js#L9 "Source")

See [*continuous*](#_continuous).

<a name="pow_invert" href="#pow_invert">#</a> <i>pow</i>.<b>invert</b>(<i>value</i>)

See [*continuous*.invert](#continuous_invert).

<a name="pow_exponent" href="#pow_exponent">#</a> <i>pow</i>.<b>exponent</b>([<i>exponent</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/pow.js#L25 "Source")

If *exponent* is specified, sets the current exponent to the given numeric value. If *exponent* is not specified, returns the current exponent, which defaults to 1. (Note that this is effectively a [linear](#linear-scales) scale until you set a different exponent.)

<a name="pow_domain" href="#pow_domain">#</a> <i>pow</i>.<b>domain</b>([<i>domain</i>])

See [*continuous*.domain](#continuous_domain).

<a name="pow_range" href="#pow_range">#</a> <i>pow</i>.<b>range</b>([<i>range</i>])

See [*continuous*.range](#continuous_range).

<a name="pow_rangeRound" href="#pow_rangeRound">#</a> <i>pow</i>.<b>rangeRound</b>([<i>range</i>])

See [*continuous*.rangeRound](#continuous_rangeRound).

<a name="pow_clamp" href="#pow_clamp">#</a> <i>pow</i>.<b>clamp</b>(<i>clamp</i>)

See [*continuous*.clamp](#continuous_clamp).

<a name="pow_interpolate" href="#pow_interpolate">#</a> <i>pow</i>.<b>interpolate</b>(<i>interpolate</i>)

See [*continuous*.interpolate](#continuous_interpolate).

<a name="pow_ticks" href="#pow_ticks">#</a> <i>pow</i>.<b>ticks</b>([<i>count</i>])

See [*continuous*.ticks](#continuous_ticks).

<a name="pow_tickFormat" href="#pow_tickFormat">#</a> <i>pow</i>.<b>tickFormat</b>([<i>count</i>[, <i>specifier</i>]])

See [*continuous*.tickFormat](#continuous_tickFormat).

<a name="pow_nice" href="#pow_nice">#</a> <i>pow</i>.<b>nice</b>([<i>count</i>])

See [*continuous*.nice](#continuous_nice).

<a name="pow_copy" href="#pow_copy">#</a> <i>pow</i>.<b>copy</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/pow.js#L29 "Source")

See [*continuous*.copy](#continuous_copy).

<a name="scaleSqrt" href="#scaleSqrt">#</a> d3.<b>scaleSqrt</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/pow.js#L36 "Source")

Constructs a new [continuous](#continuous-scales) [power scale](#power-scales) with the unit [domain](#continuous_domain) [0, 1], the unit [range](#continuous_range) [0, 1], the [exponent](#pow_exponent) 0.5, the [default](https://github.com/d3/d3-interpolate#interpolate) [interpolator](#continuous_interpolate) and [clamping](#continuous_clamp) disabled. This is a convenience method equivalent to `d3.scalePow().exponent(0.5)`.

#### Log Scales

Log scales are similar to [linear scales](#linear-scales), except a logarithmic transform is applied to the input domain value before the output range value is computed. The mapping to the range value *y* can be expressed as a function of the domain value *x*: *y* = *m* log(<i>x</i>) + *b*.

As log(0) = -∞, a log scale domain must be **strictly-positive or strictly-negative**; the domain must not include or cross zero. A log scale with a positive domain has a well-defined behavior for positive values, and a log scale with a negative domain has a well-defined behavior for negative values. (For a negative domain, input and output values are implicitly multiplied by -1.) The behavior of the scale is undefined if you pass a negative value to a log scale with a positive domain or vice versa.

<a name="scaleLog" href="#scaleLog">#</a> d3.<b>scaleLog</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/log.js "Source")

Constructs a new [continuous scale](#continuous-scales) with the [domain](#log_domain) [1, 10], the unit [range](#log_range) [0, 1], the [base](#log_base) 10, the [default](https://github.com/d3/d3-interpolate#interpolate) [interpolator](#log_interpolate) and [clamping](#log_clamp) disabled.

<a name="log" href="#_log">#</a> <i>log</i>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/log.js#L42 "Source")

See [*continuous*](#_continuous).

<a name="log_invert" href="#log_invert">#</a> <i>log</i>.<b>invert</b>(<i>value</i>)

See [*continuous*.invert](#continuous_invert).

<a name="log_base" href="#log_base">#</a> <i>log</i>.<b>base</b>([<i>base</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/log.js#L55 "Source")

If *base* is specified, sets the base for this logarithmic scale to the specified value. If *base* is not specified, returns the current base, which defaults to 10.

<a name="log_domain" href="#log_domain">#</a> <i>log</i>.<b>domain</b>([<i>domain</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/log.js#L59 "Source")

See [*continuous*.domain](#continuous_domain).

<a name="log_range" href="#log_range">#</a> <i>log</i>.<b>range</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/continuous.js#L96 "Source")

See [*continuous*.range](#continuous_range).

<a name="log_rangeRound" href="#log_rangeRound">#</a> <i>log</i>.<b>rangeRound</b>([<i>range</i>])

See [*continuous*.rangeRound](#continuous_rangeRound).

<a name="log_clamp" href="#log_clamp">#</a> <i>log</i>.<b>clamp</b>(<i>clamp</i>)

See [*continuous*.clamp](#continuous_clamp).

<a name="log_interpolate" href="#log_interpolate">#</a> <i>log</i>.<b>interpolate</b>(<i>interpolate</i>)

See [*continuous*.interpolate](#continuous_interpolate).

<a name="log_ticks" href="#log_ticks">#</a> <i>log</i>.<b>ticks</b>([<i>count</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/log.js#L63 "Source")

Like [*continuous*.ticks](#continuous_ticks), but customized for a log scale. If the [base](#log_base) is an integer, the returned ticks are uniformly spaced within each integer power of base; otherwise, one tick per power of base is returned. The returned ticks are guaranteed to be within the extent of the domain. If the orders of magnitude in the [domain](#log_domain) is greater than *count*, then at most one tick per power is returned. Otherwise, the tick values are unfiltered, but note that you can use [*log*.tickFormat](#log_tickFormat) to filter the display of tick labels. If *count* is not specified, it defaults to 10.

<a name="log_tickFormat" href="#log_tickFormat">#</a> <i>log</i>.<b>tickFormat</b>([<i>count</i>[, <i>specifier</i>]]) [<>](https://github.com/d3/d3-scale/blob/master/src/log.js#L103 "Source")

Like [*continuous*.tickFormat](#continuous_tickFormat), but customized for a log scale. The specified *count* typically has the same value as the count that is used to generate the [tick values](#continuous_ticks). If there are too many ticks, the formatter may return the empty string for some of the tick labels; however, note that the ticks are still shown. To disable filtering, specify a *count* of Infinity. When specifying a count, you may also provide a format *specifier* or format function. For example, to get a tick formatter that will display 20 ticks of a currency, say `log.tickFormat(20, "$,f")`. If the specifier does not have a defined precision, the precision will be set automatically by the scale, returning the appropriate format. This provides a convenient way of specifying a format whose precision will be automatically set by the scale.

<a name="log_nice" href="#log_nice">#</a> <i>log</i>.<b>nice</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/log.js#L116 "Source")

Like [*continuous*.nice](#continuous_nice), except extends the domain to integer powers of [base](#log_base). For example, for a domain of [0.201479…, 0.996679…], and base 10, the nice domain is [0.1, 1]. If the domain has more than two values, nicing the domain only affects the first and last value.

<a name="log_copy" href="#log_copy">#</a> <i>log</i>.<b>copy</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/log.js#L123 "Source")

See [*continuous*.copy](#continuous_copy).

#### Identity Scales

Identity scales are a special case of [linear scales](#linear-scales) where the domain and range are identical; the scale and its invert method are thus the identity function. These scales are occasionally useful when working with pixel coordinates, say in conjunction with an axis or brush. Identity scales do not support [rangeRound](#continuous_rangeRound), [clamp](#continuous_clamp) or [interpolate](#continuous_interpolate).

<a name="scaleIdentity" href="#scaleIdentity">#</a> d3.<b>scaleIdentity</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/identity.js "Source")

Constructs a new identity scale with the unit [domain](#continuous_domain) [0, 1] and the unit [range](#continuous_range) [0, 1].

#### Time Scales

Time scales are a variant of [linear scales](#linear-scales) that have a temporal domain: domain values are coerced to [dates](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Date) rather than numbers, and [invert](#continuous_invert) likewise returns a date. Time scales implement [ticks](#time_ticks) based on [calendar intervals](https://github.com/d3/d3-time), taking the pain out of generating axes for temporal domains.

For example, to create a position encoding:

```js
var x = d3.scaleTime()
    .domain([new Date(2000, 0, 1), new Date(2000, 0, 2)])
    .range([0, 960]);

x(new Date(2000, 0, 1,  5)); // 200
x(new Date(2000, 0, 1, 16)); // 640
x.invert(200); // Sat Jan 01 2000 05:00:00 GMT-0800 (PST)
x.invert(640); // Sat Jan 01 2000 16:00:00 GMT-0800 (PST)
```

For a valid value *y* in the range, <i>time</i>(<i>time</i>.invert(<i>y</i>)) equals *y*; similarly, for a valid value *x* in the domain, <i>time</i>.invert(<i>time</i>(<i>x</i>)) equals *x*. The invert method is useful for interaction, say to determine the value in the domain that corresponds to the pixel location under the mouse.

<a name="scaleTime" href="#scaleTime">#</a> d3.<b>scaleTime</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/time.js "Source")

Constructs a new time scale with the [domain](#time_domain) [2000-01-01, 2000-01-02], the unit [range](#time_range) [0, 1], the [default](https://github.com/d3/d3-interpolate#interpolate) [interpolator](#time_interpolate) and [clamping](#time_clamp) disabled.

<a name="time" href="#_time">#</a> <i>time</i>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/time.js#L133 "Source")

See [*continuous*](#_continuous).

<a name="time_invert" href="#time_invert">#</a> <i>time</i>.<b>invert</b>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/time.js#L95 "Source")

See [*continuous*.invert](#continuous_invert).

<a name="time_domain" href="#time_domain">#</a> <i>time</i>.<b>domain</b>([<i>domain</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/time.js#L99 "Source")

See [*continuous*.domain](#continuous_domain).

<a name="time_range" href="#time_range">#</a> <i>time</i>.<b>range</b>([<i>range</i>])

See [*continuous*.range](#continuous_range).

<a name="time_rangeRound" href="#time_rangeRound">#</a> <i>time</i>.<b>rangeRound</b>([<i>range</i>])

See [*continuous*.rangeRound](#continuous_rangeRound).

<a name="time_clamp" href="#time_clamp">#</a> <i>time</i>.<b>clamp</b>(<i>clamp</i>)

See [*continuous*.clamp](#continuous_clamp).

<a name="time_interpolate" href="#time_interpolate">#</a> <i>time</i>.<b>interpolate</b>(<i>interpolate</i>)

See [*continuous*.interpolate](#continuous_interpolate).

<a name="time_ticks" href="#time_ticks">#</a> <i>time</i>.<b>ticks</b>([<i>count</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/time.js#L103 "Source")
<br><a name="time_ticks" href="#time_ticks">#</a> <i>time</i>.<b>ticks</b>([<i>interval</i>])

Returns representative dates from the scale’s [domain](#time_domain). The returned tick values are uniformly-spaced (mostly), have sensible values (such as every day at midnight), and are guaranteed to be within the extent of the domain. Ticks are often used to display reference lines, or tick marks, in conjunction with the visualized data.

An optional *count* may be specified to affect how many ticks are generated. If *count* is not specified, it defaults to 10. The specified *count* is only a hint; the scale may return more or fewer values depending on the domain. For example, to create ten default ticks, say:

```js
var x = d3.scaleTime();

x.ticks(10);
// [Sat Jan 01 2000 00:00:00 GMT-0800 (PST),
//  Sat Jan 01 2000 03:00:00 GMT-0800 (PST),
//  Sat Jan 01 2000 06:00:00 GMT-0800 (PST),
//  Sat Jan 01 2000 09:00:00 GMT-0800 (PST),
//  Sat Jan 01 2000 12:00:00 GMT-0800 (PST),
//  Sat Jan 01 2000 15:00:00 GMT-0800 (PST),
//  Sat Jan 01 2000 18:00:00 GMT-0800 (PST),
//  Sat Jan 01 2000 21:00:00 GMT-0800 (PST),
//  Sun Jan 02 2000 00:00:00 GMT-0800 (PST)]
```

The following time intervals are considered for automatic ticks:

* 1-, 5-, 15- and 30-second.
* 1-, 5-, 15- and 30-minute.
* 1-, 3-, 6- and 12-hour.
* 1- and 2-day.
* 1-week.
* 1- and 3-month.
* 1-year.

In lieu of a *count*, a [time *interval*](https://github.com/d3/d3-time#intervals) may be explicitly specified. To prune the generated ticks for a given time *interval*, use [*interval*.every](https://github.com/d3/d3-time#interval_every). For example, to generate ticks at 15-[minute](https://github.com/d3/d3-time#minute) intervals:

```js
var x = d3.scaleTime()
    .domain([new Date(2000, 0, 1, 0), new Date(2000, 0, 1, 2)]);

x.ticks(d3.timeMinute.every(15));
// [Sat Jan 01 2000 00:00:00 GMT-0800 (PST),
//  Sat Jan 01 2000 00:15:00 GMT-0800 (PST),
//  Sat Jan 01 2000 00:30:00 GMT-0800 (PST),
//  Sat Jan 01 2000 00:45:00 GMT-0800 (PST),
//  Sat Jan 01 2000 01:00:00 GMT-0800 (PST),
//  Sat Jan 01 2000 01:15:00 GMT-0800 (PST),
//  Sat Jan 01 2000 01:30:00 GMT-0800 (PST),
//  Sat Jan 01 2000 01:45:00 GMT-0800 (PST),
//  Sat Jan 01 2000 02:00:00 GMT-0800 (PST)]
```

Alternatively, pass a test function to [*interval*.filter](https://github.com/d3/d3-time#interval_filter):

```js
x.ticks(d3.timeMinute.filter(function(d) {
  return d.getMinutes() % 15 === 0;
}));
```

Note: in some cases, such as with day ticks, specifying a *step* can result in irregular spacing of ticks because time intervals have varying length.

<a name="time_tickFormat" href="#time_tickFormat">#</a> <i>time</i>.<b>tickFormat</b>([<i>count</i>[, <i>specifier</i>]]) [<>](https://github.com/d3/d3-scale/blob/master/src/time.js#L115 "Source")
<br><a href="#time_tickFormat">#</a> <i>time</i>.<b>tickFormat</b>([<i>interval</i>[, <i>specifier</i>]])

Returns a time format function suitable for displaying [tick](#time_ticks) values. The specified *count* or *interval* is currently ignored, but is accepted for consistency with other scales such as [*continuous*.tickFormat](#continuous_tickFormat). If a format *specifier* is specified, this method is equivalent to [format](https://github.com/d3/d3-time-format#format). If *specifier* is not specified, the default time format is returned. The default multi-scale time format chooses a human-readable representation based on the specified date as follows:

* `%Y` - for year boundaries, such as `2011`.
* `%B` - for month boundaries, such as `February`.
* `%b %d` - for week boundaries, such as `Feb 06`.
* `%a %d` - for day boundaries, such as `Mon 07`.
* `%I %p` - for hour boundaries, such as `01 AM`.
* `%I:%M` - for minute boundaries, such as `01:23`.
* `:%S` - for second boundaries, such as `:45`.
* `.%L` - milliseconds for all other times, such as `.012`.

Although somewhat unusual, this default behavior has the benefit of providing both local and global context: for example, formatting a sequence of ticks as [11 PM, Mon 07, 01 AM] reveals information about hours, dates, and day simultaneously, rather than just the hours [11 PM, 12 AM, 01 AM]. See [d3-time-format](https://github.com/d3/d3-time-format) if you’d like to roll your own conditional time format.

<a name="time_nice" href="#time_nice">#</a> <i>time</i>.<b>nice</b>([<i>count</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/time.js#L119 "Source")
<br><a name="time_nice" href="#time_nice">#</a> <i>time</i>.<b>nice</b>([<i>interval</i>[, <i>step</i>]])

Extends the [domain](#time_domain) so that it starts and ends on nice round values. This method typically modifies the scale’s domain, and may only extend the bounds to the nearest round value. See [*continuous*.nice](#continuous_nice) for more.

An optional tick *count* argument allows greater control over the step size used to extend the bounds, guaranteeing that the returned [ticks](#time_ticks) will exactly cover the domain. Alternatively, a [time *interval*](https://github.com/d3/d3-time#intervals) may be specified to explicitly set the ticks. If an *interval* is specified, an optional *step* may also be specified to skip some ticks. For example, `time.nice(d3.timeSecond, 10)` will extend the domain to an even ten seconds (0, 10, 20, <i>etc.</i>). See [*time*.ticks](#time_ticks) and [*interval*.every](https://github.com/d3/d3-time#interval_every) for further detail.

Nicing is useful if the domain is computed from data, say using [extent](https://github.com/d3/d3-array#extent), and may be irregular. For example, for a domain of [2009-07-13T00:02, 2009-07-13T23:48], the nice domain is [2009-07-13, 2009-07-14]. If the domain has more than two values, nicing the domain only affects the first and last value.

<a name="scaleUtc" href="#scaleUtc">#</a> d3.<b>scaleUtc</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/utcTime.js "Source")

Equivalent to [time](#time), but the returned time scale operates in [Coordinated Universal Time](https://en.wikipedia.org/wiki/Coordinated_Universal_Time) rather than local time.

### Sequential Scales

Sequential scales are similar to [continuous scales](#continuous-scales) in that they map a continuous, numeric input domain to a continuous output range. However, unlike continuous scales, the output range of a sequential scale is fixed by its interpolator and not configurable. These scales do not expose [invert](#continuous_invert), [range](#continuous_range), [rangeRound](#continuous_rangeRound) and [interpolate](#continuous_interpolate) methods.

<a name="scaleSequential" href="#scaleSequential">#</a> d3.<b>scaleSequential</b>(<i>interpolator</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/sequential.js "Source")

Constructs a new sequential scale with the given [*interpolator*](#sequential_interpolator) function. When the scale is [applied](#_sequential), the interpolator will be invoked with a value typically in the range [0, 1], where 0 represents the start of the domain, and 1 represents the end of the domain. For example, to implement the ill-advised [HSL](https://github.com/d3/d3-color#hsl) rainbow scale:

```js
var rainbow = d3.scaleSequential(function(t) {
  return d3.hsl(t * 360, 1, 0.5) + "";
});
```

A more aesthetically-pleasing and perceptually-effective cyclical hue encoding is to use [d3.interpolateRainbow](#interpolateRainbow):

```js
var rainbow = d3.scaleSequential(d3.interpolateRainbow);
```

For even more sequential color schemes, see [d3-scale-chromatic](https://github.com/d3/d3-scale-chromatic).

<a name="_sequential" href="#_sequential">#</a> <i>sequential</i>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/sequential.js#L3 "Source")

See [*continuous*](#_continuous).

<a name="sequential_domain" href="#sequential_domain">#</a> <i>sequential</i>.<b>domain</b>([<i>domain</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/sequential.js#L13 "Source")

See [*continuous*.domain](#continuous_domain). Note that a sequential scale’s domain must be numeric and must contain exactly two values.

<a name="sequential_clamp" href="#sequential_clamp">#</a> <i>sequential</i>.<b>clamp</b>([<i>clamp</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/sequential.js#L17 "Source")

See [*continuous*.clamp](#continuous_clamp).

<a name="sequential_interpolator" href="#sequential_interpolator">#</a> <i>sequential</i>.<b>interpolator</b>([<i>interpolator</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/sequential.js#L21 "Source")

If *interpolator* is specified, sets the scale’s interpolator to the specified function. If *interpolator* is not specified, returns the scale’s current interpolator.

<a name="sequential_copy" href="#sequential_copy">#</a> <i>sequential</i>.<b>copy</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/sequential.js#L25 "Source")

See [*continuous*.copy](#continuous_copy).

<a name="interpolateViridis" href="#interpolateViridis">#</a> d3.<b>interpolateViridis</b>(<i>t</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/viridis.js "Source")

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/viridis.png" width="100%" height="40" alt="viridis">

Given a number *t* in the range [0,1], returns the corresponding color from the “viridis” perceptually-uniform color scheme designed by [van der Walt, Smith and Firing](https://bids.github.io/colormap/) for matplotlib, represented as an RGB string.

<a name="interpolateInferno" href="#interpolateInferno">#</a> d3.<b>interpolateInferno</b>(<i>t</i>)

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/inferno.png" width="100%" height="40" alt="inferno">

Given a number *t* in the range [0,1], returns the corresponding color from the “inferno” perceptually-uniform color scheme designed by [van der Walt and Smith](https://bids.github.io/colormap/) for matplotlib, represented as an RGB string.

<a name="interpolateMagma" href="#interpolateMagma">#</a> d3.<b>interpolateMagma</b>(<i>t</i>)

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/magma.png" width="100%" height="40" alt="magma">

Given a number *t* in the range [0,1], returns the corresponding color from the “magma” perceptually-uniform color scheme designed by [van der Walt and Smith](https://bids.github.io/colormap/) for matplotlib, represented as an RGB string.

<a name="interpolatePlasma" href="#interpolatePlasma">#</a> d3.<b>interpolatePlasma</b>(<i>t</i>)

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/plasma.png" width="100%" height="40" alt="plasma">

Given a number *t* in the range [0,1], returns the corresponding color from the “plasma” perceptually-uniform color scheme designed by [van der Walt and Smith](https://bids.github.io/colormap/) for matplotlib, represented as an RGB string.

<a name="interpolateWarm" href="#interpolateWarm">#</a> d3.<b>interpolateWarm</b>(<i>t</i>)

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/warm.png" width="100%" height="40" alt="warm">

Given a number *t* in the range [0,1], returns the corresponding color from a 180° rotation of [Niccoli’s perceptual rainbow](https://mycarta.wordpress.com/2013/02/21/perceptual-rainbow-palette-the-method/), represented as an RGB string.

<a name="interpolateCool" href="#interpolateCool">#</a> d3.<b>interpolateCool</b>(<i>t</i>)

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/cool.png" width="100%" height="40" alt="cool">

Given a number *t* in the range [0,1], returns the corresponding color from [Niccoli’s perceptual rainbow](https://mycarta.wordpress.com/2013/02/21/perceptual-rainbow-palette-the-method/), represented as an RGB string.

<a name="interpolateRainbow" href="#interpolateRainbow">#</a> d3.<b>interpolateRainbow</b>(<i>t</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/rainbow.js "Source")

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/rainbow.png" width="100%" height="40" alt="rainbow">

Given a number *t* in the range [0,1], returns the corresponding color from [d3.interpolateWarm](#interpolateWarm) scale from [0.0, 0.5] followed by the [d3.interpolateCool](#interpolateCool) scale from [0.5, 1.0], thus implementing the cyclical [less-angry rainbow](http://bl.ocks.org/mbostock/310c99e53880faec2434) color scheme.

<a name="interpolateCubehelixDefault" href="#interpolateCubehelixDefault">#</a> d3.<b>interpolateCubehelixDefault</b>(<i>t</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/cubehelix.js "Source")

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/cubehelix.png" width="100%" height="40" alt="cubehelix">

Given a number *t* in the range [0,1], returns the corresponding color from [Green’s default Cubehelix](https://www.mrao.cam.ac.uk/~dag/CUBEHELIX/) represented as an RGB string.

### Quantize Scales

Quantize scales are similar to [linear scales](#linear-scales), except they use a discrete rather than continuous range. The continuous input domain is divided into uniform segments based on the number of values in (*i.e.*, the cardinality of) the output range. Each range value *y* can be expressed as a quantized linear function of the domain value *x*: *y* = *m round(x)* + *b*. See [bl.ocks.org/4060606](http://bl.ocks.org/mbostock/4060606) for an example.

<a name="scaleQuantize" href="#scaleQuantize">#</a> d3.<b>scaleQuantize</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/quantize.js "Source")

Constructs a new quantize scale with the unit [domain](#quantize_domain) [0, 1] and the unit [range](#quantize_range) [0, 1]. Thus, the default quantize scale is equivalent to the [Math.round](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Math/round) function.

<a name="_quantize" href="#_quantize">#</a> <i>quantize</i>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/quantize.js#L5 "Source")

Given a *value* in the input [domain](#quantize_domain), returns the corresponding value in the output [range](#quantize_range). For example, to apply a color encoding:

```js
var color = d3.scaleQuantize()
    .domain([0, 1])
    .range(["brown", "steelblue"]);

color(0.49); // "brown"
color(0.51); // "steelblue"
```

Or dividing the domain into three equally-sized parts with different range values to compute an appropriate stroke width:

```js
var width = d3.scaleQuantize()
    .domain([10, 100])
    .range([1, 2, 4]);

width(20); // 1
width(50); // 2
width(80); // 4
```

<a name="quantize_invertExtent" href="#quantize_invertExtent">#</a> <i>quantize</i>.<b>invertExtent</b>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/quantize.js#L31 "Source")

Returns the extent of values in the [domain](#quantize_domain) [<i>x0</i>, <i>x1</i>] for the corresponding *value* in the [range](#quantize_range): the inverse of [*quantize*](#_quantize). This method is useful for interaction, say to determine the value in the domain that corresponds to the pixel location under the mouse.

```js
var width = d3.scaleQuantize()
    .domain([10, 100])
    .range([1, 2, 4]);

width.invertExtent(2); // [40, 70]
```

<a name="quantize_domain" href="#quantize_domain">#</a> <i>quantize</i>.<b>domain</b>([<i>domain</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/quantize.js#L23 "Source")

If *domain* is specified, sets the scale’s domain to the specified two-element array of numbers. If the elements in the given array are not numbers, they will be coerced to numbers. If *domain* is not specified, returns the scale’s current domain.

<a name="quantize_range" href="#quantize_range">#</a> <i>quantize</i>.<b>range</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/quantize.js#L27 "Source")

If *range* is specified, sets the scale’s range to the specified array of values. The array may contain any number of discrete values. The elements in the given array need not be numbers; any value or type will work. If *range* is not specified, returns the scale’s current range.

<a name="quantize_ticks" href="#quantize_ticks">#</a> <i>quantize</i>.<b>ticks</b>([<i>count</i>])

Equivalent to [*continuous*.ticks](#continuous_ticks).

<a name="quantize_tickFormat" href="#quantize_tickFormat">#</a> <i>quantize</i>.<b>tickFormat</b>([<i>count</i>[, <i>specifier</i>]]) [<>](https://github.com/d3/d3-scale/blob/master/src/linear.js#L14 "Source")

Equivalent to [*continuous*.tickFormat](#continuous_tickFormat).

<a name="quantize_nice" href="#quantize_nice">#</a> <i>quantize</i>.<b>nice</b>()

Equivalent to [*continuous*.nice](#continuous_nice).

<a name="quantize_copy" href="#quantize_copy">#</a> <i>quantize</i>.<b>copy</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/quantize.js#L39 "Source")

Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.

### Quantile Scales

Quantile scales map a sampled input domain to a discrete range. The domain is considered continuous and thus the scale will accept any reasonable input value; however, the domain is specified as a discrete set of sample values. The number of values in (the cardinality of) the output range determines the number of quantiles that will be computed from the domain. To compute the quantiles, the domain is sorted, and treated as a [population of discrete values](https://en.wikipedia.org/wiki/Quantile#Quantiles_of_a_population); see d3-array’s [quantile](https://github.com/d3/d3-array#quantile). See [bl.ocks.org/8ca036b3505121279daf](http://bl.ocks.org/mbostock/8ca036b3505121279daf) for an example.

<a name="scaleQuantile" href="#scaleQuantile">#</a> d3.<b>scaleQuantile</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/quantile.js "Source")

Constructs a new quantile scale with an empty [domain](#quantile_domain) and an empty [range](#quantile_range). The quantile scale is invalid until both a domain and range are specified.

<a name="_quantile" href="#_quantile">#</a> <i>quantile</i>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/quantile.js#L4 "Source")

Given a *value* in the input [domain](#quantile_domain), returns the corresponding value in the output [range](#quantile_range).

<a name="quantile_invertExtent" href="#quantile_invertExtent">#</a> <i>quantile</i>.<b>invertExtent</b>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/quantile.js#L20 "Source")

Returns the extent of values in the [domain](#quantile_domain) [<i>x0</i>, <i>x1</i>] for the corresponding *value* in the [range](#quantile_range): the inverse of [*quantile*](#_quantile). This method is useful for interaction, say to determine the value in the domain that corresponds to the pixel location under the mouse.

<a name="quantile_domain" href="#quantile_domain">#</a> <i>quantile</i>.<b>domain</b>([<i>domain</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/quantile.js#L28 "Source")

If *domain* is specified, sets the domain of the quantile scale to the specified set of discrete numeric values. The array must not be empty, and must contain at least one numeric value; NaN, null and undefined values are ignored and not considered part of the sample population. If the elements in the given array are not numbers, they will be coerced to numbers. A copy of the input array is sorted and stored internally. If *domain* is not specified, returns the scale’s current domain.

<a name="quantile_range" href="#quantile_range">#</a> <i>quantile</i>.<b>range</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/quantile.js#L36 "Source")

If *range* is specified, sets the discrete values in the range. The array must not be empty, and may contain any type of value. The number of values in (the cardinality, or length, of) the *range* array determines the number of quantiles that are computed. For example, to compute quartiles, *range* must be an array of four elements such as [0, 1, 2, 3]. If *range* is not specified, returns the current range.

<a name="quantile_quantiles" href="#quantile_quantiles">#</a> <i>quantile</i>.<b>quantiles</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/quantile.js#L40 "Source")

Returns the quantile thresholds. If the [range](#quantile_range) contains *n* discrete values, the returned array will contain *n* - 1 thresholds. Values less than the first threshold are considered in the first quantile; values greater than or equal to the first threshold but less than the second threshold are in the second quantile, and so on. Internally, the thresholds array is used with [bisect](https://github.com/d3/d3-array#bisect) to find the output quantile associated with the given input value.

<a name="quantile_copy" href="#quantile_copy">#</a> <i>quantile</i>.<b>copy</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/quantile.js#L44 "Source")

Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.

### Threshold Scales

Threshold scales are similar to [quantize scales](#quantize-scales), except they allow you to map arbitrary subsets of the domain to discrete values in the range. The input domain is still continuous, and divided into slices based on a set of threshold values. See [bl.ocks.org/3306362](http://bl.ocks.org/mbostock/3306362) for an example.

<a name="scaleThreshold" href="#scaleThreshold">#</a> d3.<b>scaleThreshold</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/threshold.js "Source")

Constructs a new threshold scale with the default [domain](#threshold_domain) [0.5] and the default [range](#threshold_range) [0, 1]. Thus, the default threshold scale is equivalent to the [Math.round](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Math/round) function for numbers; for example threshold(0.49) returns 0, and threshold(0.51) returns 1.

<a name="_threshold" href="#_threshold">#</a> <i>threshold</i>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/threshold.js#L4 "Source")

Given a *value* in the input [domain](#threshold_domain), returns the corresponding value in the output [range](#threshold_range). For example:

```js
var color = d3.scaleThreshold()
    .domain([0, 1])
    .range(["red", "white", "green"]);

color(-1);   // "red"
color(0);    // "white"
color(0.5);  // "white"
color(1);    // "green"
color(1000); // "green"
```

<a name="threshold_invertExtent" href="#threshold_invertExtent">#</a> <i>threshold</i>.<b>invertExtent</b>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/threshold.js#L21 "Source")

Returns the extent of values in the [domain](#threshold_domain) [<i>x0</i>, <i>x1</i>] for the corresponding *value* in the [range](#threshold_range), representing the inverse mapping from range to domain. This method is useful for interaction, say to determine the value in the domain that corresponds to the pixel location under the mouse. For example:

```js
var color = d3.scaleThreshold()
    .domain([0, 1])
    .range(["red", "white", "green"]);

color.invertExtent("red"); // [undefined, 0]
color.invertExtent("white"); // [0, 1]
color.invertExtent("green"); // [1, undefined]
```

<a name="threshold_domain" href="#threshold_domain">#</a> <i>threshold</i>.<b>domain</b>([<i>domain</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/threshold.js#L13 "Source")

If *domain* is specified, sets the scale’s domain to the specified array of values. The values must be in sorted ascending order, or the behavior of the scale is undefined. The values are typically numbers, but any naturally ordered values (such as strings) will work; a threshold scale can be used to encode any type that is ordered. If the number of values in the scale’s range is N+1, the number of values in the scale’s domain must be N. If there are fewer than N elements in the domain, the additional values in the range are ignored. If there are more than N elements in the domain, the scale may return undefined for some inputs. If *domain* is not specified, returns the scale’s current domain.

<a name="threshold_range" href="#threshold_range">#</a> <i>threshold</i>.<b>range</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/threshold.js#L17 "Source")

If *range* is specified, sets the scale’s range to the specified array of values. If the number of values in the scale’s domain is N, the number of values in the scale’s range must be N+1. If there are fewer than N+1 elements in the range, the scale may return undefined for some inputs. If there are more than N+1 elements in the range, the additional values are ignored. The elements in the given array need not be numbers; any value or type will work. If *range* is not specified, returns the scale’s current range.

<a name="threshold_copy" href="#threshold_copy">#</a> <i>threshold</i>.<b>copy</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/threshold.js#L26 "Source")

Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.

### Ordinal Scales

Unlike [continuous scales](#continuous-scales), ordinal scales have a discrete domain and range. For example, an ordinal scale might map a set of named categories to a set of colors, or determine the horizontal positions of columns in a column chart.

<a name="scaleOrdinal" href="#scaleOrdinal">#</a> d3.<b>scaleOrdinal</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/ordinal.js "Source")

Constructs a new ordinal scale with an empty [domain](#ordinal_domain) and the specified [*range*](#ordinal_range). If a *range* is not specified, it defaults to the empty array; an ordinal scale always returns undefined until a non-empty range is defined.

<a name="_ordinal" href="#_ordinal">#</a> <i>ordinal</i>(<i>value</i>) [<>](https://github.com/d3/d3-scale/blob/master/src/ordinal.js#L6 "Source")

Given a *value* in the input [domain](#ordinal_domain), returns the corresponding value in the output [range](#ordinal_range). If the given *value* is not in the scale’s [domain](#ordinal_domain), returns the [unknown](#ordinal_value); or, if the unknown value is [implicit](#scaleImplicit) (the default), then the *value* is implicitly added to the domain and the next-available value in the range is assigned to *value*, such that this and subsequent invocations of the scale given the same input *value* return the same output value.

<a name="ordinal_domain" href="#ordinal_domain">#</a> <i>ordinal</i>.<b>domain</b>([<i>domain</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/ordinal.js#L22 "Source")

If *domain* is specified, sets the domain to the specified array of values. The first element in *domain* will be mapped to the first element in the range, the second domain value to the second range value, and so on. Domain values are stored internally in a map from stringified value to index; the resulting index is then used to retrieve a value from the range. Thus, an ordinal scale’s values must be coercible to a string, and the stringified version of the domain value uniquely identifies the corresponding range value. If *domain* is not specified, this method returns the current domain.

Setting the domain on an ordinal scale is optional if the [unknown value](#ordinal_unknown) is [implicit](#scaleImplicit) (the default). In this case, the domain will be inferred implicitly from usage by assigning each unique value passed to the scale a new value from the range. Note that an explicit domain is recommended to ensure deterministic behavior, as inferring the domain from usage will be dependent on ordering.

<a name="ordinal_range" href="#ordinal_range">#</a> <i>ordinal</i>.<b>range</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/ordinal.js#L30 "Source")

If *range* is specified, sets the range of the ordinal scale to the specified array of values. The first element in the domain will be mapped to the first element in *range*, the second domain value to the second range value, and so on. If there are fewer elements in the range than in the domain, the scale will reuse values from the start of the range. If *range* is not specified, this method returns the current range.

<a name="ordinal_unknown" href="#ordinal_unknown">#</a> <i>ordinal</i>.<b>unknown</b>([<i>value</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/ordinal.js#L34 "Source")

If *value* is specified, sets the output value of the scale for unknown input values and returns this scale. If *value* is not specified, returns the current unknown value, which defaults to [implicit](#implicit). The implicit value enables implicit domain construction; see [*ordinal*.domain](#ordinal_domain).

<a name="ordinal_copy" href="#ordinal_copy">#</a> <i>ordinal</i>.<b>copy</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/ordinal.js#L38 "Source")

Returns an exact copy of this ordinal scale. Changes to this scale will not affect the returned scale, and vice versa.

<a name="scaleImplicit" href="#scaleImplicit">#</a> d3.<b>scaleImplicit</b>

A special value for [*ordinal*.unknown](#ordinal_unknown) that enables implicit domain construction: unknown values are implicitly added to the domain.

#### Band Scales

Band scales are like [ordinal scales](#ordinal-scales) except the output range is continuous and numeric. Discrete output values are automatically computed by the scale by dividing the continuous range into uniform bands. Band scales are typically used for bar charts with an ordinal or categorical dimension. The [unknown value](#ordinal_unknown) of a band scale is effectively undefined: they do not allow implicit domain construction.

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/band.png" width="751" height="238" alt="band">

<a name="scaleBand" href="#scaleBand">#</a> d3.<b>scaleBand</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/band.js "Source")

Constructs a new band scale with the empty [domain](#band_domain), the unit [range](#band_range) [0, 1], no [padding](#band_padding), no [rounding](#band_round) and center [alignment](#band_align).

<a name="_band" href="#_band">#</a> <i>band</i>(*value*) [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L4 "Source")

Given a *value* in the input [domain](#band_domain), returns the start of the corresponding band derived from the output [range](#band_range). If the given *value* is not in the scale’s domain, returns undefined.

<a name="band_domain" href="#band_domain">#</a> <i>band</i>.<b>domain</b>([<i>domain</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L32 "Source")

If *domain* is specified, sets the domain to the specified array of values. The first element in *domain* will be mapped to the first band, the second domain value to the second band, and so on. Domain values are stored internally in a map from stringified value to index; the resulting index is then used to determine the band. Thus, a band scale’s values must be coercible to a string, and the stringified version of the domain value uniquely identifies the corresponding band. If *domain* is not specified, this method returns the current domain.

<a name="band_range" href="#band_range">#</a> <i>band</i>.<b>range</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L36 "Source")

If *range* is specified, sets the scale’s range to the specified two-element array of numbers. If the elements in the given array are not numbers, they will be coerced to numbers. If *range* is not specified, returns the scale’s current range, which defaults to [0, 1].

<a name="band_rangeRound" href="#band_rangeRound">#</a> <i>band</i>.<b>rangeRound</b>([<i>range</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L40 "Source")

Sets the scale’s [*range*](#band_range) to the specified two-element array of numbers while also enabling [rounding](#band_round). This is a convenience method equivalent to:

```js
band
    .range(range)
    .round(true);
```

Rounding is sometimes useful for avoiding antialiasing artifacts, though also consider the [shape-rendering](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/shape-rendering) “crispEdges” styles.

<a name="band_round" href="#band_round">#</a> <i>band</i>.<b>round</b>([<i>round</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L52 "Source")

If *round* is specified, enables or disables rounding accordingly. If rounding is enabled, the start and stop of each band will be integers. Rounding is sometimes useful for avoiding antialiasing artifacts, though also consider the [shape-rendering](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/shape-rendering) “crispEdges” styles. Note that if the width of the domain is not a multiple of the cardinality of the range, there may be leftover unused space, even without padding! Use [*band*.align](#band_align) to specify how the leftover space is distributed.

<a name="band_paddingInner" href="#band_paddingInner">#</a> <i>band</i>.<b>paddingInner</b>([<i>padding</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L60 "Source")

If *padding* is specified, sets the inner padding to the specified value which must be in the range [0, 1]. If *padding* is not specified, returns the current inner padding which defaults to 0. The inner padding determines the ratio of the range that is reserved for blank space between bands.

<a name="band_paddingOuter" href="#band_paddingOuter">#</a> <i>band</i>.<b>paddingOuter</b>([<i>padding</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L64 "Source")

If *padding* is specified, sets the outer padding to the specified value which must be in the range [0, 1]. If *padding* is not specified, returns the current outer padding which defaults to 0. The outer padding determines the ratio of the range that is reserved for blank space before the first band and after the last band.

<a name="band_padding" href="#band_padding">#</a> <i>band</i>.<b>padding</b>([<i>padding</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L56 "Source")

A convenience method for setting the [inner](#band_paddingInner) and [outer](#band_paddingOuter) padding to the same *padding* value. If *padding* is not specified, returns the inner padding.

<a name="band_align" href="#band_align">#</a> <i>band</i>.<b>align</b>([<i>align</i>]) [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L68 "Source")

If *align* is specified, sets the alignment to the specified value which must be in the range [0, 1]. If *align* is not specified, returns the current alignment which defaults to 0.5. The alignment determines how any leftover unused space in the range is distributed. A value of 0.5 indicates that the leftover space should be equally distributed before the first band and after the last band; *i.e.*, the bands should be centered within the range. A value of 0 or 1 may be used to shift the bands to one side, say to position them adjacent to an axis.

<a name="band_bandwidth" href="#band_bandwidth">#</a> <i>band</i>.<b>bandwidth</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L44 "Source")

Returns the width of each band.

<a name="band_step" href="#band_step">#</a> <i>band</i>.<b>step</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L48 "Source")

Returns the distance between the starts of adjacent bands.

<a name="band_copy" href="#band_copy">#</a> <i>band</i>.<b>copy</b>() [<>](https://github.com/d3/d3-scale/blob/master/src/band.js#L72 "Source")

Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.

#### Point Scales

Point scales are a variant of [band scales](#band-scales) with the bandwidth fixed to zero. Point scales are typically used for scatterplots with an ordinal or categorical dimension. The [unknown value](#ordinal_unknown) of a point scale is always undefined: they do not allow implicit domain construction.

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/point.png" width="648" height="155" alt="point">

<a name="scalePoint" href="#scalePoint">#</a> d3.<b>scalePoint</b>()

Constructs a new point scale with the empty [domain](#point_domain), the unit [range](#point_range) [0, 1], no [padding](#point_padding), no [rounding](#point_round) and center [alignment](#point_align).

<a name="_point" href="#_point">#</a> <i>point</i>(*value*)

Given a *value* in the input [domain](#point_domain), returns the corresponding point derived from the output [range](#point_range). If the given *value* is not in the scale’s domain, returns undefined.

<a name="point_domain" href="#point_domain">#</a> <i>point</i>.<b>domain</b>([<i>domain</i>])

If *domain* is specified, sets the domain to the specified array of values. The first element in *domain* will be mapped to the first point, the second domain value to the second point, and so on. Domain values are stored internally in a map from stringified value to index; the resulting index is then used to determine the point. Thus, a point scale’s values must be coercible to a string, and the stringified version of the domain value uniquely identifies the corresponding point. If *domain* is not specified, this method returns the current domain.

<a name="point_range" href="#point_range">#</a> <i>point</i>.<b>range</b>([<i>range</i>])

If *range* is specified, sets the scale’s range to the specified two-element array of numbers. If the elements in the given array are not numbers, they will be coerced to numbers. If *range* is not specified, returns the scale’s current range, which defaults to [0, 1].

<a name="point_rangeRound" href="#point_rangeRound">#</a> <i>point</i>.<b>rangeRound</b>([<i>range</i>])

Sets the scale’s [*range*](#point_range) to the specified two-element array of numbers while also enabling [rounding](#point_round). This is a convenience method equivalent to:

```js
point
    .range(range)
    .round(true);
```

Rounding is sometimes useful for avoiding antialiasing artifacts, though also consider the [shape-rendering](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/shape-rendering) “crispEdges” styles.

<a name="point_round" href="#point_round">#</a> <i>point</i>.<b>round</b>([<i>round</i>])

If *round* is specified, enables or disables rounding accordingly. If rounding is enabled, the position of each point will be integers. Rounding is sometimes useful for avoiding antialiasing artifacts, though also consider the [shape-rendering](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/shape-rendering) “crispEdges” styles. Note that if the width of the domain is not a multiple of the cardinality of the range, there may be leftover unused space, even without padding! Use [*point*.align](#point_align) to specify how the leftover space is distributed.

<a name="point_padding" href="#point_padding">#</a> <i>point</i>.<b>padding</b>([<i>padding</i>])

If *padding* is specified, sets the outer padding to the specified value which must be in the range [0, 1]. If *padding* is not specified, returns the current outer padding which defaults to 0. The outer padding determines the ratio of the range that is reserved for blank space before the first point and after the last point. Equivalent to [*band*.paddingOuter](#band_paddingOuter).

<a name="point_align" href="#point_align">#</a> <i>point</i>.<b>align</b>([<i>align</i>])

If *align* is specified, sets the alignment to the specified value which must be in the range [0, 1]. If *align* is not specified, returns the current alignment which defaults to 0.5. The alignment determines how any leftover unused space in the range is distributed. A value of 0.5 indicates that the leftover space should be equally distributed before the first point and after the last point; *i.e.*, the points should be centered within the range. A value of 0 or 1 may be used to shift the points to one side, say to position them adjacent to an axis.

<a name="point_bandwidth" href="#point_bandwidth">#</a> <i>point</i>.<b>bandwidth</b>()

Returns zero.

<a name="point_step" href="#point_step">#</a> <i>point</i>.<b>step</b>()

Returns the distance between the starts of adjacent points.

<a name="point_copy" href="#point_copy">#</a> <i>point</i>.<b>copy</b>()

Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.

#### Category Scales

These color schemes are designed to work with [d3.scaleOrdinal](#scaleOrdinal). For example:

```js
var color = d3.scaleOrdinal(d3.schemeCategory10);
```

For even more category scales, see [d3-scale-chromatic](https://github.com/d3/d3-scale-chromatic).

<a name="schemeCategory10" href="#schemeCategory10">#</a> d3.<b>schemeCategory10</b> [<>](https://github.com/d3/d3-scale/blob/master/src/category10.js "Source")

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/category10.png" width="100%" height="40" alt="category10">

An array of ten categorical colors represented as RGB hexadecimal strings.

<a name="schemeCategory20" href="#schemeCategory20">#</a> d3.<b>schemeCategory20</b> [<>](https://github.com/d3/d3-scale/blob/master/src/category20.js "Source")

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/category20.png" width="100%" height="40" alt="category20">

An array of twenty categorical colors represented as RGB hexadecimal strings.

<a name="schemeCategory20b" href="#schemeCategory20b">#</a> d3.<b>schemeCategory20b</b> [<>](https://github.com/d3/d3-scale/blob/master/src/category20b.js "Source")

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/category20b.png" width="100%" height="40" alt="category20b">

An array of twenty categorical colors represented as RGB hexadecimal strings.

<a name="schemeCategory20c" href="#schemeCategory20c">#</a> d3.<b>schemeCategory20c</b> [<>](https://github.com/d3/d3-scale/blob/master/src/category20c.js "Source")

<img src="https://raw.githubusercontent.com/d3/d3-scale/master/img/category20c.png" width="100%" height="40" alt="category20c">

An array of twenty categorical colors represented as RGB hexadecimal strings. This color scale includes color specifications and designs developed by Cynthia Brewer ([colorbrewer2.org](http://colorbrewer2.org/)).
