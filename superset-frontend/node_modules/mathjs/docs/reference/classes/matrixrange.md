<a name="Range"></a>
## Range
* [new Range(start, end, [step])](#new_Range_new)
* _instance_
	* [.size()](#Range+size) ⇒ <code>Array.&lt;number&gt;</code>
	* [.min()](#Range+min) ⇒ <code>number</code> &#124; <code>undefined</code>
	* [.max()](#Range+max) ⇒ <code>number</code> &#124; <code>undefined</code>
	* [.forEach(callback)](#Range+forEach)
	* [.map(callback)](#Range+map) ⇒ <code>Array</code>
	* [.toArray()](#Range+toArray) ⇒ <code>Array</code>
	* [.valueOf()](#Range+valueOf) ⇒ <code>Array</code>
	* [.format([options])](#Range+format) ⇒ <code>string</code>
	* [.toString()](#Range+toString) ⇒ <code>string</code>
	* [.toJSON()](#Range+toJSON) ⇒ <code>Object</code>
* _static_
	* [.parse(str)](#Range.parse) ⇒ <code>[Range](#Range)</code> &#124; <code>null</code>
	* [.fromJSON(json)](#Range.fromJSON) ⇒ <code>[Range](#Range)</code>

<a name="new_Range_new"></a>
### new Range(start, end, [step])
Create a range. A range has a start, step, and end, and contains functions
to iterate over the range.

A range can be constructed as:

```js
var range = new Range(start, end);
var range = new Range(start, end, step);
```

To get the result of the range:

```js
range.forEach(function (x) {
    console.log(x);
});
range.map(function (x) {
    return math.sin(x);
});
range.toArray();
```

Example usage:

```js
var c = new Range(2, 6);         // 2:1:5
c.toArray();                     // [2, 3, 4, 5]
var d = new Range(2, -3, -1);    // 2:-1:-2
d.toArray();                     // [2, 1, 0, -1, -2]
```

| Param | Type | Description |
| --- | --- | --- |
| start | <code>number</code> | included lower bound |
| end | <code>number</code> | excluded upper bound |
| [step] | <code>number</code> | step size, default value is 1 |

<a name="Range+size"></a>
### range.size() ⇒ <code>Array.&lt;number&gt;</code>
Retrieve the size of the range.
Returns an array containing one number, the number of elements in the range.

**Kind**: instance method of <code>[Range](#Range)</code>  
**Returns**: <code>Array.&lt;number&gt;</code> - size  
<a name="Range+min"></a>
### range.min() ⇒ <code>number</code> &#124; <code>undefined</code>
Calculate the minimum value in the range

**Kind**: instance method of <code>[Range](#Range)</code>  
**Returns**: <code>number</code> &#124; <code>undefined</code> - min  
<a name="Range+max"></a>
### range.max() ⇒ <code>number</code> &#124; <code>undefined</code>
Calculate the maximum value in the range

**Kind**: instance method of <code>[Range](#Range)</code>  
**Returns**: <code>number</code> &#124; <code>undefined</code> - max  
<a name="Range+forEach"></a>
### range.forEach(callback)
Execute a callback function for each value in the range.

**Kind**: instance method of <code>[Range](#Range)</code>  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | The callback method is invoked with three                              parameters: the value of the element, the index                              of the element, and the Range being traversed. |

<a name="Range+map"></a>
### range.map(callback) ⇒ <code>Array</code>
Execute a callback function for each value in the Range, and return the
results as an array

**Kind**: instance method of <code>[Range](#Range)</code>  
**Returns**: <code>Array</code> - array  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | The callback method is invoked with three                              parameters: the value of the element, the index                              of the element, and the Matrix being traversed. |

<a name="Range+toArray"></a>
### range.toArray() ⇒ <code>Array</code>
Create an Array with a copy of the Ranges data

**Kind**: instance method of <code>[Range](#Range)</code>  
**Returns**: <code>Array</code> - array  
<a name="Range+valueOf"></a>
### range.valueOf() ⇒ <code>Array</code>
Get the primitive value of the Range, a one dimensional array

**Kind**: instance method of <code>[Range](#Range)</code>  
**Returns**: <code>Array</code> - array  
<a name="Range+format"></a>
### range.format([options]) ⇒ <code>string</code>
Get a string representation of the range, with optional formatting options.
Output is formatted as 'start:step:end', for example '2:6' or '0:0.2:11'

**Kind**: instance method of <code>[Range](#Range)</code>  
**Returns**: <code>string</code> - str  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> &#124; <code>number</code> &#124; <code>function</code> | Formatting options. See                                                lib/utils/number:format for a                                                description of the available                                                options. |

<a name="Range+toString"></a>
### range.toString() ⇒ <code>string</code>
Get a string representation of the range.

**Kind**: instance method of <code>[Range](#Range)</code>  
<a name="Range+toJSON"></a>
### range.toJSON() ⇒ <code>Object</code>
Get a JSON representation of the range

**Kind**: instance method of <code>[Range](#Range)</code>  
**Returns**: <code>Object</code> - Returns a JSON object structured as:
                  `{"mathjs": "Range", "start": 2, "end": 4, "step": 1}`  
<a name="Range.parse"></a>
### Range.parse(str) ⇒ <code>[Range](#Range)</code> &#124; <code>null</code>
Parse a string into a range,
The string contains the start, optional step, and end, separated by a colon.
If the string does not contain a valid range, null is returned.
For example str='0:2:11'.

**Kind**: static method of <code>[Range](#Range)</code>  
**Returns**: <code>[Range](#Range)</code> &#124; <code>null</code> - range  

| Param | Type |
| --- | --- |
| str | <code>string</code> | 

<a name="Range.fromJSON"></a>
### Range.fromJSON(json) ⇒ <code>[Range](#Range)</code>
Instantiate a Range from a JSON object

**Kind**: static method of <code>[Range](#Range)</code>  

| Param | Type | Description |
| --- | --- | --- |
| json | <code>Object</code> | A JSON object structured as:                      `{"mathjs": "Range", "start": 2, "end": 4, "step": 1}` |

