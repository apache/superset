# samsam

> Same same, but different

`samsam` is a collection of predicate and comparison functions useful for
identifiying the type of values and to compare values with varying degrees of
strictness.

`samsam` is a general-purpose library. It works in browsers and Node. It will
define itself as an AMD module if you want it to (i.e. if there's a `define`
function available).

## Predicate functions


### `isArguments(value)`

Returns `true` if `value` is an `arguments` object, `false` otherwise.


### `isNegZero(value)`

Returns `true` if `value` is `-0`.


### `isElement(value)`

Returns `true` if `value` is a DOM element node. Unlike
Underscore.js/lodash, this function will return `false` if `value` is an
*element-like* object, i.e. a regular object with a `nodeType` property that
holds the value `1`.

### `isSet(value)`

Returns `true` if `value` is a [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set).


## Comparison functions


### `identical(x, y)`

Strict equality check according to EcmaScript Harmony's `egal`.

**From the Harmony wiki:**

> An egal function simply makes available the internal `SameValue` function
from section 9.12 of the ES5 spec. If two values are egal, then they are not
observably distinguishable.

`identical` returns `true` when `===` is `true`, except for `-0` and
`+0`, where it returns `false`. Additionally, it returns `true` when
`NaN` is compared to itself.


### `deepEqual(actual, expectation)`

Deep equal comparison. Two values are "deep equal" if:

* They are identical
* They are both date objects representing the same time
* They are both arrays containing elements that are all deepEqual
* They are objects with the same set of properties, and each property
  in `actual` is deepEqual to the corresponding property in `expectation`

  * `actual` can have [symbolic properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol) that are missing from `expectation`


### Matcher

Match values and objects by type or or other fuzzy criteria. `samsam` ships
with these built in matchers:

#### `sinon.match.any`

Matches anything.


#### `sinon.match.defined`

Requires the value to be defined.


#### `sinon.match.truthy`

Requires the value to be truthy.


#### `sinon.match.falsy`

Requires the value to be falsy.


#### `sinon.match.bool`

Requires the value to be a `Boolean`


#### `sinon.match.number`

Requires the value to be a `Number`.


#### `sinon.match.string`

Requires the value to be a `String`.


#### `sinon.match.object`

Requires the value to be an `Object`.


#### `sinon.match.func`

Requires the value to be a `Function`.


#### `sinon.match.array`

Requires the value to be an `Array`.


#### `sinon.match.array.deepEquals(arr)`

Requires an `Array` to be deep equal another one.


#### `sinon.match.array.startsWith(arr)`

Requires an `Array` to start with the same values as another one.


#### `sinon.match.array.endsWith(arr)`

Requires an `Array` to end with the same values as another one.


#### `sinon.match.array.contains(arr)`

Requires an `Array` to contain each one of the values the given array has.


#### `sinon.match.map`

Requires the value to be a `Map`.


#### `sinon.match.map.deepEquals(map)`

Requires a `Map` to be deep equal another one.

#### `sinon.match.map.contains(map)`

Requires a `Map` to contain each one of the items the given map has.


#### `sinon.match.set`

Requires the value to be a `Set`.


#### `sinon.match.set.deepEquals(set)`

Requires a `Set` to be deep equal another one.


#### `sinon.match.set.contains(set)`

Requires a `Set` to contain each one of the items the given set has.


#### `sinon.match.regexp`

Requires the value to be a regular expression.


#### `sinon.match.date`

Requires the value to be a `Date` object.


#### `sinon.match.symbol`

Requires the value to be a `Symbol`.

#### `sinon.match.in(array)`

Requires the value to be in the `array`.

#### `sinon.match.same(ref)`

Requires the value to strictly equal `ref`.

#### `sinon.match.typeOf(type)`

Requires the value to be of the given type, where `type` can be one of
    `"undefined"`,
    `"null"`,
    `"boolean"`,
    `"number"`,
    `"string"`,
    `"object"`,
    `"function"`,
    `"array"`,
    `"regexp"`,
    `"date"` or
    `"symbol"`.


#### `sinon.match.instanceOf(type)`

Requires the value to be an instance of the given `type`.

#### `sinon.match.has(property[, expectation])`

Requires the value to define the given `property`.

The property might be inherited via the prototype chain. If the optional expectation is given, the value of the property is deeply compared with the expectation. The expectation can be another matcher.

#### `sinon.match.hasOwn(property[, expectation])`

Same as `sinon.match.has` but the property must be defined by the value itself. Inherited properties are ignored.


