<a name="Index"></a>
## Index
* [new Index(...ranges)](#new_Index_new)
* _instance_
	* [.valueOf](#Index+valueOf) ⇒ <code>Array</code>
	* [.clone()](#Index+clone) ⇒ <code>[Index](#Index)</code>
	* [.size()](#Index+size) ⇒ <code>Array.&lt;number&gt;</code>
	* [.max()](#Index+max) ⇒ <code>Array.&lt;number&gt;</code>
	* [.min()](#Index+min) ⇒ <code>Array.&lt;number&gt;</code>
	* [.forEach(callback)](#Index+forEach)
	* [.dimension(dim)](#Index+dimension) ⇒ <code>Range</code> &#124; <code>null</code>
	* [.isScalar()](#Index+isScalar) ⇒ <code>boolean</code>
	* [.toArray()](#Index+toArray) ⇒ <code>Array</code>
	* [.toString()](#Index+toString) ⇒ <code>String</code>
	* [.toJSON()](#Index+toJSON) ⇒ <code>Object</code>
* _static_
	* [.fromJSON(json)](#Index.fromJSON) ⇒ <code>[Index](#Index)</code>

<a name="new_Index_new"></a>
### new Index(...ranges)
Create an index. An Index can store ranges and sets for multiple dimensions.
Matrix.get, Matrix.set, and math.subset accept an Index as input.

Usage:
```js
var index = new Index(range1, range2, matrix1, array1, ...);
```

Where each parameter can be any of:

- A number
- An instance of Range
- An Array with the Set values
- A Matrix with the Set values

The parameters start, end, and step must be integer numbers.


| Param | Type |
| --- | --- |
| ...ranges | <code>\*</code> | 

<a name="Index+valueOf"></a>
### index.valueOf ⇒ <code>Array</code>
Get the primitive value of the Index, a two dimensional array.
Equivalent to Index.toArray().

**Kind**: instance property of <code>[Index](#Index)</code>  
**Returns**: <code>Array</code> - array  
<a name="Index+clone"></a>
### index.clone() ⇒ <code>[Index](#Index)</code>
Create a clone of the index

**Kind**: instance method of <code>[Index](#Index)</code>  
**Returns**: <code>[Index](#Index)</code> - clone  
<a name="Index+size"></a>
### index.size() ⇒ <code>Array.&lt;number&gt;</code>
Retrieve the size of the index, the number of elements for each dimension.

**Kind**: instance method of <code>[Index](#Index)</code>  
**Returns**: <code>Array.&lt;number&gt;</code> - size  
<a name="Index+max"></a>
### index.max() ⇒ <code>Array.&lt;number&gt;</code>
Get the maximum value for each of the indexes ranges.

**Kind**: instance method of <code>[Index](#Index)</code>  
**Returns**: <code>Array.&lt;number&gt;</code> - max  
<a name="Index+min"></a>
### index.min() ⇒ <code>Array.&lt;number&gt;</code>
Get the minimum value for each of the indexes ranges.

**Kind**: instance method of <code>[Index](#Index)</code>  
**Returns**: <code>Array.&lt;number&gt;</code> - min  
<a name="Index+forEach"></a>
### index.forEach(callback)
Loop over each of the ranges of the index

**Kind**: instance method of <code>[Index](#Index)</code>  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | Called for each range with a Range as first                              argument, the dimension as second, and the                              index object as third. |

<a name="Index+dimension"></a>
### index.dimension(dim) ⇒ <code>Range</code> &#124; <code>null</code>
Retrieve the dimension for the given index

**Kind**: instance method of <code>[Index](#Index)</code>  
**Returns**: <code>Range</code> &#124; <code>null</code> - range  

| Param | Type | Description |
| --- | --- | --- |
| dim | <code>Number</code> | Number of the dimension |

<a name="Index+isScalar"></a>
### index.isScalar() ⇒ <code>boolean</code>
Test whether this index contains only a single value.

This is the case when the index is created with only scalar values as ranges,
not for ranges resolving into a single value.

**Kind**: instance method of <code>[Index](#Index)</code>  
**Returns**: <code>boolean</code> - isScalar  
<a name="Index+toArray"></a>
### index.toArray() ⇒ <code>Array</code>
Expand the Index into an array.
For example new Index([0,3], [2,7]) returns [[0,1,2], [2,3,4,5,6]]

**Kind**: instance method of <code>[Index](#Index)</code>  
**Returns**: <code>Array</code> - array  
<a name="Index+toString"></a>
### index.toString() ⇒ <code>String</code>
Get the string representation of the index, for example '[2:6]' or '[0:2:10, 4:7, [1,2,3]]'

**Kind**: instance method of <code>[Index](#Index)</code>  
**Returns**: <code>String</code> - str  
<a name="Index+toJSON"></a>
### index.toJSON() ⇒ <code>Object</code>
Get a JSON representation of the Index

**Kind**: instance method of <code>[Index](#Index)</code>  
**Returns**: <code>Object</code> - Returns a JSON object structured as:
                  `{"mathjs": "Index", "ranges": [{"mathjs": "Range", start: 0, end: 10, step:1}, ...]}`  
<a name="Index.fromJSON"></a>
### Index.fromJSON(json) ⇒ <code>[Index](#Index)</code>
Instantiate an Index from a JSON object

**Kind**: static method of <code>[Index](#Index)</code>  

| Param | Type | Description |
| --- | --- | --- |
| json | <code>Object</code> | A JSON object structured as:                     `{"mathjs": "Index", "dimensions": [{"mathjs": "Range", start: 0, end: 10, step:1}, ...]}` |

