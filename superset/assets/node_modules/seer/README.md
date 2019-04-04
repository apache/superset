# Seer API

This library provides an abstraction around the [Window.postMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
to interact with the Seer extension.
You could use this module if you have a framework or application that wants to display debugging
information in the Seer Chrome extension.

## Install

Simply download the package from the npm registry

    yarn add seer

## Notes

The extension will declare a `__SEER_INITIALIZED__` boolean on the window,
that you can use to check if the extension is installed and prevent any useless
processing in production or for real-users.

## Internal

How the communication is done exactly relies on the bridge, that you can checkout
in its dedicated [directory](../src/bridge). The following schema represent the
complete data flow:

<img src="https://cdn.pbrd.co/images/92al0O7cY.png" height="300" />

## Functions

<dl>
<dt><a href="#isReady">isReady()</a> ⇒ <code>Boolean</code></dt>
<dd><p>Ready check for Seer initialization</p>
</dd>
<dt><a href="#throttle">throttle(key, delay)</a> ⇒ <code>Boolean</code></dt>
<dd><p>Utility method allowing to throttle a user action based on a key and a minimun delay.</p>
</dd>
<dt><a href="#send">send(type, payload)</a></dt>
<dd><p>Low-level api leveraging window.postMessage</p>
</dd>
<dt><a href="#init">init()</a></dt>
<dd><p>Initilize window listener. There will be only one for the whole process
to prevent too many registrations.</p>
<p>This method will be called automatically if you use the <code>listenFor</code> method.</p>
</dd>
<dt><a href="#clean">clean()</a></dt>
<dd><p>Clean listener. Can be useful in case you want to unregister upcoming events
or liberate memory.</p>
</dd>
<dt><a href="#listenFor">listenFor(key, cb)</a></dt>
<dd><p>Create a listener that will be called upon events of the given key.</p>
</dd>
<dt><a href="#removeListener">removeListener(cb)</a></dt>
<dd><p>Remove an identity listener</p>
</dd>
<dt><a href="#list">list(key, data)</a></dt>
<dd><p>Creates a new indexed list.
It works by index to get O(1) accessing and performance.</p>
</dd>
<dt><a href="#listItem">listItem(key, itemKey, data)</a></dt>
<dd><p>Creates an element in the indexed list, based on the itemKey.</p>
</dd>
<dt><a href="#updateItem">updateItem(key, itemKey, path, data)</a></dt>
<dd><p>Update an item property, can be deeply nested.</p>
</dd>
<dt><a href="#multiUpdate">multiUpdate(key, itemKey, array)</a></dt>
<dd><p>Similar to updateItem, but allows to pass an array with {path,data} pairs for
multiple update of the same item without having to send multiple messages.</p>
</dd>
<dt><a href="#deleteItem">deleteItem(key, itemKey)</a></dt>
<dd><p>Remove a specific item in a specific tab.</p>
</dd>
<dt><a href="#addLog">addLog(key, itemKey, msg)</a></dt>
<dd><p>Will create a log message to an item, that will be displayde with the current time.</p>
</dd>
</dl>

<a name="isReady"></a>

### isReady() ⇒ <code>Boolean</code>
Ready check for Seer initialization

**Kind**: global function  
<a name="throttle"></a>

### throttle(key, delay) ⇒ <code>Boolean</code>
Utility method allowing to throttle a user action based on a key and a minimun delay.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | A unique key |
| delay | <code>Number</code> | The minimal delay to throttle |

<a name="send"></a>

### send(type, payload)
Low-level api leveraging window.postMessage

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>String</code> | The action type |
| payload | <code>Any</code> | The action payload |

<a name="init"></a>

### init()
Initilize window listener. There will be only one for the whole process
to prevent too many registrations.

This method will be called automatically if you use the `listenFor` method.

**Kind**: global function  
<a name="clean"></a>

### clean()
Clean listener. Can be useful in case you want to unregister upcoming events
or liberate memory.

**Kind**: global function  
<a name="listenFor"></a>

### listenFor(key, cb)
Create a listener that will be called upon events of the given key.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | The unique tab key |
| cb | <code>function</code> | A callback that will receive the message payload |

<a name="removeListener"></a>

### removeListener(cb)
Remove an identity listener

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| cb | <code>function</code> | The callback to remove |

<a name="list"></a>

### list(key, data)
Creates a new indexed list.
It works by index to get O(1) accessing and performance.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | The key of the tab |
| data | <code>Object</code> | The indexed object |

<a name="listItem"></a>

### listItem(key, itemKey, data)
Creates an element in the indexed list, based on the itemKey.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | The key of the tab |
| itemKey | <code>String</code> | The key of the item |
| data | <code>Any</code> | The value of the item |

<a name="updateItem"></a>

### updateItem(key, itemKey, path, data)
Update an item property, can be deeply nested.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | The key of the tab |
| itemKey | <code>String</code> | The key of the item |
| path | <code>String</code> | The path of the variable you want to update |
| data | <code>Object</code> | The new value |

<a name="multiUpdate"></a>

### multiUpdate(key, itemKey, array)
Similar to updateItem, but allows to pass an array with {path,data} pairs for
multiple update of the same item without having to send multiple messages.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | The key of the tab |
| itemKey | <code>String</code> | The key of the item |
| array | <code>Array</code> | The array of updates |
| array.path | <code>String</code> | The path for this update |
| array.data | <code>Object</code> | The value of this update |

<a name="deleteItem"></a>

### deleteItem(key, itemKey)
Remove a specific item in a specific tab.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | They key of the tab |
| itemKey | <code>String</code> | The key of the item |

<a name="addLog"></a>

### addLog(key, itemKey, msg)
Will create a log message to an item, that will be displayde with the current time.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>String</code> | The key of the tab |
| itemKey | <code>String</code> | The key of the item |
| msg | <code>String</code> | The message to display |

