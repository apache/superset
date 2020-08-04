# w3c-xmlserializer

An XML serializer that follows the [W3C specification](https://w3c.github.io/DOM-Parsing/).

This module is mostly used as an internal part of [jsdom](https://github.com/jsdom/jsdom). However, you can use it independently with some care. That isn't very well-documented yet, but hopefully the below sample can give you an idea.

## Basic usage

```js
const { XMLSerializer } = require("w3c-xmlserializer");
const { JSDOM } = require("jsdom");

const { document } = new JSDOM().window;
const XMLSerializer = XMLSerializer.interface;
const serializer = new XMLSerializer();
const doc = document.createElement("akomaNtoso");

console.log(serializer.serializeToString(doc));
// => '<akomantoso xmlns="http://www.w3.org/1999/xhtml"></akomantoso>'
```