#### `sinon.match.hasNested(propertyPath[, expectation])`

Requires the value to define the given `propertyPath`. Dot (`prop.prop`) and bracket (`prop[0]`) notations are supported as in [Lodash.get](https://lodash.com/docs/4.4.2#get).

The propertyPath might be inherited via the prototype chain. If the optional expectation is given, the value at the propertyPath is deeply compared with the expectation. The expectation can be another matcher.


```javascript
sinon.match.hasNested("a[0].b.c");

// Where actual is something like
var actual = { "a": [{ "b": { "c": 3 } }] };

sinon.match.hasNested("a.b.c");

// Where actual is something like
var actual = { "a": { "b": { "c": 3 } } };
```

#### `sinon.match.every(matcher)`

Requires **every** element of an `Array`, `Set` or `Map`, or alternatively **every** value of an `Object` to match the given `matcher`.

#### `sinon.match.some(matcher)`

Requires **any** element of an `Array`, `Set` or `Map`, or alternatively **any** value of an `Object` to match the given `matcher`.

## Combining matchers

All matchers implement `and` and `or`. This allows to logically combine mutliple matchers. The result is a new matchers that requires both (and) or one of the matchers (or) to return `true`.

```javascript
var stringOrNumber = sinon.match.string.or(sinon.match.number);
var bookWithPages = sinon.match.instanceOf(Book).and(sinon.match.has("pages"));
```

### `match(object, matcher)`

Creates a custom matcher to perform partial equality check. Compares `object`
with matcher according a wide set of rules:

#### String matcher

In its simplest form, `match` performs a case insensitive substring match.
When the matcher is a string, `object` is converted to a string, and the
function returns `true` if the matcher is a case-insensitive substring of
`object` as a string.

```javascript
samsam.match("Give me something", "Give"); //true
samsam.match("Give me something", "sumptn"); // false
samsam.match({ toString: function () { return "yeah"; } }, "Yeah!"); // true
```

The last example is not symmetric. When the matcher is a string, the `object`
is coerced to a string - in this case using `toString`. Changing the order of
the arguments would cause the matcher to be an object, in which case different
rules apply (see below).


#### Boolean matcher

Performs a strict (i.e. `===`) match with the object. So, only `true`
matches `true`, and only `false` matches `false`.


#### Regular expression matcher

When the matcher is a regular expression, the function will pass if
`object.test(matcher)` is `true`. `match` is written in a generic way, so
any object with a `test` method will be used as a matcher this way.

```javascript
samsam.match("Give me something", /^[a-z\s]$/i); // true
samsam.match("Give me something", /[0-9]/); // false
samsam.match({ toString: function () { return "yeah!"; } }, /yeah/); // true
samsam.match(234, /[a-z]/); // false
```


#### Number matcher

When the matcher is a number, the assertion will pass if `object == matcher`.

```javascript
samsam.match("123", 123); // true
samsam.match("Give me something", 425); // false
samsam.match({ toString: function () { return "42"; } }, 42); // true
samsam.match(234, 1234); // false
```


#### Function matcher

When the matcher is a function, it is called with `object` as its only
argument. `match` returns `true` if the function returns `true`. A strict
match is performed against the return value, so a boolean `true` is required,
truthy is not enough.

```javascript
// true
samsam.match("123", function (exp) {
    return exp == "123";
});

// false
samsam.match("Give me something", function () {
    return "ok";
});

// true
samsam.match({
    toString: function () {
        return "42";
    }
}, function () { return true; });

// false
samsam.match(234, function () {});
```


#### Object matcher

As mentioned above, if an object matcher defines a `test` method, `match`
will return `true` if `matcher.test(object)` returns truthy.

If the matcher does not have a test method, a recursive match is performed. If
all properties of `matcher` matches corresponding properties in `object`,
`match` returns `true`. Note that the object matcher does not care if the
number of properties in the two objects are the same - only if all properties in
the matcher recursively matches ones in `object`.

```javascript
// true
samsam.match("123", {
    test: function (arg) {
        return arg == 123;
    }
});

// false
samsam.match({}, { prop: 42 });

// true
samsam.match({
    name: "Chris",
    profession: "Programmer"
}, {
    name: "Chris"
});

// false
samsam.match(234, { name: "Chris" });
```


#### DOM elements

`match` can be very helpful when comparing DOM elements, because it allows
you to compare several properties with one call:

```javascript
var el = document.getElementById("myEl");

samsam.match(el, {
    tagName: "h2",
    className: "item",
    innerHTML: "Howdy"
});
```
