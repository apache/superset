rison
=====

Rison mirror (http://mjtemplate.org/examples/rison.html)


# Rison - Compact Data in URIs

This page describes _Rison_, a data serialization format optimized for
compactness in URIs. Rison is a slight variation of JSON that looks vastly
superior after URI encoding. Rison still expresses exactly the same set of
data structures as JSON, so data can be translated back and forth without loss
or guesswork.

You can skip straight to some examples, or read on for more background.

Downloads:

  * [rison.js](../../dist/mjt-0.9.2/rison.js) includes a Javascript Rison encoder (based on [Douglas Crockford](http://json.org)'s [json.js](http://json.org/json.js)) and decoder (based on [Oliver Steele](http://osteele.com)'s [JSON for OpenLaszlo](http://osteele.com/sources/openlaszlo/json/)). 
  * [rison.py](http://freebase-python.googlecode.com/svn/trunk/freebase/rison.py) contains a decoder in Python. 
  * [Tim Fletcher](http://tfletcher.com/dev/) has implemented [Rison in Ruby](http://rison.rubyforge.org/) including both encoder and decoder. 


### Quick Start (Javascript)

Install with npm or copy in `js/rison.js` manually, the script is
compatible with AMD and CommonJS (such as browserify or node), you
can also drop it into a `<script>` tag, creating the `rison` global.

Once installed you have the following methods available:
```js
var rison = require('rison');

rison.encode({any: "json", yes: true});
rison.encode_array(["A", "B", {supportsObjects: true}]);
rison.encode_object({supportsObjects: true, ints: 435});

// Rison
rison.encode({any: "json", yes: true});
// (any:json,yes:!t)

// O-Rison
rison.encode_object({supportsObjects: true, ints: 435});
// ints:435,supportsObjects:!t

// A-Rison
rison.encode_array(["A", "B", {supportsObjects: true}]);
// A,B,(supportsObjects:!t)

// Decode with: rison.decode, rison.decode_object, rison.decode_array
// Example:
rison.encode('(any:json,yes:!t)');
// { any: 'json', yes: true }
```


### Why another data serialization format?

Rison is intended to meet the following goals, in roughly this order:

  1. Comply with [URI specifications](http://gbiv.com/protocols/uri/rfc/rfc3986.html) and usage
  2. Express **nested** data structures
  3. Be **human-readable**
  4. Be **compact**
Rison is necessary because the obvious alternatives fail to meet these goals:

  * URI-encoded XML and JSON are illegible and inefficient. 
  * [HTML Form encoding](http://www.w3.org/TR/html4/interact/forms.html#form-content-type) rules the web but can only represent a flat list of string pairs. 
  * Ian Bicking's [FormEncode](http://formencode.org/) package includes the [variabledecode](http://formencode.org/Validator.html#id16) parser, an interesting convention for form encoding that allows nested lists and dictionaries. However, it becomes inefficient with deeper nesting, and allows no terminal datatypes except strings. 

Note that these goals are shaped almost entirely by the constraints of URIs,
though Rison has turned out to be useful in command-line tools as well. In the
_body_ of an HTTP request or response, length is less critical and URI
encoding can be avoided, so JSON would usually be preferred to Rison.

Given that a new syntax is needed, Rison tries to innovate as little as
possible:

  * It uses the same data model as, and a very similar syntax to [JSON](http://json.org). The Rison grammar is only a slight alteration of the JSON grammar. 
  * It introduces very little additional quoting, since we assume that URI encoding will be applied on top of the Rison encoding. 

### Differences from JSON syntax

  * no whitespace is permitted except inside quoted strings. 
  * almost all character escaping is left to the uri encoder. 
  * single-quotes are used for quoting, but quotes can and should be left off strings when the strings are simple identifiers. 
  * the `e+` exponent format is forbidden, since `+` is not safe in form values and the plain `e` format is equivalent. 
  * the `E`, `E+`, and `E` exponent formats are removed. 
  * object keys should be lexically sorted when encoding. the intent is to improve url cacheability. 
  * uri-safe tokens are used in place of the standard json tokens: 

rison token json token  meaning

* `'` `"` string quote
* `!` `\` string escape
* `(...)` `{...}` object
* `!(...)` `[...]` array

* the JSON literals that look like identifiers (`true`, `false` and `null`) are represented as `!` sequences: 

rison token json token

* `!t` true
* `!f` false
* `!n` null

The `!` character plays two similar but different roles, as an escape
character within strings, and as a marker for special values. This may be
confusing.

Notice that services can distinguish Rison-encoded strings from JSON-encoded
strings by checking the first character. Rison structures start with `(` or
`!(`. JSON structures start with `[` or `{`. This means that a service which
expects a JSON encoded object or array can accept Rison-encoded objects
without loss of compatibility.

### Interaction with URI %-encoding

Rison syntax is designed to produce strings that be legible after being [form-
encoded](http://www.w3.org/TR/html4/interact/forms.html#form-content-type) for
the [query](http://gbiv.com/protocols/uri/rfc/rfc3986.html#query) section of a
URI. None of the characters in the Rison syntax need to be URI encoded in that
context, though the data itself may require URI encoding. Rison tries to be
orthogonal to the %-encoding process - it just defines a string format that
should survive %-encoding with very little bloat. Rison quoting is only
applied when necessary to quote characters that might otherwise be interpreted
as special syntax.

Note that most URI encoding libraries are very conservative, percent-encoding
many characters that are legal according to [RFC
3986](http://gbiv.com/protocols/uri/rfc/rfc3986.html). For example,
Javascript's builtin `encodeURIComponent()` function will still make Rison
strings difficult to read. The rison.js library includes a more tolerant URI
encoder.

Rison uses its own quoting for strings, using the single quote (`**'**`) as a
string delimiter and the exclamation point (`**!**`) as the string escape
character. Both of these characters are legal in uris. Rison quoting is
largely inspired by Unix shell command line parsing.

All Unicode characters other than `**'**` and `**!**` are legal inside quoted
strings. This includes newlines and control characters. Quoting all such
characters is left to the %-encoding process.

### Interaction with IRIs

This still needs to be addressed. Advice from an IRI expert would be very
welcome.

Particular attention should be paid to Unicode characters that may be
interpreted as Rison syntax characters.

The _idchars_ set is hard to define well. The goal is to include foreign
language alphanumeric characters and some punctuation that is common in
identifiers ("`_`", "`-`", "`.`", "`/`", and others). However, whitespace and
most punctuation characters should require quoting.

### Emailing URIs

Most text emailers are conservative about what they turn into a hyperlink, and
they will assume that characters like '(' mean the end of the URI. This
results in broken, truncated links.

This is actually a problem with URI encoding rather than with Rison, but it
comes up a lot in practice. You could use Rison with a more aggressive URI
encoder to generate emailable URIs. You can also wrap your emailed URIs in
angle brackets: `<http://...>` which some mail readers have better luck with.

### Further Rationale

**Passing data in URIs** is necessary in many situations. Many web services rely on the HTTP GET method, which can take advantage of an extensive deployed caching infrastructure. Browsers also have different capabilities for GET, including the crucial ability to make cross-site requests. It is also very convenient to store the state of a small browser application in the URI. 

**Human readability** makes everything go faster. Primarily this means avoiding URI encoding whenever possible. This requires careful choice of characters for the syntax, and a tolerant URI encoder that only encodes characters when absolutely necessary. 

**Compactness** is important because of implementation limits on URI length. Internet Explorer is once again the weakest link at 2K. One could certainly invent a more compact representation by dropping the human-readable constraint and using a compression algorithm. 

### Variations

There are several variations on Rison which are useful or at least thought-
provoking.

#### O-Rison

When you know the parameter being encoded will always be an object, always
wrapping it in a containing `()` is unnecessary and hard to explain. Until
you've dealt with nested structures, the need for parentheses is hard to
explain. In this case you may wish to declare that the argument is encoded in
_O-Rison_, which can be translated to Rison by wrapping it in parentheses.

Here's a URI with a single query argument which is a nested structure:
`http://example.com/service?query=(q:'*',start:10,count:10)`

This is more legible if you specify that the argument is O-Rison instead of
Rison, and leave the containing `()` as implied:
`http://example.com/service?query=q:'*',start:10,count:10`

This seems to be useful in enough situations that it is worth defining the
term _O-Rison_.

#### A-Rison

Similarly, sometimes you know the value will always be an array. Instead of
specifying a Rison argument: `.../?items=!(item1,item2,item3)` you can specify
the far more legible A-Rison argument: `.../?items=item1,item2,item3`

#### Accepting other delimiters

Notice that O-Rison looks almost like a drop-in replacement for [ URL form
encoding](http://www.w3.org/TR/html4/interact/forms.html#form-content-type),
with two substitutions:

  * "`:`" for "`=`"
  * "`,`" for "`&`"

We could expand the Rison parser to treat all of "`,`", "`&`", and "`;`" as
valid item separators and both "`:`" and "`=`" as key-value separators. In
this case the vast majority of URI queries would form a flat subset of
O-Rison. The exceptions are services that depend on ordering of query
parameters or allow duplicate parameter names.

This extension doesn't change the parsing of standard Rison strings because
"`&`", "`=`", and "`;`" are already illegal in Rison identifiers.

### Examples

These examples compare Rison and JSON representations of identical values. The
table is generated in the browser using [mjt](http://mjtemplate.org/).

The compression ratio column shows `(1&nbsp_place_holder;-&nbsp_place_holder;e
ncoded_rison_size)&nbsp_place_holder;/&nbsp_place_holder;encoded_json_size.`

On a log of Freebase mqlread service URIs, the queries were from 35% to 45%
smaller when encoded with Rison.

URI encoding is done with a custom URI encoder which is less aggressive than
Javascript's built-in `encodeURIComponent()`.

Rison JSON URI-encoded Rison URI-encoded JSON roundtrip test compression

var test = rison.decode(r); if (typeof(test) != 'undefined') { var json =
JSON.stringify(test); var urljson = rison.quote(json); var ur =
rison.quote(r); var r2 = rison.encode(test); }

`${r}`

    
    ${indented_json(test)}

`$ur`

`$urljson`

` undefined $r2 ok `

${Math.round(100 * (1.0 - ur.length / urljson.length))}%

