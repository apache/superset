<a name="SparseMatrix"></a>
## SparseMatrix
Sparse Matrix implementation. This type implements a Compressed Column Storage format
for sparse matrices.

* _instance_
	* [.storage()](#SparseMatrix+storage) ⇒ <code>string</code>
	* [.datatype()](#SparseMatrix+datatype) ⇒ <code>string</code>
	* [.create(data, [datatype])](#SparseMatrix+create)
	* [.density()](#SparseMatrix+density) ⇒ <code>number</code>
	* [.subset(index, [replacement], [defaultValue])](#SparseMatrix+subset)
	* [.get(index)](#SparseMatrix+get) ⇒ <code>\*</code>
	* [.set(index, value, [defaultValue])](#SparseMatrix+set) ⇒ <code>[SparseMatrix](#SparseMatrix)</code>
	* [.resize(size, [defaultValue], [copy])](#SparseMatrix+resize) ⇒ <code>Matrix</code>
	* [.clone()](#SparseMatrix+clone) ⇒ <code>[SparseMatrix](#SparseMatrix)</code>
	* [.size()](#SparseMatrix+size) ⇒ <code>Array.&lt;number&gt;</code>
	* [.map(callback, [skipZeros])](#SparseMatrix+map) ⇒ <code>[SparseMatrix](#SparseMatrix)</code>
	* [.forEach(callback, [skipZeros])](#SparseMatrix+forEach)
	* [.toArray()](#SparseMatrix+toArray) ⇒ <code>Array</code>
	* [.valueOf()](#SparseMatrix+valueOf) ⇒ <code>Array</code>
	* [.format([options])](#SparseMatrix+format) ⇒ <code>string</code>
	* [.toString()](#SparseMatrix+toString) ⇒ <code>string</code>
	* [.toJSON()](#SparseMatrix+toJSON) ⇒ <code>Object</code>
	* [.diagonal([k])](#SparseMatrix+diagonal) ⇒ <code>Matrix</code>
	* [.swapRows(i, j)](#SparseMatrix+swapRows) ⇒ <code>Matrix</code>
* _static_
	* [.fromJSON(json)](#SparseMatrix.fromJSON) ⇒ <code>[SparseMatrix](#SparseMatrix)</code>
	* [.diagonal(size, value, [k], [datatype])](#SparseMatrix.diagonal) ⇒ <code>[SparseMatrix](#SparseMatrix)</code>

<a name="SparseMatrix+storage"></a>
### sparseMatrix.storage() ⇒ <code>string</code>
Get the storage format used by the matrix.

Usage:
```js
var format = matrix.storage()                   // retrieve storage format
```

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>string</code> - The storage format.  
<a name="SparseMatrix+datatype"></a>
### sparseMatrix.datatype() ⇒ <code>string</code>
Get the datatype of the data stored in the matrix.

Usage:
```js
var format = matrix.datatype()                   // retrieve matrix datatype
```

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>string</code> - The datatype.  
<a name="SparseMatrix+create"></a>
### sparseMatrix.create(data, [datatype])
Create a new SparseMatrix

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  

| Param | Type |
| --- | --- |
| data | <code>Array</code> | 
| [datatype] | <code>string</code> | 

<a name="SparseMatrix+density"></a>
### sparseMatrix.density() ⇒ <code>number</code>
Get the matrix density.

Usage:
```js
var density = matrix.density()                   // retrieve matrix density
```

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>number</code> - The matrix density.  
<a name="SparseMatrix+subset"></a>
### sparseMatrix.subset(index, [replacement], [defaultValue])
Get a subset of the matrix, or replace a subset of the matrix.

Usage:
```js
var subset = matrix.subset(index)               // retrieve subset
var value = matrix.subset(index, replacement)   // replace subset
```

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| index | <code>Index</code> |  |  |
| [replacement] | <code>Array</code> &#124; <code>Maytrix</code> &#124; <code>\*</code> |  |  |
| [defaultValue] | <code>\*</code> | <code>0</code> | Default value, filled in on new entries when                                  the matrix is resized. If not provided,                                  new matrix elements will be filled with zeros. |

<a name="SparseMatrix+get"></a>
### sparseMatrix.get(index) ⇒ <code>\*</code>
Get a single element from the matrix.

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>\*</code> - value  

| Param | Type | Description |
| --- | --- | --- |
| index | <code>Array.&lt;number&gt;</code> | Zero-based index |

<a name="SparseMatrix+set"></a>
### sparseMatrix.set(index, value, [defaultValue]) ⇒ <code>[SparseMatrix](#SparseMatrix)</code>
Replace a single element in the matrix.

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>[SparseMatrix](#SparseMatrix)</code> - self  

| Param | Type | Description |
| --- | --- | --- |
| index | <code>Array.&lt;number&gt;</code> | Zero-based index |
| value | <code>\*</code> |  |
| [defaultValue] | <code>\*</code> | Default value, filled in on new entries when                                  the matrix is resized. If not provided,                                  new matrix elements will be set to zero. |

<a name="SparseMatrix+resize"></a>
### sparseMatrix.resize(size, [defaultValue], [copy]) ⇒ <code>Matrix</code>
Resize the matrix to the given size. Returns a copy of the matrix when 
`copy=true`, otherwise return the matrix itself (resize in place).

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>Matrix</code> - The resized matrix  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| size | <code>Array.&lt;number&gt;</code> |  | The new size the matrix should have. |
| [defaultValue] | <code>\*</code> | <code>0</code> | Default value, filled in on new entries.                                  If not provided, the matrix elements will                                  be filled with zeros. |
| [copy] | <code>boolean</code> |  | Return a resized copy of the matrix |

<a name="SparseMatrix+clone"></a>
### sparseMatrix.clone() ⇒ <code>[SparseMatrix](#SparseMatrix)</code>
Create a clone of the matrix

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>[SparseMatrix](#SparseMatrix)</code> - clone  
<a name="SparseMatrix+size"></a>
### sparseMatrix.size() ⇒ <code>Array.&lt;number&gt;</code>
Retrieve the size of the matrix.

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>Array.&lt;number&gt;</code> - size  
<a name="SparseMatrix+map"></a>
### sparseMatrix.map(callback, [skipZeros]) ⇒ <code>[SparseMatrix](#SparseMatrix)</code>
Create a new matrix with the results of the callback function executed on
each entry of the matrix.

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>[SparseMatrix](#SparseMatrix)</code> - matrix  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | The callback function is invoked with three                              parameters: the value of the element, the index                              of the element, and the Matrix being traversed. |
| [skipZeros] | <code>boolean</code> | Invoke callback function for non-zero values only. |

<a name="SparseMatrix+forEach"></a>
### sparseMatrix.forEach(callback, [skipZeros])
Execute a callback function on each entry of the matrix.

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | The callback function is invoked with three                              parameters: the value of the element, the index                              of the element, and the Matrix being traversed. |
| [skipZeros] | <code>boolean</code> | Invoke callback function for non-zero values only. |

<a name="SparseMatrix+toArray"></a>
### sparseMatrix.toArray() ⇒ <code>Array</code>
Create an Array with a copy of the data of the SparseMatrix

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>Array</code> - array  
<a name="SparseMatrix+valueOf"></a>
### sparseMatrix.valueOf() ⇒ <code>Array</code>
Get the primitive value of the SparseMatrix: a two dimensions array

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>Array</code> - array  
<a name="SparseMatrix+format"></a>
### sparseMatrix.format([options]) ⇒ <code>string</code>
Get a string representation of the matrix, with optional formatting options.

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>string</code> - str  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> &#124; <code>number</code> &#124; <code>function</code> | Formatting options. See                                                lib/utils/number:format for a                                                description of the available                                                options. |

<a name="SparseMatrix+toString"></a>
### sparseMatrix.toString() ⇒ <code>string</code>
Get a string representation of the matrix

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>string</code> - str  
<a name="SparseMatrix+toJSON"></a>
### sparseMatrix.toJSON() ⇒ <code>Object</code>
Get a JSON representation of the matrix

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
<a name="SparseMatrix+diagonal"></a>
### sparseMatrix.diagonal([k]) ⇒ <code>Matrix</code>
Get the kth Matrix diagonal.

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>Matrix</code> - The matrix vector with the diagonal values.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [k] | <code>number</code> &#124; <code>BigNumber</code> | <code>0</code> | The kth diagonal where the vector will retrieved. |

<a name="SparseMatrix+swapRows"></a>
### sparseMatrix.swapRows(i, j) ⇒ <code>Matrix</code>
Swap rows i and j in Matrix.

**Kind**: instance method of <code>[SparseMatrix](#SparseMatrix)</code>  
**Returns**: <code>Matrix</code> - The matrix reference  

| Param | Type | Description |
| --- | --- | --- |
| i | <code>number</code> | Matrix row index 1 |
| j | <code>number</code> | Matrix row index 2 |

<a name="SparseMatrix.fromJSON"></a>
### SparseMatrix.fromJSON(json) ⇒ <code>[SparseMatrix](#SparseMatrix)</code>
Generate a matrix from a JSON object

**Kind**: static method of <code>[SparseMatrix](#SparseMatrix)</code>  

| Param | Type | Description |
| --- | --- | --- |
| json | <code>Object</code> | An object structured like                       `{"mathjs": "SparseMatrix", "values": [], "index": [], "ptr": [], "size": []}`,                       where mathjs is optional |

<a name="SparseMatrix.diagonal"></a>
### SparseMatrix.diagonal(size, value, [k], [datatype]) ⇒ <code>[SparseMatrix](#SparseMatrix)</code>
Create a diagonal matrix.

**Kind**: static method of <code>[SparseMatrix](#SparseMatrix)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| size | <code>Array</code> |  | The matrix size. |
| value | <code>number</code> &#124; <code>Array</code> &#124; <code>Matrix</code> |  | The values for the diagonal. |
| [k] | <code>number</code> &#124; <code>BigNumber</code> | <code>0</code> | The kth diagonal where the vector will be filled in. |
| [datatype] | <code>string</code> |  | The Matrix datatype, values must be of this datatype. |

