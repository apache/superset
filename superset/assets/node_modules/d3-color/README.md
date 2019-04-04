# d3-color

Even though your browser understands a lot about colors, it doesn’t offer much help in manipulating colors through JavaScript. The d3-color module therefore provides representations for various color spaces, allowing specification, conversion and manipulation. (Also see [d3-interpolate](https://github.com/d3/d3-interpolate) for color interpolation.)

For example, take the color named “steelblue”:

```js
var c = d3.color("steelblue"); // {r: 70, g: 130, b: 180, opacity: 1}
```

Let’s try converting it to HSL:

```js
var c = d3.hsl("steelblue"); // {h: 207.27…, s: 0.44, l: 0.4902…, opacity: 1}
```

Now rotate the hue by 90°, bump up the saturation, and format as a string for CSS:

```js
c.h += 90;
c.s += 0.2;
c + ""; // rgb(198, 45, 205)
```

To fade the color slightly:

```js
c.opacity = 0.8;
c + ""; // rgba(198, 45, 205, 0.8)
```

In addition to the ubiquitous and machine-friendly [RGB](#rgb) and [HSL](#hsl) color space, d3-color supports two color spaces that are designed for humans:

* Dave Green’s [Cubehelix](#cubehelix)
* [Lab (CIELAB)](#lab) and [HCL (CIELCH)](#hcl)

Cubehelix features monotonic lightness, while Lab and HCL are perceptually uniform. Note that HCL is the cylindrical form of Lab, similar to how HSL is the cylindrical form of RGB.

For additional color spaces, see:

* [d3-cam16](https://github.com/d3/d3-cam16)
* [d3-cam02](https://github.com/connorgr/d3-cam02)
* [d3-hsv](https://github.com/d3/d3-hsv)
* [d3-hcg](https://github.com/d3/d3-hcg)

## Installing

If you use NPM, `npm install d3-color`. Otherwise, download the [latest release](https://github.com/d3/d3-color/releases/latest). You can also load directly from [d3js.org](https://d3js.org), either as a [standalone library](https://d3js.org/d3-color.v1.min.js) or as part of [D3 4.0](https://github.com/d3/d3). AMD, CommonJS, and vanilla environments are supported. In vanilla, a `d3` global is exported:

```html
<script src="https://d3js.org/d3-color.v1.min.js"></script>
<script>

var steelblue = d3.rgb("steelblue");

</script>
```

[Try d3-color in your browser.](https://tonicdev.com/npm/d3-color)

## API Reference

<a name="color" href="#color">#</a> d3.<b>color</b>(<i>specifier</i>) [<>](https://github.com/d3/d3-color/blob/master/src/color.js "Source")

Parses the specified [CSS Color Module Level 3](http://www.w3.org/TR/css3-color/#colorunits) *specifier* string, returning an [RGB](#rgb) or [HSL](#hsl) color. If the specifier was not valid, null is returned. Some examples:

* `rgb(255, 255, 255)`
* `rgb(10%, 20%, 30%)`
* `rgba(255, 255, 255, 0.4)`
* `rgba(10%, 20%, 30%, 0.4)`
* `hsl(120, 50%, 20%)`
* `hsla(120, 50%, 20%, 0.4)`
* `#ffeeaa`
* `#fea`
* `steelblue`

The list of supported [named colors](http://www.w3.org/TR/SVG/types.html#ColorKeywords) is specified by CSS.

Note: this function may also be used with `instanceof` to test if an object is a color instance. The same is true of color subclasses, allowing you to test whether a color is in a particular color space.

<a name="color_opacity" href="#color_opacity">#</a> *color*.<b>opacity</b>

This color’s opacity, typically in the range [0, 1].

<a name="color_rgb" href="#color_rgb">#</a> *color*.<b>rgb</b>() [<>](https://github.com/d3/d3-color/blob/master/src/color.js "Source")

Returns the [RGB equivalent](#rgb) of this color. For RGB colors, that’s `this`.

<a name="color_brighter" href="#color_brighter">#</a> *color*.<b>brighter</b>([<i>k</i>]) [<>](https://github.com/d3/d3-color/blob/master/src/color.js "Source")

Returns a brighter copy of this color. If *k* is specified, it controls how much brighter the returned color should be. If *k* is not specified, it defaults to 1. The behavior of this method is dependent on the implementing color space.

<a name="color_darker" href="#color_darker">#</a> *color*.<b>darker</b>([<i>k</i>]) [<>](https://github.com/d3/d3-color/blob/master/src/color.js "Source")

Returns a darker copy of this color. If *k* is specified, it controls how much darker the returned color should be. If *k* is not specified, it defaults to 1. The behavior of this method is dependent on the implementing color space.

<a name="color_displayable" href="#color_displayable">#</a> *color*.<b>displayable</b>() [<>](https://github.com/d3/d3-color/blob/master/src/color.js "Source")

Returns true if and only if the color is displayable on standard hardware. For example, this returns false for an RGB color if any channel value is less than zero or greater than 255, or if the opacity is not in the range [0, 1].

<a name="color_hex" href="#color_hex">#</a> *color*.<b>hex</b>() [<>](https://github.com/d3/d3-color/blob/master/src/color.js "Source")

Returns a hexadecimal string representing this color in RGB space, such as `#f7eaba`. If this color is not displayable, a suitable displayable color is returned instead. For example, RGB channel values greater than 255 are clamped to 255.

<a name="color_toString" href="#color_toString">#</a> *color*.<b>toString</b>() [<>](https://github.com/d3/d3-color/blob/master/src/color.js "Source")

Returns a string representing this color according to the [CSS Object Model specification](https://drafts.csswg.org/cssom/#serialize-a-css-component-value), such as `rgb(247, 234, 186)` or `rgba(247, 234, 186, 0.2)`. If this color is not displayable, a suitable displayable color is returned instead. For example, RGB channel values greater than 255 are clamped to 255.

<a name="rgb" href="#rgb">#</a> d3.<b>rgb</b>(<i>r</i>, <i>g</i>, <i>b</i>[, <i>opacity</i>]) [<>](https://github.com/d3/d3-color/blob/master/src/color.js "Source")<br>
<a href="#rgb">#</a> d3.<b>rgb</b>(<i>specifier</i>)<br>
<a href="#rgb">#</a> d3.<b>rgb</b>(<i>color</i>)<br>

Constructs a new [RGB](https://en.wikipedia.org/wiki/RGB_color_model) color. The channel values are exposed as `r`, `g` and `b` properties on the returned instance. Use the [RGB color picker](http://bl.ocks.org/mbostock/78d64ca7ef013b4dcf8f) to explore this color space.

If *r*, *g* and *b* are specified, these represent the channel values of the returned color; an *opacity* may also be specified. If a CSS Color Module Level 3 *specifier* string is specified, it is parsed and then converted to the RGB color space. See [color](#color) for examples. If a [*color*](#color) instance is specified, it is converted to the RGB color space using [*color*.rgb](#color_rgb). Note that unlike [*color*.rgb](#color_rgb) this method *always* returns a new instance, even if *color* is already an RGB color.

<a name="hsl" href="#hsl">#</a> d3.<b>hsl</b>(<i>h</i>, <i>s</i>, <i>l</i>[, <i>opacity</i>]) [<>](https://github.com/d3/d3-color/blob/master/src/color.js "Source")<br>
<a href="#hsl">#</a> d3.<b>hsl</b>(<i>specifier</i>)<br>
<a href="#hsl">#</a> d3.<b>hsl</b>(<i>color</i>)<br>

Constructs a new [HSL](https://en.wikipedia.org/wiki/HSL_and_HSV) color. The channel values are exposed as `h`, `s` and `l` properties on the returned instance. Use the [HSL color picker](http://bl.ocks.org/mbostock/debaad4fcce9bcee14cf) to explore this color space.

If *h*, *s* and *l* are specified, these represent the channel values of the returned color; an *opacity* may also be specified. If a CSS Color Module Level 3 *specifier* string is specified, it is parsed and then converted to the HSL color space. See [color](#color) for examples. If a [*color*](#color) instance is specified, it is converted to the RGB color space using [*color*.rgb](#color_rgb) and then converted to HSL. (Colors already in the HSL color space skip the conversion to RGB.)

<a name="lab" href="#lab">#</a> d3.<b>lab</b>(<i>l</i>, <i>a</i>, <i>b</i>[, <i>opacity</i>]) [<>](https://github.com/d3/d3-color/blob/master/src/lab.js "Source")<br>
<a href="#lab">#</a> d3.<b>lab</b>(<i>specifier</i>)<br>
<a href="#lab">#</a> d3.<b>lab</b>(<i>color</i>)<br>

Constructs a new [Lab](https://en.wikipedia.org/wiki/Lab_color_space#CIELAB) color. The channel values are exposed as `l`, `a` and `b` properties on the returned instance. Use the [Lab color picker](http://bl.ocks.org/mbostock/9f37cc207c0cb166921b) to explore this color space. The value of *l* is typically in the range [0, 100], while *a* and *b* are typically in [-160, +160].

If *l*, *a* and *b* are specified, these represent the channel values of the returned color; an *opacity* may also be specified. If a CSS Color Module Level 3 *specifier* string is specified, it is parsed and then converted to the Lab color space. See [color](#color) for examples. If a [*color*](#color) instance is specified, it is converted to the RGB color space using [*color*.rgb](#color_rgb) and then converted to Lab. (Colors already in the Lab color space skip the conversion to RGB, and colors in the HCL color space are converted directly to Lab.)

<a name="gray" href="#gray">#</a> d3.<b>gray</b>(<i>l</i>[, <i>opacity</i>]) [<>](https://github.com/d3/d3-color/blob/master/src/lab.js "Source")<br>

Constructs a new [Lab](#lab) color with the specified *l* value and *a* = *b* = 0.

<a name="hcl" href="#hcl">#</a> d3.<b>hcl</b>(<i>h</i>, <i>c</i>, <i>l</i>[, <i>opacity</i>]) [<>](https://github.com/d3/d3-color/blob/master/src/lab.js "Source")<br>
<a href="#hcl">#</a> d3.<b>hcl</b>(<i>specifier</i>)<br>
<a href="#hcl">#</a> d3.<b>hcl</b>(<i>color</i>)<br>

Constructs a new [HCL](https://en.wikipedia.org/wiki/HCL_color_space) color. The channel values are exposed as `h`, `c` and `l` properties on the returned instance. Use the [HCL color picker](http://bl.ocks.org/mbostock/3e115519a1b495e0bd95) to explore this color space. The value of *l* is typically in the range [0, 100], *c* is typically in [0, 230], and *h* is typically in [0, 360).

If *h*, *c* and *l* are specified, these represent the channel values of the returned color; an *opacity* may also be specified. If a CSS Color Module Level 3 *specifier* string is specified, it is parsed and then converted to the HCL color space. See [color](#color) for examples. If a [*color*](#color) instance is specified, it is converted to the RGB color space using [*color*.rgb](#color_rgb) and then converted to HCL. (Colors already in the HCL color space skip the conversion to RGB, and colors in the Lab color space are converted directly to HCL.)

<a name="lch" href="#lch">#</a> d3.<b>lch</b>(<i>l</i>, <i>c</i>, <i>h</i>[, <i>opacity</i>]) [<>](https://github.com/d3/d3-color/blob/master/src/lab.js "Source")<br>
<a href="#lch">#</a> d3.<b>lch</b>(<i>specifier</i>)<br>
<a href="#lch">#</a> d3.<b>lch</b>(<i>color</i>)<br>

Equivalent to [d3.hcl](#hcl), but with reversed argument order.

<a name="cubehelix" href="#cubehelix">#</a> d3.<b>cubehelix</b>(<i>h</i>, <i>s</i>, <i>l</i>[, <i>opacity</i>]) [<>](https://github.com/d3/d3-color/blob/master/src/cubehelix.js "Source")<br>
<a href="#cubehelix">#</a> d3.<b>cubehelix</b>(<i>specifier</i>)<br>
<a href="#cubehelix">#</a> d3.<b>cubehelix</b>(<i>color</i>)<br>

Constructs a new [Cubehelix](https://www.mrao.cam.ac.uk/~dag/CUBEHELIX/) color. The channel values are exposed as `h`, `s` and `l` properties on the returned instance. Use the [Cubehelix color picker](http://bl.ocks.org/mbostock/ba8d75e45794c27168b5) to explore this color space.

If *h*, *s* and *l* are specified, these represent the channel values of the returned color; an *opacity* may also be specified. If a CSS Color Module Level 3 *specifier* string is specified, it is parsed and then converted to the Cubehelix color space. See [color](#color) for examples. If a [*color*](#color) instance is specified, it is converted to the RGB color space using [*color*.rgb](#color_rgb) and then converted to Cubehelix. (Colors already in the Cubehelix color space skip the conversion to RGB.)
