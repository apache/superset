# Parse `Content-Type` Header Strings

This package will parse the [`Content-Type`](https://tools.ietf.org/html/rfc7231#section-3.1.1.1) header field into an introspectable data structure, whose parameters can be manipulated:

```js
const contentTypeParser = require("content-type-parser");

const contentType = contentTypeParser(`Text/HTML;Charset="utf-8"`);

console.assert(contentType.toString() === "text/html;charset=utf-8");

console.assert(contentType.type === "text");
console.assert(contentType.subtype === "html");
console.assert(contentType.get("charset") === "utf-8");

contentType.set("charset", "windows-1252");
console.assert(contentType.get("charset") === "windows-1252");
console.assert(contentType.toString() === "text/html;charset=windows-1252");

console.assert(contentType.isHTML() === true);
console.assert(contentType.isXML() === false);
console.assert(contentType.isText() === true);
```

Note how parsing will lowercase the type, subtype, and parameter name tokens (but not parameter values).

If the passed string cannot be parsed as a content-type, `contentTypeParser` will return `null`.

## `ContentType` instance API

This package's main module's default export will return an instance of the `ContentType` class, which has the following public APIs:

### Properties

- `type`: the top-level media type, e.g. `"text"`
- `subtype`: the subtype, e.g. `"html"`
- `parameterList`: an array of `{ separator, key, value }` pairs representing the parameters. The `separator` field contains any whitespace, not just the `;` character.

### Parameter manipulation

In general you should not directly manipulate `parameterList`. Instead, use the following APIs:

- `get("key")`: returns the value of the parameter with the given key, or `undefined` if no such parameter is present
- `set("key", "value")`: adds the given key/value pair to the parameter list, or overwrites the existing value if an entry already existed

Both of these will lowercase the keys.

### MIME type tests

- `isHTML()`: returns true if this instance's MIME type is [the HTML MIME type](https://html.spec.whatwg.org/multipage/infrastructure.html#html-mime-type), `"text/html"`
- `isXML()`: returns true if this instance's MIME type is [an XML MIME type](https://html.spec.whatwg.org/multipage/infrastructure.html#xml-mime-type)
- `isText()`: returns true if this instance's top-level media type is `"text"`

### Serialization

- `toString()` will return a canonicalized representation of the content-type, re-built from the parsed components

## Credits

This package was originally based on the excellent work of [@nicolashenry](https://github.com/nicolashenry), [in jsdom](https://github.com/tmpvar/jsdom/blob/16fd85618f2705d181232f6552125872a37164bc/lib/jsdom/living/helpers/headers.js). It has since been pulled out into this separate package.
