<a name="3.1.11"></a>
## [3.1.11](https://github.com/lddubeau/saxes/compare/v3.1.10...v3.1.11) (2019-06-25)


### Bug Fixes

* pay attention to comments and processing instructions in DTDs ([52ffd90](https://github.com/lddubeau/saxes/commit/52ffd90)), closes [#19](https://github.com/lddubeau/saxes/issues/19)


### Performance Improvements

* check the most common case first ([40a34d5](https://github.com/lddubeau/saxes/commit/40a34d5))
* improve some more the speed of ]]> detection ([a0216cd](https://github.com/lddubeau/saxes/commit/a0216cd))
* move more common/valid cases first ([a65586e](https://github.com/lddubeau/saxes/commit/a65586e))
* split sText into two specialized loops ([732325e](https://github.com/lddubeau/saxes/commit/732325e))
* use specialized code for sAttribValueQuoted ([6c484f3](https://github.com/lddubeau/saxes/commit/6c484f3))



<a name="3.1.10"></a>
## [3.1.10](https://github.com/lddubeau/saxes/compare/v3.1.9...v3.1.10) (2019-06-11)


### Performance Improvements

* improve the check for ]]> in character data ([21df9b5](https://github.com/lddubeau/saxes/commit/21df9b5))



<a name="3.1.9"></a>
## [3.1.9](https://github.com/lddubeau/saxes/compare/v3.1.7...v3.1.9) (2019-02-25)


### Bug Fixes

* move eslint to devDependencies ([d747538](https://github.com/lddubeau/saxes/commit/d747538))



<a name="3.1.8"></a>
## [3.1.8](https://github.com/lddubeau/saxes/compare/v3.1.7...v3.1.8) (2019-02-25)



<a name="3.1.7"></a>
## [3.1.7](https://github.com/lddubeau/saxes/compare/v3.1.6...v3.1.7) (2019-02-22)


### Bug Fixes

* npm audit warning ([a6c9ba8](https://github.com/lddubeau/saxes/commit/a6c9ba8))
* **typings:** "selfClosing" => "isSelfClosing" ([d96a2bd](https://github.com/lddubeau/saxes/commit/d96a2bd))



<a name="3.1.6"></a>
## [3.1.6](https://github.com/lddubeau/saxes/compare/v3.1.5...v3.1.6) (2019-01-17)


### Bug Fixes

* detect unclosed tags in fragments ([5642f36](https://github.com/lddubeau/saxes/commit/5642f36))



<a name="3.1.5"></a>
## [3.1.5](https://github.com/lddubeau/saxes/compare/v3.1.4...v3.1.5) (2019-01-08)


### Bug Fixes

* generate an error on prefix with empty local name ([89a3b86](https://github.com/lddubeau/saxes/commit/89a3b86)), closes [#5](https://github.com/lddubeau/saxes/issues/5)



<a name="3.1.4"></a>
## [3.1.4](https://github.com/lddubeau/saxes/compare/v3.1.3...v3.1.4) (2018-12-03)


### Bug Fixes

* add fragment and additionalNamespaces to SaxesOption typing ([02d8275](https://github.com/lddubeau/saxes/commit/02d8275))



<a name="3.1.3"></a>
## [3.1.3](https://github.com/lddubeau/saxes/compare/v3.1.2...v3.1.3) (2018-10-01)


### Bug Fixes

* use the latest xmlchars ([b30a714](https://github.com/lddubeau/saxes/commit/b30a714))


### Performance Improvements

* don't check twice if this.textNode is set ([00536cc](https://github.com/lddubeau/saxes/commit/00536cc))
* reduce the frequency at which we clear attribValue ([1570615](https://github.com/lddubeau/saxes/commit/1570615))



<a name="3.1.2"></a>
## [3.1.2](https://github.com/lddubeau/saxes/compare/v3.1.1...v3.1.2) (2018-08-31)


### Bug Fixes

* CDATA end in attributes must not cause an error ([a7495ac](https://github.com/lddubeau/saxes/commit/a7495ac))
* normalize \r\n and \r followed by something else to \n ([d7b1abe](https://github.com/lddubeau/saxes/commit/d7b1abe)), closes [#2](https://github.com/lddubeau/saxes/issues/2)



<a name="3.1.1"></a>
## [3.1.1](https://github.com/lddubeau/saxes/compare/v3.1.0...v3.1.1) (2018-08-29)


### Bug Fixes

* resolve is now part of the public API ([bb4bed5](https://github.com/lddubeau/saxes/commit/bb4bed5))



<a name="3.1.0"></a>
# [3.1.0](https://github.com/lddubeau/saxes/compare/v3.0.0...v3.1.0) (2018-08-28)


### Bug Fixes

* correct typo ([97bc5da](https://github.com/lddubeau/saxes/commit/97bc5da))


### Performance Improvements

* add emitNodes to skip checking text buffer more than needed ([9d5e357](https://github.com/lddubeau/saxes/commit/9d5e357))
* capture names in the ``name`` field ([c7dffd5](https://github.com/lddubeau/saxes/commit/c7dffd5))
* introduce a specialized version of captureWhile ([04855d6](https://github.com/lddubeau/saxes/commit/04855d6))
* introduce captureTo and captureToChar ([76eb95a](https://github.com/lddubeau/saxes/commit/76eb95a))
* remove skipWhitespace ([c8b7ae2](https://github.com/lddubeau/saxes/commit/c8b7ae2))
* remove some redundant buffer resets ([5ded326](https://github.com/lddubeau/saxes/commit/5ded326))
* use charCodeAt and handle surrogates ourselves ([b8ec232](https://github.com/lddubeau/saxes/commit/b8ec232))



<a name="3.0.0"></a>
# [3.0.0](https://github.com/lddubeau/saxes/compare/v2.2.1...v3.0.0) (2018-08-21)


### Features

* process the xmlns attribute the customary way ([2c9672a](https://github.com/lddubeau/saxes/commit/2c9672a))


### BREAKING CHANGES

* In previous versions the attribute `xmlns` (as in `<foo xmlns="some-uri">` would
be reported as having the prefix `"xmlns"` and the local name `""`.  This
behavior was inherited from sax. There was some logic to it, but this behavior
was surprising to users of the library. The principle of least surprise favors
eliminating that surprising behavior in favor of something less surprising.

This commit makes it so that `xmlns` is not reported as having a prefix of `""`
and a local name of `"xmlns"`. This accords with how people interpret attribute
names like `foo`, `bar`, `moo` which all have no prefix and a local name.

Code that deals with namespace bindings or cares about `xmlns` probably needs to
be changed.



<a name="2.2.1"></a>
## [2.2.1](https://github.com/lddubeau/saxes/compare/v2.2.0...v2.2.1) (2018-08-20)


### Bug Fixes

* use `isNameChar` for later chars in PI target ([83d2b61](https://github.com/lddubeau/saxes/commit/83d2b61))



<a name="2.2.0"></a>
# [2.2.0](https://github.com/lddubeau/saxes/compare/v2.1.0...v2.2.0) (2018-08-20)


### Features

* add the `resolvePrefix` option ([90301fb](https://github.com/lddubeau/saxes/commit/90301fb))



<a name="2.1.0"></a>
# [2.1.0](https://github.com/lddubeau/saxes/compare/v2.0.0...v2.1.0) (2018-08-20)


### Features

* add support for parsing fragments ([1ff2d6a](https://github.com/lddubeau/saxes/commit/1ff2d6a))
* stronger check on bad cdata closure ([d416760](https://github.com/lddubeau/saxes/commit/d416760))


### Performance Improvements

* concatenate openWakaBang just once ([07345bf](https://github.com/lddubeau/saxes/commit/07345bf))
* improve text node checking speed ([f270e8b](https://github.com/lddubeau/saxes/commit/f270e8b))
* minor optimizations ([c7e36bf](https://github.com/lddubeau/saxes/commit/c7e36bf))
* remove an unnecessary variable ([ac03a1c](https://github.com/lddubeau/saxes/commit/ac03a1c))
* remove handler check ([fbe35ff](https://github.com/lddubeau/saxes/commit/fbe35ff))
* simplify captureWhile ([bb2085c](https://github.com/lddubeau/saxes/commit/bb2085c))
* simplify the skip functions ([c7b8c3b](https://github.com/lddubeau/saxes/commit/c7b8c3b))
* the c field has been unused for a while: remove it ([9ca0246](https://github.com/lddubeau/saxes/commit/9ca0246))
* use strings for the general states ([3869908](https://github.com/lddubeau/saxes/commit/3869908))



<a name="2.0.0"></a>
# [2.0.0](https://github.com/lddubeau/saxes/compare/v1.2.4...v2.0.0) (2018-07-23)


### Bug Fixes

* "X" is not a valid hex prefix for char references ([465038b](https://github.com/lddubeau/saxes/commit/465038b))
* add namespace checks ([9f94c4b](https://github.com/lddubeau/saxes/commit/9f94c4b))
* always run in strict mode ([ed8b0b1](https://github.com/lddubeau/saxes/commit/ed8b0b1))
* check that the characters we read are valid char data ([7611a85](https://github.com/lddubeau/saxes/commit/7611a85))
* disallow spaces after open waka ([da7f76d](https://github.com/lddubeau/saxes/commit/da7f76d))
* drop the lowercase option ([987d4bf](https://github.com/lddubeau/saxes/commit/987d4bf))
* emit CDATA on empty CDATA section too ([95d192f](https://github.com/lddubeau/saxes/commit/95d192f))
* emit empty comment ([b3db392](https://github.com/lddubeau/saxes/commit/b3db392))
* entities are always strict ([0f6a30e](https://github.com/lddubeau/saxes/commit/0f6a30e))
* fail on colon at start of QName ([507addd](https://github.com/lddubeau/saxes/commit/507addd))
* harmonize error messages and initialize flags ([9a20cad](https://github.com/lddubeau/saxes/commit/9a20cad))
* just one error for text before the root, and text after ([101ea50](https://github.com/lddubeau/saxes/commit/101ea50))
* more namespace checks ([a1add21](https://github.com/lddubeau/saxes/commit/a1add21))
* move namespace checks to their proper place ([4a1c99f](https://github.com/lddubeau/saxes/commit/4a1c99f))
* only accept uppercase CDATA to mark the start of CDATA ([e86534d](https://github.com/lddubeau/saxes/commit/e86534d))
* prevent colons in pi and entity names when xmlns is true ([4327eec](https://github.com/lddubeau/saxes/commit/4327eec))
* prevent empty entities ([04e1593](https://github.com/lddubeau/saxes/commit/04e1593))
* raise an error if the document does not have a root ([f2de520](https://github.com/lddubeau/saxes/commit/f2de520))
* raise an error on ]]> in character data ([2964381](https://github.com/lddubeau/saxes/commit/2964381))
* raise an error on < in attribute values ([4fd67a1](https://github.com/lddubeau/saxes/commit/4fd67a1))
* raise an error on multiple root elements ([45047ae](https://github.com/lddubeau/saxes/commit/45047ae))
* raise error on CDATA before or after root ([604241f](https://github.com/lddubeau/saxes/commit/604241f))
* raise error on character reference outside CHAR production ([30fb540](https://github.com/lddubeau/saxes/commit/30fb540))
* remove broken or pointless examples ([1a5b642](https://github.com/lddubeau/saxes/commit/1a5b642))
* report an error on duplicate attributes ([ee4e340](https://github.com/lddubeau/saxes/commit/ee4e340))
* report an error on whitespace at the start of end tag ([c13b122](https://github.com/lddubeau/saxes/commit/c13b122))
* report processing instructions that do not have a target ([c007e39](https://github.com/lddubeau/saxes/commit/c007e39))
* treat ?? in processing instructions correctly ([bc1e1d4](https://github.com/lddubeau/saxes/commit/bc1e1d4))
* trim URIs ([78cc6f3](https://github.com/lddubeau/saxes/commit/78cc6f3))
* use xmlchars for checking names ([2c939fe](https://github.com/lddubeau/saxes/commit/2c939fe))
* verify that character references match the CHAR production ([369afde](https://github.com/lddubeau/saxes/commit/369afde))


### Code Refactoring

* adjust the names used for processing instructions ([3b508e9](https://github.com/lddubeau/saxes/commit/3b508e9))
* convert code to ES6 ([fe81170](https://github.com/lddubeau/saxes/commit/fe81170))
* drop attribute event ([c7c2e80](https://github.com/lddubeau/saxes/commit/c7c2e80))
* drop buffer size checks ([9ce2f7a](https://github.com/lddubeau/saxes/commit/9ce2f7a))
* drop normalize ([9c6d84c](https://github.com/lddubeau/saxes/commit/9c6d84c))
* drop opencdata and on closecdata ([3287d2c](https://github.com/lddubeau/saxes/commit/3287d2c))
* drop SGML declaration parsing ([4aaf2d9](https://github.com/lddubeau/saxes/commit/4aaf2d9))
* drop the ``parser`` function, rename SAXParser ([0878a6c](https://github.com/lddubeau/saxes/commit/0878a6c))
* drop trim ([c03c7d0](https://github.com/lddubeau/saxes/commit/c03c7d0))
* pass the actual tag to onclosetag ([7020e64](https://github.com/lddubeau/saxes/commit/7020e64))
* provide default no-op implementation for events ([a94687f](https://github.com/lddubeau/saxes/commit/a94687f))
* remove the API based on Stream ([ebb659a](https://github.com/lddubeau/saxes/commit/ebb659a))
* simplify namespace processing ([2d4ce0f](https://github.com/lddubeau/saxes/commit/2d4ce0f))


### Features

* drop the resume() method; and have onerror() throw ([ac601e5](https://github.com/lddubeau/saxes/commit/ac601e5))
* handle XML declarations ([5258939](https://github.com/lddubeau/saxes/commit/5258939))
* revamped error messages ([cf9c589](https://github.com/lddubeau/saxes/commit/cf9c589))
* the flush method returns its parser ([68c2020](https://github.com/lddubeau/saxes/commit/68c2020))


### BREAKING CHANGES

* Sax was only passing the tag name. We pass the whole object.
* The API no longer takes a ``strict`` argument anywhere. This also
effectively removes support for HTML processing, or allow processing
without errors anything which is less than full XML. It also removes
special processing of ``script`` elements.
* ``attribute`` is not a particularly useful event for parsing XML. The only thing
it adds over looking at attributes on tag objects is that you get the order of
the attributes from the source, but attribute order in XML is irrelevant.
* The opencdata and closecdata events became redundant once we removed the buffer
size limitations. So we remove these events.
* The ``parser`` function is removed. Just create a new instance with
``new``.

``SAXParser`` is now ``SaxesParser.`` So ``new
require("saxes").SaxesParser(...)``.
* The API based on Stream is gone. There were multiple issues with it. It was
Node-specific. It used an ancient Node API (the so-called "classic
streams"). Its behavior was idiosyncratic.
* Sax had no default error handler but if you wanted to continue calling
``write()`` after an error you had to call ``resume()``. We do away with
``resume()`` and instead install a default ``onerror`` which throws. Replace
with a no-op handler if you want to continue after errors.
* The "processinginstruction" now produces a "target" field instead of a "name"
field. The nomenclature "target" is the one used in the XML literature.
* * The ``ns`` field is no longer using the prototype trick that sax used. The
  ``ns`` field of a tag contains only those namespaces that the tag declares.

* We no longer have ``opennamespace`` and ``closenamespace`` events. The
  information they provide can be obtained by examining the tags passed to tag
  events.
* SGML declaration is not supported by XML. This is an XML parser. So we
remove support for SGML declarations. They now cause errors.
* We removed support for the code that checked buffer sizes and would
raise errors if a buffer was close to an arbitrary limit or emitted
multiple ``text`` or ``cdata`` events in order avoid passing strings
greater than an arbitrary size. So ``MAX_BUFFER_LENGTH`` is gone.

The feature always seemed a bit awkward. Client code could limit the
size of buffers to 1024K, for instance, and not get a ``text`` event
with a text payload greater than 1024K... so far so good but if the
same document contained a comment with more than 1024K that would
result in an error. Hmm.... why? The distinction seems entirely
arbitrary.

The upshot is that client code needs to be ready to handle strings of
any length supported by the platform.

If there's a clear need to reintroduce it, we'll reassess.
* It is no longer possible to load the library as-is through a
``script`` element. It needs building.

The library now assumes a modern runtime. It no longer contains any
code to polyfill what's missing. It is up to developers using this
code to deal with polyfills as needed.
* We drop the ``trim`` option. It is up to client code to trip text if
it needs it.
* We no longer support the ``normalize`` option. It is up to client code
to perform whatever normalization it wants.
* The ``lowercase`` option makes no sense for XML. It is removed.
* Remove support for strictEntities. Entities are now always strict, as
required by the XML specification.
* By default parsers now have a default no-op implementation for each
event it supports. This would break code that determines whether a
custom handler was added by checking whether there's any handler at
all. This removes the necessity for the parser implementation to check
whether there is a handler before calling it.

In the process of making this change, we've removed support for the
``on...`` properties on streams objects. Their existence was not
warranted by any standard API provided by Node. (``EventEmitter`` does
not have ``on...`` properties for events it supports, nor does
``Stream``.) Their existence was also undocumented. And their
functioning was awkward. For instance, with sax, this:

```
const s = sax.createStream();
const handler = () => console.log("moo");
s.on("cdata", handler);
console.log(s.oncdata === handler);
```

would print ``false``. If you examine ``s.oncdata`` you see it is glue
code instead of the handler assigned. This is just bizarre, so we
removed it.



