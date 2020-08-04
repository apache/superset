# saxes

A sax-style non-validating parser for XML.

Saxes is a fork of [sax](https://github.com/isaacs/sax-js) 1.2.4. All mentions
of sax in this project's documentation are references to sax 1.2.4.

Designed with [node](http://nodejs.org/) in mind, but should work fine in the
browser or other CommonJS implementations.

Saxes does not support Node versions older than 8.

## Notable Differences from Sax.

* Saxes aims to be much stricter than sax with regards to XML
  well-formedness. Sax, even in its so-called "strict mode", is not strict. It
  silently accepts structures that are not well-formed XML. Projects that need
  better compliance with well-formedness constraints cannot use sax as-is.
  Saxes aims for conformance with [XML 1.0 fifth
  edition](https://www.w3.org/TR/2008/REC-xml-20081126/) and [XML Namespaces 1.0
  third edition](http://www.w3.org/TR/2009/REC-xml-names-20091208/).

  Consequently, saxes does not support HTML, or pseudo-XML, or bad XML.

* Saxes is much much faster than sax, mostly because of a substantial redesign
  of the internal parsing logic. The speed improvement is not merely due to
  removing features that were supported by sax. That helped a bit, but saxes
  adds some expensive checks in its aim for conformance with the XML
  specification. Redesigning the parsing logic is what accounts for most of the
  performance improvement.

* Saxes does not aim to support antiquated platforms. We will not pollute the
  source or the default build with support for antiquated platforms. If you want
  support for IE 11, you are welcome to produce a PR that adds a *new build*
  transpiled to ES5.

* Saxes handles errors differently from sax: it provides a default onerror
  handler which throws. You can replace it with your own handler if you want. If
  your handler does nothing, there is no `resume` method to call.

* There's no `Stream` API. A revamped API may be introduced later. (It is still
  a "streaming parser" in the general sense that you write a character stream to
  it.)

* Saxes does not have facilities for limiting the size the data chunks passed to
  event handlers. See the FAQ entry for more details.

## Limitations

This is a non-validating parser so it only verifies whether the document is
well-formed. We do aim to raise errors for all malformed constructs encountered.

However, this parser does not parse the contents of DTDs. So malformedness
errors caused by errors in DTDs cannot be reported.

Also, the parser continues to parse even upon encountering errors, and does its
best to continue reporting errors. You should heed all errors
reported.

**HOWEVER, ONCE AN ERROR HAS BEEN ENCOUNTERED YOU CANNOT RELY ON THE DATA
PROVIDED THROUGH THE OTHER EVENT HANDLERS.**

After an error, saxes tries to make sense of your document, but it may interpret
it incorrectly. For instance ``<foo a=bc="d"/>`` is invalid XML. Did you mean to
have ``<foo a="bc=d"/>`` or ``<foo a="b" c="d"/>`` or some other variation?
Saxes takes an honest stab at figuring out your mangled XML. That's as good as
it gets.

## Regarding `<!DOCTYPE`s and `<!ENTITY`s

The parser will handle the basic XML entities in text nodes and attribute
values: `&amp; &lt; &gt; &apos; &quot;`. It's possible to define additional
entities in XML by putting them in the DTD. This parser doesn't do anything with
that. If you want to listen to the `ondoctype` event, and then fetch the
doctypes, and read the entities and add them to `parser.ENTITIES`, then be my
guest.

## Documentation

The source code contains JSDOC comments. Use them.

**PAY CLOSE ATTENTION TO WHAT IS PUBLIC AND WHAT IS PRIVATE.**

The elements of code that do not have JSDOC documentation, or have documentation
with the ``@private`` tag, are private.

If you use anything private, that's at your own peril.

If there's a mistake in the documentation, raise an issue. If you just assume,
you may assume incorrectly.

## Summary Usage Information

### Example

```javascript
var saxes = require("./lib/saxes"),
  parser = new saxes.SaxesParser();

parser.onerror = function (e) {
  // an error happened.
};
parser.ontext = function (t) {
  // got some text.  t is the string of text.
};
parser.onopentag = function (node) {
  // opened a tag.  node has "name" and "attributes"
};
parser.onend = function () {
  // parser stream is done, and ready to have more stuff written to it.
};

parser.write('<xml>Hello, <who name="world">world</who>!</xml>').close();
```

### Constructor Arguments

Pass the following arguments to the parser function. All are optional.

`opt` - Object bag of settings regarding string formatting.

Settings supported:

* `xmlns` - Boolean. If `true`, then namespaces are supported. Default
  is `false`.

* `position` - Boolean. If `false`, then don't track line/col/position. Unset is
  treated as `true`. Default is unset.

* `fileName` - String. Set a file name for error reporting. This is useful only
  when tracking positions. You may leave it unset, in which case the file name
  in error messages will be `undefined`.

* `fragment` - Boolean. If `true`, parse the XML as an XML fragment. Default is
  `false`.

* `additionalNamespaces` - A plain object whose key, value pairs define
   namespaces known before parsing the XML file. It is not legal to pass
   bindings for the namespaces `"xml"` or `"xmlns"`.

### Methods

`write` - Write bytes onto the stream. You don't have to do this all at
once. You can keep writing as much as you want.

`close` - Close the stream. Once closed, no more data may be written until it is
done processing the buffer, which is signaled by the `end` event.

### Properties

The parser has the following properties:

`line`, `column`, `position` - Indications of the position in the XML document
where the parser currently is looking.

`closed` - Boolean indicating whether or not the parser can be written to.  If
it's `true`, then wait for the `ready` event to write again.

`opt` - Any options passed into the constructor.

`xmlDecl` - The XML declaration for this document. It contains the fields
`version`, `encoding` and `standalone`. They are all `undefined` before
encountering the XML declaration. If they are undefined after the XML
declaration, the corresponding value was not set by the declaration. There is no
event associated with the XML declaration. In a well-formed document, the XML
declaration may be preceded only by an optional BOM. So by the time any event
generated by the parser happens, the declaration has been processed if present
at all. Otherwise, you have a malformed document, and as stated above, you
cannot rely on the parser data!

### Events

To listen to an event, override `on<eventname>`. The list of supported events
are also in the exported `EVENTS` array.

See the JSDOC comments in the source code for a description of each supported
event.

### Parsing XML Fragments

The XML specification does not define any method by which to parse XML
fragments. However, there are usage scenarios in which it is desirable to parse
fragments. In order to allow this, saxes provides three initialization options.

If you pass the option `fragment: true` to the parser constructor, the parser
will expect an XML fragment. It essentially starts with a parsing state
equivalent to the one it would be in if `parser.write("<foo">)` had been called
right after initialization. In other words, it expects content which is
acceptable inside an element. This also turns off well-formedness checks that
are inappropriate when parsing a fragment.

The option `additionalNamespaces` allows you to define additional prefix-to-URI
bindings known before parsing starts. You would use this over `resolvePrefix` if
you have at the ready a series of namespaces bindings to use.

The option `resolvePrefix` allows you to pass a function which saxes will use if
it is unable to resolve a namespace prefix by itself. You would use this over
`additionalNamespaces` in a context where getting a complete list of defined
namespaces is onerous.

Note that you can use `additionalNamespaces` and `resolvePrefix` together if you
want. `additionalNamespaces` applies before `resolvePrefix`.

## FAQ

Q. Why has saxes dropped support for limiting the size of data chunks passed to
event handlers?

A. With sax you could set ``MAX_BUFFER_LENGTH`` to cause the parser to limit the
size of data chunks passed to event handlers. So if you ran into a span of text
above the limit, multiple ``text`` events with smaller data chunks were fired
instead of a single event with a large chunk.

However, that functionality had some problematic characteristics. It had an
arbitrary default value. It was library-wide so all parsers created from a
single instance of the ``sax`` library shared it. This could potentially cause
conflicts among libraries running in the same VM but using sax for different
purposes.

These issues could have been easily fixed, but there were larger issues. The
buffer limit arbitrarily applied to some events but not others. It would split
``text``, ``cdata`` and ``script`` events. However, if a ``comment``,
``doctype``, ``attribute`` or ``processing instruction`` were more than the
limit, the parser would generate an error and you were left picking up the
pieces.

It was not intuitive to use. You'd think setting the limit to 1K would prevent
chunks bigger than 1K to be passed to event handlers. But that was not the
case. A comment in the source code told you that you might go over the limit if
you passed large chunks to ``write``. So if you want a 1K limit, don't pass 64K
chunks to ``write``. Fair enough. You know what limit you want so you can
control the size of the data you pass to ``write``. So you limit the chunks to
``write`` to 1K at a time. Even if you do this, your event handlers may get data
chunks that are 2K in size. Suppose on the previous ``write`` the parser has
just finished processing an open tag, so it is ready for text. Your ``write``
passes 1K of text. You are not above the limit yet, so no event is generated
yet. The next ``write`` passes another 1K of text. It so happens that sax checks
buffer limits only once per ``write``, after the chunk of data has been
processed. Now you've hit the limit and you get a ``text`` event with 2K of
data. So even if you limit your ``write`` calls to the buffer limit you've set,
you may still get events with chunks at twice the buffer size limit you've
specified.

We may consider reinstating an equivalent functionality, provided that it
addresses the issues above and does not cause a huge performance drop for
use-case scenarios that don't need it.
