# vega-util

JavaScript utilities for Vega. Provides a set of helper methods used throughout Vega modules, including function generators, type checkers, log messages, and additional utilities for Object, Array and String values.

## API Reference

- [Functions](#functions)
- [Type Checkers](#type-checkers)
- [Type Coercion](#type-coercion)
- [Objects](#objects)
- [Arrays](#arrays)
- [Dates](#dates)
- [Logging](#logging)
- [Errors](#errors)

### Functions

Functions and function generators for accessing and comparing values.

<a name="accessor" href="#accessor">#</a>
vega.<b>accessor</b>(<i>function</i>[, <i>fields</i>, <i>name</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/accessor.js "Source")

Annotates a *function* instance with a string array of dependent data *fields* and a string *name*, and returns the input *function*. Assumes the input function takes an object (data tuple) as input, and that strings in the *fields* array correspond to object properties accessed by the function. Once annotated, Vega dataflows can track data field dependencies and generate appropriate output names (e.g., when computing aggregations) if the function is used as an accessor.

Internally, this method assigns the field array to the `fields` property of the input *function*, and the name to the `fname` property. To be future-proof, clients should not access these properties directly. Instead, use the [accessorFields](#accessorFields) and [accessorName](#accessorName) methods.

<a name="accessorFields" href="#accessorFields">#</a>
vega.<b>accessorFields</b>(<i>accessor</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/accessor.js "Source")

Returns the array of dependent field names for a given *accessor* function. Returns null if no field names have been set.

<a name="accessorName" href="#accessorName">#</a>
vega.<b>accessorName</b>(<i>accessor</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/accessor.js "Source")

Returns the name string for a given *accessor* function. Returns null if no name has been set.

<a name="compare" href="#compare">#</a>
vega.<b>compare</b>(<i>fields</i>[, <i>orders</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/compare.js "Source")

Generates a comparator function for sorting data values, based on the given set of *fields* and optional sort *orders*. The *fields* argument must be either a string, an accessor function, or an array of either. Strings indicate the name of object properties to sort by, in precedence order. Field strings may include nested properties (e.g., `foo.bar.baz`). The *orders* argument must be either a string or an array of strings; the valid string values are `'ascending'` (for ascending sort order of the corresponding field) or `'descending'` (for descending sort order of the corresponding field). If the *orders* argument is omitted, is shorter than the *fields* array, or includes values other than  `'ascending'` or `'descending'`, corresponding fields will default to ascending order.

<a name="constant" href="#constant">#</a>
vega.<b>constant</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/constant.js "Source")

Given an input *value*, returns a function that simply returns that value. If the input *value* is itself a function, that function is returned directly.

<a name="debounce" href="#debounce">#</a>
vega.<b>debounce</b>(<i>delay</i>, <i>func</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/debounce.js "Source")

Generates a "debounced" function that delays invoking *func* until after *delay* milliseconds have elapsed since the last time the debounced function was invoked. Invocation passes up to one argument from the debounced function to *func* and does not preserve the *this* context.

<a name="field" href="#field">#</a>
vega.<b>field</b>(<i>field</i>[, <i>name</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/field.js "Source")

Generates an accessor function for retrieving the specified *field* value. The input *field* string may include nested properties (e.g., `foo.bar.baz`). An optional *name* argument indicates the accessor name for the generated function; if excluded the field string will be used as the name (see the [accessor](#accessor) method for more details).

```js
var fooField = vega.field('foo');
fooField({foo: 5}); // 5
vega.accessorName(fooField); // 'foo'
vega.accessorFields(fooField); // ['foo']

var pathField = vega.field('foo.bar', 'path');
pathField({foo: {bar: 'vega'}}); // 'vega'
pathField({foo: 5}); // undefined
vega.accessorName(pathField); // 'path'
vega.accessorFields(pathField); // ['foo.bar']
```

<a name="id" href="#id">#</a>
vega.<b>id</b>(<i>object</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/accessors.js "Source")

An accessor function that returns the value of the `id` property of an input *object*.

<a name="identity" href="#identity">#</a>
vega.<b>identity</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/accessors.js "Source")

An accessor function that simply returns its *value* argument.

<a name="key" href="#key">#</a>
vega.<b>key</b>(<i>fields</i>[, <i>flat</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/key.js "Source")

Generates an accessor function that returns a key string (suitable for using as an object property name) for a set of object *fields*. The *fields* argument must be either a string or string array, with each entry indicating a property of an input object to be used to produce representative key values. The resulting key function is an [accessor](#accessor) instance with the accessor name `'key'`. The optional *flat* argument is a boolean flag indicating if the field names should be treated as flat property names, side-stepping nested field lookups normally indicated by dot or bracket notation. By default, *flat* is `false` and nested property lookup is performed.

```js
var keyf = vega.key(['foo', 'bar']);
keyf({foo:'hi', bar:5}); // 'hi|5'
vega.accessorName(keyf); // 'key'
vega.accessorFields(keyf); // ['foo', 'bar']
```

<a name="one" href="#one">#</a>
vega.<b>one</b>()
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/accessors.js "Source")

An accessor function that simply returns the value one (`1`).

<a name="zero" href="#zero">#</a>
vega.<b>zero</b>()
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/accessors.js "Source")

An accessor function that simply returns the value zero (`0`).

<a name="truthy" href="#truthy">#</a>
vega.<b>truthy</b>()
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/accessors.js "Source")

An accessor function that simply returns the boolean `true` value.

<a name="falsy" href="#falsy">#</a>
vega.<b>falsy</b>()
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/accessors.js "Source")

An accessor function that simply returns the boolean `false` value.

### Type Checkers

Functions for checking the type of JavaScript values.

<a name="isArray" href="#isArray">#</a>
vega.<b>isArray</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/isArray.js "Source")

Returns `true` if the input *value* is an Array instance, `false` otherwise.

<a name="isBoolean" href="#isBoolean">#</a>
vega.<b>isBoolean</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/isBoolean.js "Source")

Returns `true` if the input *value* is a Boolean instance, `false` otherwise.

<a name="isDate" href="#isDate">#</a>
vega.<b>isDate</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/isDate.js "Source")

Returns `true` if the input *value* is a Date instance, `false` otherwise.

<a name="isFunction" href="#isFunction">#</a>
vega.<b>isFunction</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/isFunction.js "Source")

Returns `true` if the input *value* is a Function instance, `false` otherwise.

<a name="isNumber" href="#isNumber">#</a>
vega.<b>isNumber</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/isNumber.js "Source")

Returns `true` if the input *value* is a Number instance, `false` otherwise.

<a name="isObject" href="#isObject">#</a>
vega.<b>isObject</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/isObject.js "Source")

Returns `true` if the input *value* is an Object instance, `false` otherwise.

<a name="isRegExp" href="#isRegExp">#</a>
vega.<b>isRegExp</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/isRegExp.js "Source")

Returns `true` if the input *value* is a RegExp instance, `false` otherwise.

<a name="isString" href="#isString">#</a>
vega.<b>isString</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/isString.js "Source")

Returns `true` if the input *value* is a String instance, `false` otherwise.

### Type Coercion

Functions for coercing values to a desired type.

<a name="toBoolean" href="#toBoolean">#</a>
vega.<b>toBoolean</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/toBoolean.js "Source")

Coerces the input _value_ to a boolean. The strings `"true"` and `"1"` map to `true`; the strings `"false"` and `"0"` map to `false`. Null values and empty strings are mapped to `null`.

<a name="toDate" href="#toDate">#</a>
vega.<b>toDate</b>(<i>value</i>[, <i>parser</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/toDate.js "Source")

Coerces the input _value_ to a Date timestamp. Null values and empty strings are mapped to `null`. Date objects are passed through unchanged. If an optional _parser_ function is provided, it is used to perform date parsing. By default, numbers (timestamps) are passed through unchanged and otherwise `Date.parse` is used. Be aware that `Date.parse` has different implementations across browsers!

<a name="toNumber" href="#toNumber">#</a>
vega.<b>toNumber</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/toNumber.js "Source")

Coerces the input _value_ to a number. Null values and empty strings are mapped to `null`.

<a name="toString" href="#toString">#</a>
vega.<b>toString</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/toString.js "Source")

