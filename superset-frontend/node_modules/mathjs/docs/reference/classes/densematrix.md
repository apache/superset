<a name="DenseMatrix"></a>
## DenseMatrix
Dense Matrix implementation. This type implements an efficient Array format
for dense matrices.

* _instance_
	* [.storage()](#DenseMatrix+storage) ⇒ <code>string</code>
	* [.datatype()](#DenseMatrix+datatype) ⇒ <code>string</code>
	* [.create(data, [datatype])](#DenseMatrix+create)
	* [.subset(index, [replacement], [defaultValue])](#DenseMatrix+subset)
	* [.get(index)](#DenseMatrix+get) ⇒ <code>\*</code>
	* [.set(index, value, [defaultValue])](#DenseMatrix+set) ⇒ <code>DenseMatrix</code>
	* [.resize(size, [defaultValue], [copy])](#DenseMatrix+resize) ⇒ <code>Matrix</code>
	* [.clone()](#DenseMatrix+clone) ⇒ <code>DenseMatrix</code>
	* [.size()](#DenseMatrix+size) ⇒ <code>Array.&lt;number&gt;</code>
	* [.map(callback)](#DenseMatrix+map) ⇒ <code>DenseMatrix</code>
	* [.forEach(callback)](#DenseMatrix+forEach)
	* [.toArray()](#DenseMatrix+toArray) ⇒ <code>Array</code>
	* [.valueOf()](#DenseMatrix+valueOf) ⇒ <code>Array</code>
	* [.format([options])](#DenseMatrix+format) ⇒ <code>string</code>
	* [.toString()](#DenseMatrix+toString) ⇒ <code>string</code>
	* [.toJSON()](#DenseMatrix+toJSON) ⇒ <code>Object</code>
	* [.diagonal([k])](#DenseMatrix+diagonal) ⇒ <code>Array</code>
	* [.swapRows(i, j)](#DenseMatrix+swapRows) ⇒ <code>Matrix</code>
* _static_
	* [.diagonal(size, value, [k], [defaultValue])](#DenseMatrix.diagonal) ⇒ <code>DenseMatrix</code>
	* [.fromJSON(json)](#DenseMatrix.fromJSON) ⇒ <code>DenseMatrix</code>
	* [.preprocess(data)](#DenseMatrix.preprocess) ⇒ <code>Array</code>

<a name="DenseMatrix+storage"></a>
### denseMatrix.storage() ⇒ <code>string</code>
Get the storage format used by the matrix.

Usage:

```js
var format = matrix.storage()                   // retrieve storage format
```

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>string</code> - The storage format.  
<a name="DenseMatrix+datatype"></a>
### denseMatrix.datatype() ⇒ <code>string</code>
Get the datatype of the data stored in the matrix.

Usage:

```js
var format = matrix.datatype()                   // retrieve matrix datatype
```

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>string</code> - The datatype.  
<a name="DenseMatrix+create"></a>
### denseMatrix.create(data, [datatype])
Create a new DenseMatrix

**Kind**: instance method of <code>DenseMatrix</code> 

| Param | Type |
| --- | --- |
| data | <code>Array</code> | 
| [datatype] | <code>string</code> | 

<a name="DenseMatrix+subset"></a>
### denseMatrix.subset(index, [replacement], [defaultValue])
Get a subset of the matrix, or replace a subset of the matrix.

Usage:

```js
var subset = matrix.subset(index)               // retrieve subset
var value = matrix.subset(index, replacement)   // replace subset
```

**Kind**: instance method of <code>DenseMatrix</code> 

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| index | <code>Index</code> |  |  |
| [replacement] | <code>Array</code> &#124; <code>DenseMatrix</code>&#124; <code>\*</code> |  |  |
| [defaultValue] | <code>\*</code> | <code>0</code> | Default value, filled in on new entries when                                  the matrix is resized. If not provided,                                  new matrix elements will be filled with zeros. |

<a name="DenseMatrix+get"></a>
### denseMatrix.get(index) ⇒ <code>\*</code>
Get a single element from the matrix.

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>\*</code> - value  

| Param | Type | Description |
| --- | --- | --- |
| index | <code>Array.&lt;number&gt;</code> | Zero-based index |

<a name="DenseMatrix+set"></a>
### denseMatrix.set(index, value, [defaultValue]) ⇒ <code>DenseMatrix</code>
Replace a single element in the matrix.

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>DenseMatrix</code>- self  

| Param | Type | Description |
| --- | --- | --- |
| index | <code>Array.&lt;number&gt;</code> | Zero-based index |
| value | <code>\*</code> |  |
| [defaultValue] | <code>\*</code> | Default value, filled in on new entries when                                  the matrix is resized. If not provided,                                  new matrix elements will be left undefined. |

<a name="DenseMatrix+resize"></a>
### denseMatrix.resize(size, [defaultValue], [copy]) ⇒ <code>Matrix</code>
Resize the matrix to the given size. Returns a copy of the matrix when
`copy=true`, otherwise return the matrix itself (resize in place).

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>Matrix</code> - The resized matrix  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| size | <code>Array.&lt;number&gt;</code> |  | The new size the matrix should have. |
| [defaultValue] | <code>\*</code> | <code>0</code> | Default value, filled in on new entries.                                  If not provided, the matrix elements will                                  be filled with zeros. |
| [copy] | <code>boolean</code> |  | Return a resized copy of the matrix |

<a name="DenseMatrix+clone"></a>
### denseMatrix.clone() ⇒ <code>DenseMatrix</code>
Create a clone of the matrix

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>DenseMatrix</code>- clone  
<a name="DenseMatrix+size"></a>
### denseMatrix.size() ⇒ <code>Array.&lt;number&gt;</code>
Retrieve the size of the matrix.

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>Array.&lt;number&gt;</code> - size  
<a name="DenseMatrix+map"></a>
### denseMatrix.map(callback) ⇒ <code>DenseMatrix</code>
Create a new matrix with the results of the callback function executed on
each entry of the matrix.

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>DenseMatrix</code>- matrix  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | The callback function is invoked with three                              parameters: the value of the element, the index                              of the element, and the Matrix being traversed. |

<a name="DenseMatrix+forEach"></a>
### denseMatrix.forEach(callback)
Execute a callback function on each entry of the matrix.

**Kind**: instance method of <code>DenseMatrix</code> 

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | The callback function is invoked with three                              parameters: the value of the element, the index                              of the element, and the Matrix being traversed. |

<a name="DenseMatrix+toArray"></a>
### denseMatrix.toArray() ⇒ <code>Array</code>
Create an Array with a copy of the data of the DenseMatrix

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>Array</code> - array  
<a name="DenseMatrix+valueOf"></a>
### denseMatrix.valueOf() ⇒ <code>Array</code>
Get the primitive value of the DenseMatrix: a multidimensional array

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>Array</code> - array  
<a name="DenseMatrix+format"></a>
### denseMatrix.format([options]) ⇒ <code>string</code>
Get a string representation of the matrix, with optional formatting options.

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>string</code> - str  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> &#124; <code>number</code> &#124; <code>function</code> | Formatting options. See                                                lib/utils/number:format for a                                                description of the available                                                options. |

<a name="DenseMatrix+toString"></a>
### denseMatrix.toString() ⇒ <code>string</code>
Get a string representation of the matrix

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>string</code> - str  
<a name="DenseMatrix+toJSON"></a>
### denseMatrix.toJSON() ⇒ <code>Object</code>
Get a JSON representation of the matrix

**Kind**: instance method of <code>DenseMatrix</code> 
<a name="DenseMatrix+diagonal"></a>
### denseMatrix.diagonal([k]) ⇒ <code>Array</code>
Get the kth Matrix diagonal.

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>Array</code> - The array vector with the diagonal values.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [k] | <code>number</code> &#124; <code>BigNumber</code> | <code>0</code> | The kth diagonal where the vector will retrieved. |

<a name="DenseMatrix+swapRows"></a>
### denseMatrix.swapRows(i, j) ⇒ <code>Matrix</code>
Swap rows i and j in Matrix.

**Kind**: instance method of <code>DenseMatrix</code> 
**Returns**: <code>Matrix</code> - The matrix reference  

| Param | Type | Description |
| --- | --- | --- |
| i | <code>number</code> | Matrix row index 1 |
| j | <code>number</code> | Matrix row index 2 |

<a name="DenseMatrix.diagonal"></a>
### DenseMatrix.diagonal(size, value, [k], [defaultValue]) ⇒ <code>DenseMatrix</code>
Create a diagonal matrix.

**Kind**: static method of <code>DenseMatrix</code> 

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| size | <code>Array</code> |  | The matrix size. |
| value | <code>number</code> &#124; <code>Array</code> |  | The values for the diagonal. |
| [k] | <code>number</code> &#124; <code>BigNumber</code> | <code>0</code> | The kth diagonal where the vector will be filled in. |
| [defaultValue] | <code>number</code> |  | The default value for non-diagonal |

<a name="DenseMatrix.fromJSON"></a>
### DenseMatrix.fromJSON(json) ⇒ <code>DenseMatrix</code>
Generate a matrix from a JSON object

**Kind**: static method of <code>DenseMatrix</code> 

| Param | Type | Description |
| --- | --- | --- |
| json | <code>Object</code> | An object structured like                       `{"mathjs": "DenseMatrix", data: [], size: []}`,                       where mathjs is optional |

<a name="DenseMatrix.preprocess"></a>
### DenseMatrix.preprocess(data) ⇒ <code>Array</code>
Preprocess data, which can be an Array or DenseMatrix with nested Arrays and
Matrices. Replaces all nested Matrices with Arrays

**Kind**: static method of <code>DenseMatrix</code> 
**Returns**: <code>Array</code> - data  

| Param | Type |
| --- | --- |
| data | <code>Array</code> | 

