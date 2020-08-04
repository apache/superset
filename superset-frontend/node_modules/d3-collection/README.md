# d3-collection

Handy data structures for elements keyed by string.

## Installing

If you use NPM, `npm install d3-collection`. Otherwise, download the [latest release](https://github.com/d3/d3-collection/releases/latest). You can also load directly from [d3js.org](https://d3js.org), either as a [standalone library](https://d3js.org/d3-collection.v1.min.js) or as part of [D3 4.0](https://github.com/d3/d3). AMD, CommonJS, and vanilla environments are supported. In vanilla, a `d3` global is exported:

```html
<script src="https://d3js.org/d3-collection.v1.min.js"></script>
<script>

var map = d3.map()
    .set("foo", 1)
    .set("bar", 2);

</script>
```

[Try d3-collection in your browser.](https://tonicdev.com/npm/d3-collection)

## API Reference

* [Objects](#objects)
* [Maps](#maps)
* [Sets](#sets)
* [Nests](#nests)

### Objects

A common data type in JavaScript is the *associative array*, or more simply the *object*, which has a set of named properties. The standard mechanism for iterating over the keys (or property names) in an associative array is the [for…in loop](https://developer.mozilla.org/en/JavaScript/Reference/Statements/for...in). However, note that the iteration order is undefined. D3 provides several methods for converting associative arrays to standard arrays with numeric indexes.

A word of caution: it is tempting to use plain objects as maps, but this causes [unexpected behavior](http://www.devthought.com/2012/01/18/an-object-is-not-a-hash/) when built-in property names are used as keys, such as `object["__proto__"] = 42` and `"hasOwnProperty" in object`. If you cannot guarantee that map keys and set values will be safe, use [maps](#maps) and [sets](#sets) (or their ES6 equivalents) instead of plain objects.

<a name="keys" href="#keys">#</a> d3.<b>keys</b>(<i>object</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/keys.js "Source")

Returns an array containing the property names of the specified object (an associative array). The order of the returned array is undefined.

<a name="values" href="#values">#</a> d3.<b>values</b>(<i>object</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/values.js "Source")

Returns an array containing the property values of the specified object (an associative array). The order of the returned array is undefined.

<a name="entries" href="#entries">#</a> d3.<b>entries</b>(<i>object</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/entries.js "Source")

Returns an array containing the property keys and values of the specified object (an associative array). Each entry is an object with a key and value attribute, such as `{key: "foo", value: 42}`. The order of the returned array is undefined.

```js
d3.entries({foo: 42, bar: true}); // [{key: "foo", value: 42}, {key: "bar", value: true}]
```

### Maps

Like [ES6 Maps](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), but with a few differences:

* Keys are coerced to strings.
* [map.each](#map_each), not [map.forEach](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach). (Also, no *thisArg*.)
* [map.remove](#map_remove), not [map.delete](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/delete).
* [map.entries](#map_entries) returns an array of {key, value} objects, not an iterator of [key, value].
* [map.size](#map_size) is a method, not a [property](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/size); also, there’s [map.empty](#map_empty).

<a name="map" href="#map">#</a> d3.<b>map</b>([<i>object</i>[, <i>key</i>]]) [<>](https://github.com/d3/d3-collection/blob/master/src/map.js "Source")

Constructs a new map. If *object* is specified, copies all enumerable properties from the specified object into this map. The specified object may also be an array or another map. An optional *key* function may be specified to compute the key for each value in the array. For example:

```js
var map = d3.map([{name: "foo"}, {name: "bar"}], function(d) { return d.name; });
map.get("foo"); // {"name": "foo"}
map.get("bar"); // {"name": "bar"}
map.get("baz"); // undefined
```

See also [nests](#nests).

<a name="map_has" href="#map_has">#</a> <i>map</i>.<b>has</b>(<i>key</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L7 "Source")

Returns true if and only if this map has an entry for the specified *key* string. Note: the value may be `null` or `undefined`.

<a name="map_get" href="#map_get">#</a> <i>map</i>.<b>get</b>(<i>key</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L10 "Source")

Returns the value for the specified *key* string. If the map does not have an entry for the specified *key*, returns `undefined`.

<a name="map_set" href="#map_set">#</a> <i>map</i>.<b>set</b>(<i>key</i>, <i>value</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L13 "Source")

Sets the *value* for the specified *key* string. If the map previously had an entry for the same *key* string, the old entry is replaced with the new value. Returns the map, allowing chaining. For example:

```js
var map = d3.map()
    .set("foo", 1)
    .set("bar", 2)
    .set("baz", 3);

map.get("foo"); // 1
```

<a name="map_remove" href="#map_remove">#</a> <i>map</i>.<b>remove</b>(<i>key</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L17 "Source")

If the map has an entry for the specified *key* string, removes the entry and returns true. Otherwise, this method does nothing and returns false.

<a name="map_clear" href="#map_clear">#</a> <i>map</i>.<b>clear</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L21 "Source")

Removes all entries from this map.

<a name="map_keys" href="#map_keys">#</a> <i>map</i>.<b>keys</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L24 "Source")

Returns an array of string keys for every entry in this map. The order of the returned keys is arbitrary.

<a name="map_values" href="#map_values">#</a> <i>map</i>.<b>values</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L29 "Source")

Returns an array of values for every entry in this map. The order of the returned values is arbitrary.

<a name="map_entries" href="#map_entries">#</a> <i>map</i>.<b>entries</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L34 "Source")

Returns an array of key-value objects for each entry in this map. The order of the returned entries is arbitrary. Each entry’s key is a string, but the value has arbitrary type.

<a name="map_each" href="#map_each">#</a> <i>map</i>.<b>each</b>(<i>function</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L48 "Source")

Calls the specified *function* for each entry in this map, passing the entry’s value and key as arguments, followed by the map itself. Returns undefined. The iteration order is arbitrary.

<a name="map_empty" href="#map_empty">#</a> <i>map</i>.<b>empty</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L44 "Source")

Returns true if and only if this map has zero entries.

<a name="map_size" href="#map_size">#</a> <i>map</i>.<b>size</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/map.js#L39 "Source")

Returns the number of entries in this map.

### Sets

Like [ES6 Sets](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), but with a few differences:

* Values are coerced to strings.
* [set.each](#set_each), not [set.forEach](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/forEach). (Also, no *thisArg*.)
* [set.remove](#set_remove), not [set.delete](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/delete).
* [set.size](#set_size) is a method, not a [property](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/size); also, there’s [set.empty](#set_empty).

<a name="set" href="#set">#</a> d3.<b>set</b>([<i>array</i>[, <i>accessor</i>]]) [<>](https://github.com/d3/d3-collection/blob/master/src/set.js "Source")

Constructs a new set. If *array* is specified, adds the given *array* of string values to the returned set. The specified array may also be another set. An optional *accessor* function may be specified, which is equivalent to calling *array.map(accessor)* before constructing the set.

<a name="set_has" href="#set_has">#</a> <i>set</i>.<b>has</b>(<i>value</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/set.js#L9 "Source")

Returns true if and only if this set has an entry for the specified *value* string.

<a name="set_add" href="#set_add">#</a> <i>set</i>.<b>add</b>(<i>value</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/set.js#L10 "Source")

Adds the specified *value* string to this set. Returns the set, allowing chaining. For example:

```js
var set = d3.set()
    .add("foo")
    .add("bar")
    .add("baz");

set.has("foo"); // true
```

<a name="set_remove" href="#set_remove">#</a> <i>set</i>.<b>remove</b>(<i>value</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/set.js#L15 "Source")

If the set contains the specified *value* string, removes it and returns true. Otherwise, this method does nothing and returns false.

<a name="set_clear" href="#set_clear">#</a> <i>set</i>.<b>clear</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/set.js#L16 "Source")

Removes all values from this set.

<a name="set_values" href="#set_values">#</a> <i>set</i>.<b>values</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/set.js#L17 "Source")

Returns an array of the string values in this set. The order of the returned values is arbitrary. Can be used as a convenient way of computing the unique values for a set of strings. For example:

```js
d3.set(["foo", "bar", "foo", "baz"]).values(); // "foo", "bar", "baz"
```

<a name="set_each" href="#set_each">#</a> <i>set</i>.<b>each</b>(<i>function</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/set.js#L20 "Source")

Calls the specified *function* for each value in this set, passing the value as the first two arguments (for symmetry with [*map*.each](#map_each)), followed by the set itself. Returns undefined. The iteration order is arbitrary.

<a name="set_empty" href="#set_empty">#</a> <i>set</i>.<b>empty</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/set.js#L19 "Source")

Returns true if and only if this set has zero values.

<a name="set_size" href="#set_size">#</a> <i>set</i>.<b>size</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/set.js#L18 "Source")

Returns the number of values in this set.

### Nests

Nesting allows elements in an array to be grouped into a hierarchical tree structure; think of it like the GROUP BY operator in SQL, except you can have multiple levels of grouping, and the resulting output is a tree rather than a flat table. The levels in the tree are specified by key functions. The leaf nodes of the tree can be sorted by value, while the internal nodes can be sorted by key. An optional rollup function will collapse the elements in each leaf node using a summary function. The nest operator (the object returned by [nest](#nest)) is reusable, and does not retain any references to the data that is nested.

For example, consider the following tabular data structure of Barley yields, from various sites in Minnesota during 1931-2:

```js
var yields = [
  {yield: 27.00, variety: "Manchuria", year: 1931, site: "University Farm"},
  {yield: 48.87, variety: "Manchuria", year: 1931, site: "Waseca"},
  {yield: 27.43, variety: "Manchuria", year: 1931, site: "Morris"},
  ...
];
```

To facilitate visualization, it may be useful to nest the elements first by year, and then by variety, as follows:

```js
var entries = d3.nest()
    .key(function(d) { return d.year; })
    .key(function(d) { return d.variety; })
    .entries(yields);
```

This returns a nested array. Each element of the outer array is a key-values pair, listing the values for each distinct key:

```js
[{key: "1931", values: [
   {key: "Manchuria", values: [
     {yield: 27.00, variety: "Manchuria", year: 1931, site: "University Farm"},
     {yield: 48.87, variety: "Manchuria", year: 1931, site: "Waseca"},
     {yield: 27.43, variety: "Manchuria", year: 1931, site: "Morris"}, ...]},
   {key: "Glabron", values: [
     {yield: 43.07, variety: "Glabron", year: 1931, site: "University Farm"},
     {yield: 55.20, variety: "Glabron", year: 1931, site: "Waseca"}, ...]}, ...]},
 {key: "1932", values: ...}]
```

The nested form allows easy iteration and generation of hierarchical structures in SVG or HTML.

For a longer introduction to nesting, see:

* Phoebe Bright’s [D3 Nest Tutorial and examples](http://bl.ocks.org/phoebebright/raw/3176159/)
* Shan Carter’s [Mister Nester](http://bl.ocks.org/shancarter/raw/4748131/)

<a name="nest" href="#nest">#</a> d3.<b>nest</b>() [<>](https://github.com/d3/d3-collection/blob/master/src/nest.js "Source")

Creates a new nest operator. The set of keys is initially empty.

<a name="nest_key" href="#nest_key">#</a> <i>nest</i>.<b>key</b>(<i>key</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/nest.js#L4 "Source")

Registers a new *key* function. The *key* function will be invoked for each element in the input array and must return a string identifier to assign the element to its group. Most often, the function is a simple accessor, such as the year and variety accessors above. (Keys functions are *not* passed the input array index.) Each time a key is registered, it is pushed onto the end of the internal array of keys, and the nest operator applies an additional level of nesting.

<a name="nest_sortKeys" href="#nest_sortKeys">#</a> <i>nest</i>.<b>sortKeys</b>(<i>comparator</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/nest.js#L5 "Source")

Sorts key values for the [current key](#nest_key) using the specified *comparator* function, such as [d3.ascending](https://github.com/d3/d3-array#ascending) or [d3.descending](https://github.com/d3/d3-array#descending). If no comparator is specified for the current key, the order in which keys will be returned is undefined. For example, to sort years in ascending order and varieties in descending order:

```js
var entries = d3.nest()
    .key(function(d) { return d.year; }).sortKeys(d3.ascending)
    .key(function(d) { return d.variety; }).sortKeys(d3.descending)
    .entries(yields);
```

Note that this only affects the result of [*nest*.entries](#nest_entries); the order of keys returned by [*nest*.map](#nest_map) and [*nest*.object](#nest_object) is always undefined, regardless of comparator.

<a name="nest_sortValues" href="#nest_sortValues">#</a> <i>nest</i>.<b>sortValues</b>(<i>comparator</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/nest.js#L6 "Source")

Sorts leaf elements using the specified *comparator* function, such as [d3.ascending](https://github.com/d3/d3-array#ascending) or [d3.descending](https://github.com/d3/d3-array#descending). This is roughly equivalent to sorting the input array before applying the nest operator; however it is typically more efficient as the size of each group is smaller. If no value comparator is specified, elements will be returned in the order they appeared in the input array. This applies to [*nest*.map](#nest_map), [*nest*.entries](#nest_entries) and [*nest*.object](#nest_object).

<a name="nest_rollup" href="#nest_rollup">#</a> <i>nest</i>.<b>rollup</b>(<i>function</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/nest.js#L7 "Source")

Specifies a rollup *function* to be applied on each group of leaf elements. The return value of the rollup function will replace the array of leaf values in either the associative array returned by [*nest*.map](#nest_map) or [*nest*.object](#nest_object); for [*nest*.entries](#nest_entries), it replaces the leaf *entry*.values with *entry*.value. If a [leaf comparator](#nest_sortValues) is specified, the leaf elements are sorted prior to invoking the rollup function.

<a name="nest_map" href="#nest_map">#</a> <i>nest</i>.<b>map</b>(<i>array</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/nest.js#L50 "Source")

Applies the nest operator to the specified *array*, returning a nested [map](#map). Each entry in the returned map corresponds to a distinct key value returned by the first key function. The entry value depends on the number of registered key functions: if there is an additional key, the value is another map; otherwise, the value is the array of elements filtered from the input *array* that have the given key value. If no keys are defined, returns the input *array*.

<a name="nest_object" href="#nest_object">#</a> <i>nest</i>.<b>object</b>(<i>array</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/nest.js#L49 "Source")

Applies the nest operator to the specified *array*, returning a nested object. Each entry in the returned associative array corresponds to a distinct key value returned by the first key function. The entry value depends on the number of registered key functions: if there is an additional key, the value is another associative array; otherwise, the value is the array of elements filtered from the input *array* that have the given key value.

Note: this method is unsafe if any of the keys conflict with built-in JavaScript properties, such as `__proto__`. If you cannot guarantee that the keys will be safe, you should use [nest.map](#nest_map) instead.

<a name="nest_entries" href="#nest_entries">#</a> <i>nest</i>.<b>entries</b>(<i>array</i>) [<>](https://github.com/d3/d3-collection/blob/master/src/nest.js#L51 "Source")

Applies the nest operator to the specified *array*, returning an array of key-values entries. Conceptually, this is similar to applying [*map*.entries](#map_entries) to the associative array returned by [*nest*.map](#nest_map), but it applies to every level of the hierarchy rather than just the first (outermost) level. Each entry in the returned array corresponds to a distinct key value returned by the first key function. The entry value depends on the number of registered key functions: if there is an additional key, the value is another nested array of entries; otherwise, the value is the array of elements filtered from the input *array* that have the given key value.
