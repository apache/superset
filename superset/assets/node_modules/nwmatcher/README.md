# [NWMatcher](http://dperini.github.io/nwmatcher/)

A fast CSS selector engine and matcher.


## Installation

To include NWMatcher in a standard web page:

```html
<script type="text/javascript" src="nwmatcher.js"></script>
```

To use it with Node.js:

```
$ npm install nwmatcher
```

NWMatcher currently supports browsers (as a global, `NW.Dom`) and headless environments (as a CommonJS module).


## Supported Selectors

Here is a list of all the CSS2/CSS3 [Supported selectors](https://github.com/dperini/nwmatcher/wiki/CSS-supported-selectors).


## Features and Compliance

You can read more about NWMatcher [features and compliance](https://github.com/dperini/nwmatcher/wiki/Features-and-compliance) on the wiki.


## API

### DOM Selection

#### `first( selector, context )`

Returns a reference to the first element matching `selector`, starting at `context`.

#### `match( element, selector, context )`

Returns `true` if `element` matches `selector`, starting at `context`; returns `false` otherwise.

#### `select( selector, context, callback )`

Returns an array of all the elements matching `selector`, starting at `context`. If `callback` is provided, it is invoked for each matching element.


### DOM Helpers

#### `byId( id, from )`

Returns a reference to the first element with ID `id`, optionally filtered to descendants of the element `from`.

#### `byTag( tag, from )`

Returns an array of elements having the specified tag name `tag`, optionally filtered to descendants of the element `from`.

#### `byClass( class, from )`

Returns an array of elements having the specified class name `class`, optionally filtered to descendants of the element `from`.

#### `byName( name, from )`

Returns an array of elements having the specified value `name` for their name attribute, optionally filtered to descendants of the element `from`.

#### `getAttribute( element, attribute )`

Return the value read from the attribute of `element` with name `attribute`, as a string.

#### `hasAttribute( element, attribute )`

Returns true `element` has an attribute with name `attribute` set; returns `false` otherwise.


### Engine Configuration

#### `configure( options )`

The following is the list of currently available configuration options, their default values and descriptions, they are boolean flags that can be set to `true` or `false`:

* `CACHING`:   false - false to disable caching of result sets, true to enable
* `ESCAPECHR`: true  - true to allow CSS escaped identifiers, false to disallow
* `NON_ASCII`: true  - true to allow identifiers containing non-ASCII (utf-8) chars
* `SELECTOR3`: true  - switch syntax RE, true to use Level 3, false to use Level 2
* `UNICODE16`: true  - true to allow identifiers containing Unicode (utf-16) chars
* `SHORTCUTS`: false - false to disable mangled selector strings like "+div" or "ul>"
* `SIMPLENOT`: true  - true to disallow complex selectors nested in ':not()' classes
* `SVG_LCASE`: false - false to disable matching lowercase tag names of SVG elements
* `UNIQUE_ID`: true  - true to disallow multiple elements with the same id (strict)
* `USE_HTML5`: true  - true to use HTML5 specs for ":checked" and similar UI states
* `USE_QSAPI`: true  - true to use browsers native Query Selector API if available
* `VERBOSITY`: true  - true to throw exceptions, false to skip throwing exceptions
* `LOGERRORS`: true  - true to print console errors or warnings, false to mute them

Example:

```js
NW.Dom.configure( { USE_QSAPI: false, VERBOSITY: false } );
```

#### `registerOperator( symbol, resolver )`

Registers a new symbol and its matching resolver in the operators table. Example:

```js
NW.Dom.registerOperator( '!=', 'n!="%m"' );
```

#### `registerSelector( name, rexp, func )`

Registers a new selector, with the matching regular expression and the appropriate resolver function, in the selectors table.
