<p align="center">
  <img src="https://raw.github.com/inikulin/parse5/master/logo.png" alt="parse5" />
</p>

[![Build Status](https://api.travis-ci.org/inikulin/parse5.svg)](https://travis-ci.org/inikulin/parse5)
[![npm](https://img.shields.io/npm/v/parse5.svg)](https://www.npmjs.com/package/parse5)

*WHATWG HTML5 specification-compliant, fast and ready for production HTML parsing/serialization toolset for Node and io.js.*

I needed fast and ready for production HTML parser, which will parse HTML as a modern browser's parser.
Existing solutions were either too slow or their output was too inaccurate. So, this is how parse5 was born.

**Included tools:**
*   [Parser](#class-parser) - HTML to DOM-tree parser.
*   [SimpleApiParser](#class-simpleapiparser) - [SAX](http://en.wikipedia.org/wiki/Simple_API_for_XML)-style parser for HTML.
*   [Serializer](#class-serializer) - DOM-tree to HTML code serializer.

## Install
```
$ npm install parse5
```


## Usage
```js
var Parser = require('parse5').Parser;

//Instantiate parser
var parser = new Parser();

//Then feed it with an HTML document
var document = parser.parse('<!DOCTYPE html><html><head></head><body>Hi there!</body></html>')

//Now let's parse HTML-snippet
var fragment = parser.parseFragment('<title>Parse5 is &#102;&#117;&#99;&#107;ing awesome!</title><h1>42</h1>');

```

## Is it fast?
Check out [this benchmark](https://github.com/inikulin/node-html-parser-bench).

```
Starting benchmark. Fasten your seatbelts...
html5 (https://github.com/aredridel/html5) x 0.18 ops/sec ±5.92% (5 runs sampled)
htmlparser (https://github.com/tautologistics/node-htmlparser/) x 3.83 ops/sec ±42.43% (14 runs sampled)
htmlparser2 (https://github.com/fb55/htmlparser2) x 4.05 ops/sec ±39.27% (15 runs sampled)
parse5 (https://github.com/inikulin/parse5) x 3.04 ops/sec ±51.81% (13 runs sampled)
Fastest is htmlparser2 (https://github.com/fb55/htmlparser2),parse5 (https://github.com/inikulin/parse5)
```

So, parse5 is as fast as simple specification incompatible parsers and ~15-times(!) faster than the current specification compatible parser available for the node.


## API reference

### Enum: TreeAdapters
Provides built-in tree adapters which can be passed as an optional argument to the `Parser` and `Serializer` constructors.

#### &bull; TreeAdapters.default
Default tree format for parse5.


#### &bull; TreeAdapters.htmlparser2
Quite popular [htmlparser2](https://github.com/fb55/htmlparser2) tree format (e.g. used in [cheerio](https://github.com/MatthewMueller/cheerio) and [jsdom](https://github.com/tmpvar/jsdom)).

---------------------------------------


### Class: Parser
Provides HTML parsing functionality.

#### &bull; Parser.ctor([treeAdapter, options])
Creates new reusable instance of the `Parser`. Optional `treeAdapter` argument specifies resulting tree format. If `treeAdapter` argument is not specified, `default` tree adapter will be used.

`options` object provides the parsing algorithm modifications:
#####  options.decodeHtmlEntities
Decode HTML-entities like `&amp;`, `&nbsp;`, etc.  Default: `true`. **Warning:** disabling this option may cause output which is not conform HTML5 specification.
#####  options.locationInfo
Enables source code location information for the nodes. Default: `false`. When enabled, each node (except root node) has `__location` property, which contains `start` and `end` indices of the node in the source code. If element was implicitly created by the parser it's `__location` property will be `null`. In case the node is not an empty element, `__location` has two addition properties `startTag` and `endTag` which contain location information for individual tags in a fashion similar to `__location` property.

*Example:*
```js
var parse5 = require('parse5');

//Instantiate new parser with default tree adapter
var parser1 = new parse5.Parser();

//Instantiate new parser with htmlparser2 tree adapter
var parser2 = new parse5.Parser(parse5.TreeAdapters.htmlparser2);
```



#### &bull; Parser.parse(html)
Parses specified `html` string. Returns `document` node.

*Example:*
```js
var document = parser.parse('<!DOCTYPE html><html><head></head><body>Hi there!</body></html>');
```


#### &bull; Parser.parseFragment(htmlFragment, [contextElement])
Parses given `htmlFragment`. Returns `documentFragment` node. Optional `contextElement` argument specifies context in which given `htmlFragment` will be parsed (consider it as setting `contextElement.innerHTML` property). If `contextElement` argument is not specified then `<template>` element will be used as a context and fragment will be parsed in 'forgiving' manner.

*Example:*
```js
var documentFragment = parser.parseFragment('<table></table>');

//Parse html fragment in context of the parsed <table> element
var trFragment = parser.parseFragment('<tr><td>Shake it, baby</td></tr>', documentFragment.childNodes[0]);
```

---------------------------------------


### Class: SimpleApiParser
Provides [SAX](https://en.wikipedia.org/wiki/Simple_API_for_XML)-style HTML parsing functionality.

#### &bull; SimpleApiParser.ctor(handlers, [options])
Creates new reusable instance of the `SimpleApiParser`. `handlers` argument specifies object that contains parser's event handlers. Possible events and their signatures are shown in the example.

`options` object provides the parsing algorithm modifications:
##### options.decodeHtmlEntities
Decode HTML-entities like `&amp;`, `&nbsp;`, etc.  Default: `true`. **Warning:** disabling this option may cause output which is not conform HTML5 specification.
##### options.locationInfo
Enables source code location information for the tokens. Default: `false`. When enabled, each node handler receives `location` object as it's last argument. `location` object contains `start` and `end` indices of the token in the source code.


*Example:*
```js
var parse5 = require('parse5');

var parser = new parse5.SimpleApiParser({
    doctype: function(name, publicId, systemId /*, [location] */) {
        //Handle doctype here
    },

    startTag: function(tagName, attrs, selfClosing /*, [location] */) {
        //Handle start tags here
    },

    endTag: function(tagName /*, [location] */) {
        //Handle end tags here
    },

    text: function(text /*, [location] */) {
        //Handle texts here
    },

    comment: function(text /*, [location] */) {
        //Handle comments here
    }
});
```

#### &bull; SimpleApiParser.parse(html)
Raises parser events for the given `html`.

*Example:*
```js
var parse5 = require('parse5');

var parser = new parse5.SimpleApiParser({
    text: function(text) {
        console.log(text);
    }
});

parser.parse('<body>Yo!</body>');
```

---------------------------------------

### Class: Serializer
Provides tree-to-HTML serialization functionality.
**Note:** prior to v1.2.0 this class was called `TreeSerializer`. However, it's still accessible as `parse5.TreeSerializer` for backward compatibility.

#### &bull; Serializer.ctor([treeAdapter, options])
Creates new reusable instance of the `Serializer`. Optional `treeAdapter` argument specifies input tree format. If `treeAdapter` argument is not specified, `default` tree adapter will be used.

`options` object provides the serialization algorithm modifications:
##### options.encodeHtmlEntities
HTML-encode characters like `<`, `>`, `&`, etc.  Default: `true`.  **Warning:** disabling this option may cause output which is not conform HTML5 specification.


*Example:*
```js
var parse5 = require('parse5');

//Instantiate new serializer with default tree adapter
var serializer1 = new parse5.Serializer();

//Instantiate new serializer with htmlparser2 tree adapter
var serializer2 = new parse5.Serializer(parse5.TreeAdapters.htmlparser2);
```


#### &bull; Serializer.serialize(node)
Serializes the given `node`. Returns HTML string.

*Example:*
```js
var document = parser.parse('<!DOCTYPE html><html><head></head><body>Hi there!</body></html>');

//Serialize document
var html = serializer.serialize(document);

//Serialize <body> element content
var bodyInnerHtml = serializer.serialize(document.childNodes[0].childNodes[1]);
```

---------------------------------------


## Testing
Test data is adopted from [html5lib project](https://github.com/html5lib). Parser is covered by more than 8000 test cases.
To run tests:
```
$ npm test
```


## Custom tree adapter
You can create a custom tree adapter so parse5 can work with your own DOM-tree implementation.
Just pass your adapter implementation to the parser's constructor as an argument:

```js
var Parser = require('parse5').Parser;

var myTreeAdapter = {
   //Adapter methods...
};

//Instantiate parser
var parser = new Parser(myTreeAdapter);
```

Sample implementation can be found [here](https://github.com/inikulin/parse5/blob/master/lib/tree_adapters/default.js).
The custom tree adapter should implement all methods exposed via `exports` in the sample implementation.

## Questions or suggestions?
If you have any questions, please feel free to create an issue [here on github](https://github.com/inikulin/parse5/issues).


## Author
[Ivan Nikulin](https://github.com/inikulin) (ifaaan@gmail.com)
