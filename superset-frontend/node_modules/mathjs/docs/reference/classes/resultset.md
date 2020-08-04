<a name="ResultSet"></a>
## ResultSet
* [new ResultSet(entries)](#new_ResultSet_new)
* _instance_
	* [.valueOf()](#ResultSet+valueOf) ⇒ <code>Array</code>
	* [.toString()](#ResultSet+toString) ⇒ <code>string</code>
	* [.toJSON()](#ResultSet+toJSON) ⇒ <code>Object</code>
* _static_
	* [.fromJSON(json)](#ResultSet.fromJSON) ⇒ <code>[ResultSet](#ResultSet)</code>

<a name="new_ResultSet_new"></a>
### new ResultSet(entries)
A ResultSet contains a list or results


| Param | Type |
| --- | --- |
| entries | <code>Array</code> | 

<a name="ResultSet+valueOf"></a>
### resultSet.valueOf() ⇒ <code>Array</code>
Returns the array with results hold by this ResultSet

**Kind**: instance method of <code>[ResultSet](#ResultSet)</code>  
**Returns**: <code>Array</code> - entries  
<a name="ResultSet+toString"></a>
### resultSet.toString() ⇒ <code>string</code>
Returns the stringified results of the ResultSet

**Kind**: instance method of <code>[ResultSet](#ResultSet)</code>  
**Returns**: <code>string</code> - string  
<a name="ResultSet+toJSON"></a>
### resultSet.toJSON() ⇒ <code>Object</code>
Get a JSON representation of the ResultSet

**Kind**: instance method of <code>[ResultSet](#ResultSet)</code>  
**Returns**: <code>Object</code> - Returns a JSON object structured as:                  `{"mathjs": "ResultSet", "entries": [...]}`  
<a name="ResultSet.fromJSON"></a>
### ResultSet.fromJSON(json) ⇒ <code>[ResultSet](#ResultSet)</code>
Instantiate a ResultSet from a JSON object

**Kind**: static method of <code>[ResultSet](#ResultSet)</code>  

| Param | Type | Description |
| --- | --- | --- |
| json | <code>Object</code> | A JSON object structured as:                       `{"mathjs": "ResultSet", "entries": [...]}` |