Coerces the input _value_ to a string. Null values and empty strings are mapped to `null`.

### Objects

Functions for manipulating JavaScript Object values.

<a name="extend" href="#extend">#</a>
vega.<b>extend</b>(<i>target</i>[, <i>source1</i>, <i>source2</i>, …])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/extend.js "Source")

Extends a *target* object by copying (in order) all enumerable properties of the input *source* objects.

<a name="inherits" href="#inherits">#</a>
vega.<b>inherits</b>(<i>child</i>, <i>parent</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/inherits.js "Source")

A convenience method for setting up object-oriented inheritance. Assigns the `prototype` property of the input *child* function, such that the *child* inherits the properties of the *parent* function's prototype via prototypal inheritance. Returns the new child prototype object.

<a name="fastmap" href="#fastmap">#</a>
vega.<b>fastmap</b>([<i>object</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/fastmap.js "Source")

Provides a key/value map data structure, keyed by string. Supports a subset of the [ES6 Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) API, including *has*, *get*, *set*, *delete* and *clear* methods and a *size* property. If the optional *object* argument is provided, all key/values on the input object will be added to the new map instance.

```js
var map = vega.fastmap({foo:1, bar:2});
map.has('foo'); // -> true
map.get('foo'); // -> 1
map.delete('bar');
map.has('bar'); // -> false
map.set('baz', 0);
map.get('baz'); // -> 0
map.size; // -> 2
map.empty; // -> 1 (number of empty entries)
map.clean(); // invoke garbage collection, clears empty entries
```

By using basic JavaScript objects to hash values and avoiding calls to the built-in JavaScript `delete` operator, fastmaps provide good performance. However, this speed comes at the cost of some object bloat, requiring periodic garbage collection in the case of many deletions. The fastmap object provides a *clean* method for requesting garbage collection of empty map entries. The *test* method is a getter/setter for providing an optional boolean-valued function that indicates additional objects (not just empty entries from deleted keys) that should be removed during garbage collection.

<a name="hasOwnProperty" href="#hasOwnProperty">#</a>
vega.<b>hasOwnProperty</b>(<i>object</i>, <i>property</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/hasOwnProperty.js "Source")

Returns `true` if the input *object* has a named *property* defined on it, otherwise `false`. This method concerns the input object only, ignoring properties defined up the prototype chain. The method is equivalent to [`Object.hasOwnProperty`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty), but improves security by guarding against overridden Object prototype built-ins.

<a name="mergeConfig" href="#mergeConfig">#</a>
vega.<b>mergeConfig</b>(<i>...config</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/mergeConfig.js "Source")

Merges a collection of Vega configuration objects into a single combined object. Configuration objects with higher index positions in the arguments list have higher precedence, and so may override settings provided by earlier objects.

<a name="writeConfig" href="#writeConfig">#</a>
vega.<b>writeConfig</b>(<i>config</i>, <i>key</i>, <i>value</i>[, <i>recurse</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/mergeConfig.js "Source")

Writes a value to a Vega configuration object. Given a *config* object and a configuration property *key* and *value*, appropriately assign the value to the config object. The *recurse* parameter controls if recursive merging (as opposed to overwriting) is performed: if `false` or undefined, no recursion is performed; if `true` one level of recursive merge is performed; if *recurse* is object-valued, one level of recursive merge is performed for keys that the *recurse* object maps to a truthy value. This method is a helper method used within *mergeConfig*.

### Arrays

Functions for manipulating JavaScript Array values.

<a name="array" href="#array">#</a>
vega.<b>array</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/array.js "Source")

Ensures that the input *value* is an Array instance. If so, the *value* is simply returned. If not, the *value* is wrapped within a new single-element an array, returning `[value]`.

<a name="clampRange" href="#clampRange">#</a>
vega.<b>clampRange</b>(<i>range</i>, <i>min</i>, <i>max</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/clampRange.js "Source")

Span-preserving range clamp. If the span of the input *range* is less than (*max* - *min*) and an endpoint exceeds either the *min* or *max* value, the range is translated such that the span is preserved and one endpoint touches the boundary of the min/max range. If the span exceeds (*max* - *min*), returns the range `[min, max]`.

<a name="extent" href="#extent">#</a>
vega.<b>extent</b>(<i>array</i>[, <i>accessor</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/extent.js "Source")

Returns an array with the minimum and maximum values in the input *array*, in the form `[min, max]`. Ignores null, undefined, and NaN values. The optional *accessor* argument provides a function that is first applied to each array value prior to comparison.

<a name="extentIndex" href="#extentIndex">#</a>
vega.<b>extentIndex</b>(<i>array</i>[, <i>accessor</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/extentIndex.js "Source")

Returns the array indices for the minimum and maximum values in the input *array* (as a `[minIndex, maxIndex]` array), according to natural ordering. The optional *accessor* argument provides a function that is first applied to each array value prior to comparison.

```js
vega.extentIndex([1,5,3,0,4,2]); // [3, 1]
vega.extentIndex([
  {a: 3, b:2},
  {a: 2, b:1},
  {a: 1, b:3}
], vega.field('b')); // [1, 2]
```

<a name="flush" href="#flush">#</a>
vega.<b>flush</b>(<i>range</i>, <i>value</i>, <i>threshold</i>, <i>left</i>, <i>right</i>, <i>center</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/inrange.js "Source")

Selects among potential return values if the provided *value* is flush with the input numeric *range*. Returns *left* if *value is within the *threshold* distance of the minimum element of the *range*. Returns *right* if *value is within the *threshold* distance of the maximum element of the *range*. Otherwise, returns *center*.

<a name="inrange" href="#inrange">#</a>
vega.<b>inrange</b>(<i>value</i>, <i>range</i>[, <i>left</i>, <i>right</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/inrange.js "Source")

Returns `true` if the input *value* lies within the span of the given *range* array. The *left* and *right* boolean flags control the use of inclusive (true) or exclusive (false) comparisons; if unspecified, inclusive tests are used.

<a name="lerp" href="#lerp">#</a>
vega.<b>lerp</b>(<i>array</i>, <i>fraction</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/lerp.js "Source")

Returns the linearly interpolated value between the first and last entries in the *array* for the provided interpolation *fraction* (typically between 0 and 1). For example, *lerp([0, 50], 0.5)* returns 25.

<a name="merge" href="#merge">#</a>
vega.<b>merge</b>(<i>compare</i>, <i>array1</i>, <i>array2</i>[, <i>output</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/merge.js "Source")

Merge two sorted arrays into a single sorted array. The input *compare* function is a comparator for sorting elements and should correspond to the pre-sorted orders of the *array1* and *array2* source arrays. The merged array contents are written to the *output* array, if provided. If *output* is not specified, a new array is generated and returned.

<a name="panLinear" href="#panLinear">#</a>
vega.<b>panLinear</b>(<i>domain</i>, <i>delta</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/transform.js "Source")

Given an input numeric _domain_ (sorted in increasing order), returns a new domain array that translates the domain by a _delta_ using a linear transform. The _delta_ value is expressed as a fraction of the current domain span, and may be positive or negative to indicate the translation direction. The return value is a two-element array indicating the starting and ending value of the translated (panned) domain.

<a name="panLog" href="#panLog">#</a>
vega.<b>panLog</b>(<i>domain</i>, <i>delta</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/transform.js "Source")

Given an input numeric _domain_ (sorted in increasing order), returns a new domain array that translates the domain by a _delta_ using a logarithmic transform. The _delta_ value is expressed as a fraction of the current domain span, and may be positive or negative to indicate the translation direction. The return value is a two-element array indicating the starting and ending value of the translated (panned) domain.

<a name="panPow" href="#panPow">#</a>
vega.<b>panPow</b>(<i>domain</i>, <i>delta</i>, <i>exponent</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/transform.js "Source")

Given an input numeric _domain_ (sorted in increasing order), returns a new domain array that translates the domain by a _delta_ using a power scale transform parameterized by the provided _exponent_. The _delta_ value is expressed as a fraction of the current domain span, and may be positive or negative to indicate the translation direction. The return value is a two-element array indicating the starting and ending value of the translated (panned) domain.

<a name="panSymlog" href="#panSymlog">#</a>
vega.<b>panSymlog</b>(<i>domain</i>, <i>delta</i>, <i>constant</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/transform.js "Source")

Given an input numeric _domain_ (sorted in increasing order), returns a new domain array that translates the domain by a _delta_ using a symlog (symmetric log) scale transform parameterized by the provided _constant_. The _delta_ value is expressed as a fraction of the current domain span, and may be positive or negative to indicate the translation direction. The return value is a two-element array indicating the starting and ending value of the translated (panned) domain.

<a name="peek" href="#peek">#</a>
vega.<b>peek</b>(<i>array</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/peek.js "Source")

Returns the last element in the input *array*. Similar to the built-in `Array.pop` method, except that it does not remove the last element. This method is a convenient shorthand for `array[array.length - 1]`.

<a name="span" href="#span">#</a>
vega.<b>span</b>(<i>array</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/span.js "Source")

Returns the numerical span of the input *array*: the difference between the last and first values.

<a name="toSet" href="#toSet">#</a>
vega.<b>toSet</b>(<i>array</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/toSet.js "Source")

Given an input *array* of values, returns a new Object instance whose property keys are the values in *array*, each assigned a property value of `1`. Each value in *array* is coerced to a String value and so should map to a reasonable string key value.

```js
vega.toSet([1, 2, 3]); // {'1':1, '2':1, '3':1}
```

<a name="visitArray" href="#visitArray">#</a>
vega.<b>visitArray</b>(<i>array</i>, [<i>filter</i>,] <i>visitor</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/visitArray.js "Source")

Vists the values in an input *array*, invoking the *visitor* function for each array value that passes an optional *filter*. If specified, the *filter* function is called with each individual array value. If the *filter* function return value is truthy, the returned value is then passed as input to the *visitor* function. Thus, the *filter* not only performs filtering, it can serve as a value transformer. If the *filter* function is not specified, all values in the *array* are passed to the *visitor* function. Similar to the built-in `Array.forEach` method, the *visitor* function is invoked with three arguments: the value to visit, the current index into the source *array*, and a reference to the soure *array*.

```js
// console output: 1 0; 3 2
vega.visitArray([0, -1, 2],
  function(x) { return x + 1; },
  function(v, i, array) { console.log(v, i); });
```

<a name="zoomLinear" href="#zoomLinear">#</a>
vega.<b>zoomLinear</b>(<i>domain</i>, <i>anchor</i>, <i>scale</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/transform.js "Source")

Given an input numeric _domain_ (sorted in increasing order), returns a new domain array that scales (zooms) the domain by a _scale_ factor using a linear transform, centered on the given _anchor_ value. If _anchor_ is `null`, the midpoint of the domain is used instead. The return value is a two-element array indicating the starting and ending value of the scaled (zoomed) domain.

<a name="zoomLog" href="#zoomLog">#</a>
vega.<b>zoomLog</b>(<i>domain</i>, <i>anchor</i>, <i>scale</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/transform.js "Source")

Given an input numeric _domain_ (sorted in increasing order), returns a new domain array that scales (zooms) the domain by a _scale_ factor using a logarithmic transform, centered on the given _anchor_ value. If _anchor_ is `null`, the midpoint of the domain is used instead. The return value is a two-element array indicating the starting and ending value of the scaled (zoomed) domain.

<a name="zoomPow" href="#zoomPow">#</a>
vega.<b>zoomPow</b>(<i>domain</i>, <i>anchor</i>, <i>scale</i>, <i>exponent</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/transform.js "Source")

Given an input numeric _domain_ (sorted in increasing order), returns a new domain array that scales (zooms) the domain by a _scale_ factor using a power scale transform parameterized by the provided _exponent_, centered on the given _anchor_ value. If _anchor_ is `null`, the midpoint of the domain is used instead. The return value is a two-element array indicating the starting and ending value of the scaled (zoomed) domain.

<a name="zoomSymlog" href="#zoomSymlog">#</a>
vega.<b>zoomSymlog</b>(<i>domain</i>, <i>anchor</i>, <i>scale</i>, <i>constant</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/transform.js "Source")

Given an input numeric _domain_ (sorted in increasing order), returns a new domain array that scales (zooms) the domain by a _scale_ factor using a symlog (symmetric log) scale transform parameterized by the provided _constant_, centered on the given _anchor_ value. If _anchor_ is `null`, the midpoint of the domain is used instead. The return value is a two-element array indicating the starting and ending value of the scaled (zoomed) domain.

### Dates

Functions for manipulating JavaScript Date values.

<a name="quarter" href="#quarter">#</a>
vega.<b>quarter</b>(<i>date</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/quarter.js "Source")

Returns the quarter of the year (an integer between 1 and 4) for an input *date* object or timestamp for the local timezone.

<a name="utcquarter" href="#utcquarter">#</a>
vega.<b>utcquarter</b>(<i>date</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/quarter.js "Source")

Returns the quarter of the year (an integer between 1 and 4) for an input *date* object or timestamp for Coordinated Universal Time (UTC).


### Strings

Functions for generating and manipulating JavaScript String values.

<a name="pad" href="#pad">#</a>
vega.<b>pad</b>(<i>string</i>, <i>length</i>[, <i>character</i>, <i>align</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/pad.js "Source")

Pads a *string* value with repeated instances of a *character* up to a specified *length*. If *character* is not specified, a space (`' '`) is used. By default, padding is added to the end of a string. An optional *align* parameter specifies if padding should be added to the `'left'` (beginning), `'center'`, or `'right'` (end) of the input string.

```js
vega.pad('15', 5, '0', 'left'); // '00015'
```

<a name="repeat" href="#repeat">#</a>
vega.<b>repeat</b>(<i>string</i>, <i>count</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/repeat.js "Source")

Given an input *string*, returns a new string that repeats the input *count* times.

```js
vega.repeat('0', 5); // '00000'
```

<a name="splitAccessPath" href="#splitAccessPath">#</a>
vega.<b>splitAccessPath</b>(<i>path</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/splitAccessPath.js "Source")

Splits an input string representing an access *path* for JavaScript object properties into an array of constituent path elements.

```js
vega.splitAccessPath('foo'); // ['foo']
vega.splitAccessPath('foo.bar'); // ['foo', 'bar']
vega.splitAccessPath('foo["bar"]'); // ['foo', 'bar']
vega.splitAccessPath('foo[0].bar'); // ['foo', '0', 'bar']
```

<a name="stringValue" href="#stringValue">#</a>
vega.<b>stringValue</b>(<i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/stringValue.js "Source")

Returns an output representation of an input value that is both JSON and JavaScript compliant. For Object and String values, `JSON.stringify` is used to generate the output string. Primitive types such as Number or Boolean are returned as-is. This method can be used to generate values that can then be included in runtime-compiled code snippets (for example, via the Function constructor).

<a name="truncate" href="#truncate">#</a>
vega.<b>truncate</b>(<i>string</i>, <i>length</i>[, <i>align</i>, <i>ellipsis</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/truncate.js "Source")

Truncates an input *string* to a target *length*. The optional *align* argument indicates what part of the string should be truncated: `'left'` (the beginning), `'center'`, or `'right'` (the end). By default, the `'right'` end of the string is truncated. The optional *ellipsis* argument indicates the string to use to indicate truncated content; by default the ellipsis character (`…`, same as `\u2026`) is used.


### Logging

<a name="logger" href="#logger">#</a>
vega.<b>logger</b>([<i>level</i>, <i>method</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/logger.js "Source")

Generates a new logger instance for selectively writing log messages to the JavaScript console. The optional *level* argument indicates the initial log level to use (one of [None](#none), [Warn](#warn), [Info](#info), or [Debug](#debug)), and defaults to [None](#none) if not specified.

The generated logger instance provides the following methods:

- <b>level</b>(<i>value</i>): Sets the current logging level. Only messages with a log level less than or equal to *value* will be written to the console.
- <b>error</b>(<i>message1</i>[, <i>message2</i>, …]): Logs an error message. The messages will be written to the console using the `console.error` method if the current log level is [Error](#error) or higher.
- <b>warn</b>(<i>message1</i>[, <i>message2</i>, …]): Logs a warning message. The messages will be written to the console using the `console.warn` method if the current log level is [Warn](#warn) or higher.
- <b>info</b>(<i>message1</i>[, <i>message2</i>, …]): Logs an informative message. The messages will be written to the console using the `console.log` method if the current log level is [Info](#info) or higher.
- <b>debug</b>(<i>message1</i>[, <i>message2</i>, …]): Logs a debugging message. The messages will be written to the console using the `console.log` method if the current log level is [Debug](#debug) or higher.

To override the choice of console method invoked (`console.log`, `console.warn`, or `console.error`), use the optional *method* argument (one of `"log"`, `"warn"`, or `"error"`) to route all log messages through the same method.

<a name="None" href="#None">#</a>
vega.<b>None</b>
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/logger.js "Source")

Constant value indicating a log level of 'None'. If set as the log level of a [logger](#logger) instance, all log messages will be suppressed.

<a name="Error" href="#Error">#</a>
vega.<b>Error</b>
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/logger.js "Source")

Constant value indicating a log level of 'Error'. If set as the log level of a [logger](#logger) instance, only error messages will be presented.

<a name="Warn" href="#Warn">#</a>
vega.<b>Warn</b>
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/logger.js "Source")

Constant value indicating a log level of 'Warn'. If set as the log level of a [logger](#logger) instance, both error and warning messages will be presented.

<a name="Info" href="#Info">#</a>
vega.<b>Info</b>
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/logger.js "Source")

Constant value indicating a log level of 'Info'. If set as the log level of a [logger](#logger) instance, error, warning and info messages will be presented.

<a name="Debug" href="#Debug">#</a>
vega.<b>Debug</b>
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/logger.js "Source")

Constant value indicating a log level of 'Debug'. If set as the log level of a [logger](#logger) instance, all log messages (error, warning, info and debug) will be presented.


### Errors

<a name="error" href="#error">#</a>
vega.<b>error</b>(<i>message</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-util/src/error.js "Source")

Throws a new error with the provided error *message*. This is a convenience method adding a layer of indirection for error handling, for example allowing error conditions to be included in expression chains.

```js
vega.error('Uh oh'); // equivalent to: throw Error('Uh oh')

// embed error in an expression
return isOk ? returnValue : vega.error('Not OK');
```
