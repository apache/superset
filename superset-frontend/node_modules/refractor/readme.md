# refractor [![Build][build-badge]][build] [![Coverage][coverage-badge]][coverage] [![Downloads][downloads-badge]][downloads] [![Size][size-badge]][size]

Lightweight, robust, elegant virtual syntax highlighting using [Prism][].
Useful for virtual DOMs and non-HTML things.  Perfect for [React][], [VDOM][],
and others.

<!--count start-->

`refractor` is built to work with all syntaxes supported by [Prism][],
that’s [151 languages][names] (as of [prism@1.15.0][prismjs]) and all
[themes][].

<!--count end-->

Want to use [`highlight.js`][hljs] instead?  Try [`lowlight`][lowlight]!

## Table of Contents

*   [Installation](#installation)
*   [Usage](#usage)
*   [API](#api)
    *   [refractor.register(syntax)](#refractorregistersyntax)
    *   [refractor.highlight(value, language)](#refractorhighlightvalue-language)
    *   [refractor.registered(language)](#refractorregisteredlanguage)
*   [Browser](#browser)
*   [Plugins](#plugins)
*   [Syntaxes](#syntaxes)
*   [Related](#related)
*   [Projects](#projects)
*   [License](#license)

## Installation

[npm][]:

```bash
npm install
```

[Usage in the browser »][browser]

> Note: Prism depends on [`clipboard.js`][clipboard], but that code isn’t
> included when running refractor.

## Usage

```javascript
var refractor = require('refractor')

var nodes = refractor.highlight('"use strict";', 'js')

console.log(nodes)
```

Yields:

```js
[ { type: 'element',
    tagName: 'span',
    properties: { className: [ 'token', 'string' ] },
    children: [ { type: 'text', value: '"use strict"' } ] },
  { type: 'element',
    tagName: 'span',
    properties: { className: [ 'token', 'punctuation' ] },
    children: [ { type: 'text', value: ';' } ] } ]
```

Or, stringified with [rehype][]:

```js
var rehype = require('rehype')

var html = rehype()
  .stringify({type: 'root', children: nodes})
  .toString()

console.log(html)
```

Yields:

```html
<span class="token string">"use strict"</span><span class="token punctuation">;</span>
```

> **Tip**: Use [`hast-to-hyperscript`][to-hyperscript] to transform
> to other virtual DOMs, or DIY.

## API

### `refractor.register(syntax)`

Register a [syntax][].  Needed if you’re using [`refractor/core.js`][browser].

###### Example

```js
var refractor = require('refractor/core.js')

refractor.register(require('refractor/lang/markdown.js'))

console.log(refractor.highlight('*Emphasis*', 'markdown'))
```

Yields:

```js
[ { type: 'element',
    tagName: 'span',
    properties: [Object],
    children: [Array] } ]
```

### `refractor.highlight(value, language)`

Parse `value` (`string`) according to the `language` ([name or alias][syntax])
syntax.

###### Returns

Virtual nodes representing the highlighted value ([`Array.<Node>`][node]).

###### Example

```js
var refractor = require('refractor/core.js')

console.log(refractor.highlight('em { color: red }', 'css'))
```

Yields:

```js
[ { type: 'element',
    tagName: 'span',
    properties: [Object],
    children: [Array] },
  { type: 'text', value: ' ' },
  // ...
  { type: 'text', value: ' red ' },
  { type: 'element',
    tagName: 'span',
    properties: [Object],
    children: [Array] } ]
```

### `refractor.registered(language)`

Check if a `language` ([name or alias][syntax]) is registered.

###### Example

```js
var refractor = require('refractor/core.js')

console.log(refractor.registered('markdown'))

refractor.register(require('refractor/lang/markdown.js'))

console.log(refractor.registered('markdown'))
```

Yields:

```js
false
true
```

## Browser

I do not suggest using the [pre-bundled][releases] files or requiring
`refractor` itself in the browser as that would include a 352kb (128kb GZipped)
of code.

Instead require `refractor/core.js` and include only the needed syntaxes.
For example:

```js
var refractor = require('refractor/core.js')

refractor.register(require('refractor/lang/jsx.js'))

console.log(refractor.highlight('<Dropdown primary />', 'jsx'))
```

Yields:

```js
[ { type: 'element',
    tagName: 'span',
    properties: { className: [ 'token', 'tag' ] },
    children:
     [ { type: 'element',
         tagName: 'span',
         properties: { className: [ 'token', 'tag' ] },
         children:
          [ { type: 'element',
              tagName: 'span',
              properties: { className: [ 'token', 'punctuation' ] },
              children: [ { type: 'text', value: '<' } ] },
            { type: 'text', value: 'Dropdown' } ] },
       { type: 'text', value: ' ' },
       { type: 'element',
         tagName: 'span',
         properties: { className: [ 'token', 'attr-name' ] },
         children: [ { type: 'text', value: 'primary' } ] },
       { type: 'text', value: ' ' },
       { type: 'element',
         tagName: 'span',
         properties: { className: [ 'token', 'punctuation' ] },
         children: [ { type: 'text', value: '/>' } ] } ] } ]
```

…When using [browserify][] and minifying with [tinyify][] this results in
just 65kb of code (23kb with GZip).

## Plugins

`refractor` does not support Prism plugins:

1.  Prism plugins often deal with the DOM, not Prism tokens
2.  Prism is made using global variables instead of a module format, so all
    syntaxes below are custom built to work so you can `require` just what you
    need.

## Syntaxes

All syntaxes are included if you `require('refractor')`.  If you’re using
`refractor/core.js`, checked syntaxes are always included, but unchecked
syntaxes are not and must be `require`d and [`register`][register]ed.

Unlike in Prism, `cssExtras` and `phpExtras` are camel-cased instead of
dash-cased.

Only these custom built syntaxes will work with `refractor` because Prism’s own
syntaxes are made to work with global variables and are not requirable.

<!--support start-->

*   [x] [`clike`](https://github.com/wooorm/refractor/blob/master/lang/clike.js)
*   [x] [`css`](https://github.com/wooorm/refractor/blob/master/lang/css.js)
*   [x] [`javascript`](https://github.com/wooorm/refractor/blob/master/lang/javascript.js) — alias: `js`
*   [x] [`markup`](https://github.com/wooorm/refractor/blob/master/lang/markup.js) — alias: `xml`, `html`, `mathml`, `svg`
*   [ ] [`abap`](https://github.com/wooorm/refractor/blob/master/lang/abap.js)
*   [ ] [`actionscript`](https://github.com/wooorm/refractor/blob/master/lang/actionscript.js)
*   [ ] [`ada`](https://github.com/wooorm/refractor/blob/master/lang/ada.js)
*   [ ] [`apacheconf`](https://github.com/wooorm/refractor/blob/master/lang/apacheconf.js)
*   [ ] [`apl`](https://github.com/wooorm/refractor/blob/master/lang/apl.js)
*   [ ] [`applescript`](https://github.com/wooorm/refractor/blob/master/lang/applescript.js)
*   [ ] [`arduino`](https://github.com/wooorm/refractor/blob/master/lang/arduino.js)
*   [ ] [`arff`](https://github.com/wooorm/refractor/blob/master/lang/arff.js)
*   [ ] [`asciidoc`](https://github.com/wooorm/refractor/blob/master/lang/asciidoc.js)
*   [ ] [`asm6502`](https://github.com/wooorm/refractor/blob/master/lang/asm6502.js)
*   [ ] [`aspnet`](https://github.com/wooorm/refractor/blob/master/lang/aspnet.js)
*   [ ] [`autohotkey`](https://github.com/wooorm/refractor/blob/master/lang/autohotkey.js)
*   [ ] [`autoit`](https://github.com/wooorm/refractor/blob/master/lang/autoit.js)
*   [ ] [`bash`](https://github.com/wooorm/refractor/blob/master/lang/bash.js) — alias: `shell`
*   [ ] [`basic`](https://github.com/wooorm/refractor/blob/master/lang/basic.js)
*   [ ] [`batch`](https://github.com/wooorm/refractor/blob/master/lang/batch.js)
*   [ ] [`bison`](https://github.com/wooorm/refractor/blob/master/lang/bison.js)
*   [ ] [`brainfuck`](https://github.com/wooorm/refractor/blob/master/lang/brainfuck.js)
*   [ ] [`bro`](https://github.com/wooorm/refractor/blob/master/lang/bro.js)
*   [ ] [`c`](https://github.com/wooorm/refractor/blob/master/lang/c.js)
*   [ ] [`clojure`](https://github.com/wooorm/refractor/blob/master/lang/clojure.js)
*   [ ] [`coffeescript`](https://github.com/wooorm/refractor/blob/master/lang/coffeescript.js)
*   [ ] [`cpp`](https://github.com/wooorm/refractor/blob/master/lang/cpp.js)
*   [ ] [`crystal`](https://github.com/wooorm/refractor/blob/master/lang/crystal.js)
*   [ ] [`csharp`](https://github.com/wooorm/refractor/blob/master/lang/csharp.js) — alias: `dotnet`
*   [ ] [`csp`](https://github.com/wooorm/refractor/blob/master/lang/csp.js)
*   [ ] [`cssExtras`](https://github.com/wooorm/refractor/blob/master/lang/css-extras.js)
*   [ ] [`d`](https://github.com/wooorm/refractor/blob/master/lang/d.js)
*   [ ] [`dart`](https://github.com/wooorm/refractor/blob/master/lang/dart.js)
*   [ ] [`diff`](https://github.com/wooorm/refractor/blob/master/lang/diff.js)
*   [ ] [`django`](https://github.com/wooorm/refractor/blob/master/lang/django.js) — alias: `jinja2`
*   [ ] [`docker`](https://github.com/wooorm/refractor/blob/master/lang/docker.js) — alias: `dockerfile`
*   [ ] [`eiffel`](https://github.com/wooorm/refractor/blob/master/lang/eiffel.js)
*   [ ] [`elixir`](https://github.com/wooorm/refractor/blob/master/lang/elixir.js)
*   [ ] [`elm`](https://github.com/wooorm/refractor/blob/master/lang/elm.js)
*   [ ] [`erb`](https://github.com/wooorm/refractor/blob/master/lang/erb.js)
*   [ ] [`erlang`](https://github.com/wooorm/refractor/blob/master/lang/erlang.js)
*   [ ] [`flow`](https://github.com/wooorm/refractor/blob/master/lang/flow.js)
*   [ ] [`fortran`](https://github.com/wooorm/refractor/blob/master/lang/fortran.js)
*   [ ] [`fsharp`](https://github.com/wooorm/refractor/blob/master/lang/fsharp.js)
*   [ ] [`gedcom`](https://github.com/wooorm/refractor/blob/master/lang/gedcom.js)
*   [ ] [`gherkin`](https://github.com/wooorm/refractor/blob/master/lang/gherkin.js)
*   [ ] [`git`](https://github.com/wooorm/refractor/blob/master/lang/git.js)
*   [ ] [`glsl`](https://github.com/wooorm/refractor/blob/master/lang/glsl.js)
*   [ ] [`go`](https://github.com/wooorm/refractor/blob/master/lang/go.js)
*   [ ] [`graphql`](https://github.com/wooorm/refractor/blob/master/lang/graphql.js)
*   [ ] [`groovy`](https://github.com/wooorm/refractor/blob/master/lang/groovy.js)
*   [ ] [`haml`](https://github.com/wooorm/refractor/blob/master/lang/haml.js)
*   [ ] [`handlebars`](https://github.com/wooorm/refractor/blob/master/lang/handlebars.js)
*   [ ] [`haskell`](https://github.com/wooorm/refractor/blob/master/lang/haskell.js)
*   [ ] [`haxe`](https://github.com/wooorm/refractor/blob/master/lang/haxe.js)
*   [ ] [`hpkp`](https://github.com/wooorm/refractor/blob/master/lang/hpkp.js)
*   [ ] [`hsts`](https://github.com/wooorm/refractor/blob/master/lang/hsts.js)
*   [ ] [`http`](https://github.com/wooorm/refractor/blob/master/lang/http.js)
*   [ ] [`ichigojam`](https://github.com/wooorm/refractor/blob/master/lang/ichigojam.js)
*   [ ] [`icon`](https://github.com/wooorm/refractor/blob/master/lang/icon.js)
*   [ ] [`inform7`](https://github.com/wooorm/refractor/blob/master/lang/inform7.js)
*   [ ] [`ini`](https://github.com/wooorm/refractor/blob/master/lang/ini.js)
*   [ ] [`io`](https://github.com/wooorm/refractor/blob/master/lang/io.js)
*   [ ] [`j`](https://github.com/wooorm/refractor/blob/master/lang/j.js)
*   [ ] [`java`](https://github.com/wooorm/refractor/blob/master/lang/java.js)
*   [ ] [`jolie`](https://github.com/wooorm/refractor/blob/master/lang/jolie.js)
*   [ ] [`json`](https://github.com/wooorm/refractor/blob/master/lang/json.js) — alias: `jsonp`
*   [ ] [`jsx`](https://github.com/wooorm/refractor/blob/master/lang/jsx.js)
*   [ ] [`julia`](https://github.com/wooorm/refractor/blob/master/lang/julia.js)
*   [ ] [`keyman`](https://github.com/wooorm/refractor/blob/master/lang/keyman.js)
*   [ ] [`kotlin`](https://github.com/wooorm/refractor/blob/master/lang/kotlin.js)
*   [ ] [`latex`](https://github.com/wooorm/refractor/blob/master/lang/latex.js)
*   [ ] [`less`](https://github.com/wooorm/refractor/blob/master/lang/less.js)
*   [ ] [`liquid`](https://github.com/wooorm/refractor/blob/master/lang/liquid.js)
*   [ ] [`lisp`](https://github.com/wooorm/refractor/blob/master/lang/lisp.js)
*   [ ] [`livescript`](https://github.com/wooorm/refractor/blob/master/lang/livescript.js)
*   [ ] [`lolcode`](https://github.com/wooorm/refractor/blob/master/lang/lolcode.js)
*   [ ] [`lua`](https://github.com/wooorm/refractor/blob/master/lang/lua.js)
*   [ ] [`makefile`](https://github.com/wooorm/refractor/blob/master/lang/makefile.js)
*   [ ] [`markdown`](https://github.com/wooorm/refractor/blob/master/lang/markdown.js)
*   [ ] [`markupTemplating`](https://github.com/wooorm/refractor/blob/master/lang/markup-templating.js)
*   [ ] [`matlab`](https://github.com/wooorm/refractor/blob/master/lang/matlab.js)
*   [ ] [`mel`](https://github.com/wooorm/refractor/blob/master/lang/mel.js)
*   [ ] [`mizar`](https://github.com/wooorm/refractor/blob/master/lang/mizar.js)
*   [ ] [`monkey`](https://github.com/wooorm/refractor/blob/master/lang/monkey.js)
*   [ ] [`n4js`](https://github.com/wooorm/refractor/blob/master/lang/n4js.js)
*   [ ] [`nasm`](https://github.com/wooorm/refractor/blob/master/lang/nasm.js)
*   [ ] [`nginx`](https://github.com/wooorm/refractor/blob/master/lang/nginx.js)
*   [ ] [`nim`](https://github.com/wooorm/refractor/blob/master/lang/nim.js)
*   [ ] [`nix`](https://github.com/wooorm/refractor/blob/master/lang/nix.js)
*   [ ] [`nsis`](https://github.com/wooorm/refractor/blob/master/lang/nsis.js)
*   [ ] [`objectivec`](https://github.com/wooorm/refractor/blob/master/lang/objectivec.js)
*   [ ] [`ocaml`](https://github.com/wooorm/refractor/blob/master/lang/ocaml.js)
*   [ ] [`opencl`](https://github.com/wooorm/refractor/blob/master/lang/opencl.js)
*   [ ] [`oz`](https://github.com/wooorm/refractor/blob/master/lang/oz.js)
*   [ ] [`parigp`](https://github.com/wooorm/refractor/blob/master/lang/parigp.js)
*   [ ] [`parser`](https://github.com/wooorm/refractor/blob/master/lang/parser.js)
*   [ ] [`pascal`](https://github.com/wooorm/refractor/blob/master/lang/pascal.js) — alias: `objectpascal`
*   [ ] [`perl`](https://github.com/wooorm/refractor/blob/master/lang/perl.js)
*   [ ] [`phpExtras`](https://github.com/wooorm/refractor/blob/master/lang/php-extras.js)
*   [ ] [`php`](https://github.com/wooorm/refractor/blob/master/lang/php.js)
*   [ ] [`plsql`](https://github.com/wooorm/refractor/blob/master/lang/plsql.js)
*   [ ] [`powershell`](https://github.com/wooorm/refractor/blob/master/lang/powershell.js)
*   [ ] [`processing`](https://github.com/wooorm/refractor/blob/master/lang/processing.js)
*   [ ] [`prolog`](https://github.com/wooorm/refractor/blob/master/lang/prolog.js)
*   [ ] [`properties`](https://github.com/wooorm/refractor/blob/master/lang/properties.js)
*   [ ] [`protobuf`](https://github.com/wooorm/refractor/blob/master/lang/protobuf.js)
*   [ ] [`pug`](https://github.com/wooorm/refractor/blob/master/lang/pug.js)
*   [ ] [`puppet`](https://github.com/wooorm/refractor/blob/master/lang/puppet.js)
*   [ ] [`pure`](https://github.com/wooorm/refractor/blob/master/lang/pure.js)
*   [ ] [`python`](https://github.com/wooorm/refractor/blob/master/lang/python.js)
*   [ ] [`q`](https://github.com/wooorm/refractor/blob/master/lang/q.js)
*   [ ] [`qore`](https://github.com/wooorm/refractor/blob/master/lang/qore.js)
*   [ ] [`r`](https://github.com/wooorm/refractor/blob/master/lang/r.js)
*   [ ] [`reason`](https://github.com/wooorm/refractor/blob/master/lang/reason.js)
*   [ ] [`renpy`](https://github.com/wooorm/refractor/blob/master/lang/renpy.js)
*   [ ] [`rest`](https://github.com/wooorm/refractor/blob/master/lang/rest.js)
*   [ ] [`rip`](https://github.com/wooorm/refractor/blob/master/lang/rip.js)
*   [ ] [`roboconf`](https://github.com/wooorm/refractor/blob/master/lang/roboconf.js)
*   [ ] [`ruby`](https://github.com/wooorm/refractor/blob/master/lang/ruby.js)
*   [ ] [`rust`](https://github.com/wooorm/refractor/blob/master/lang/rust.js)
*   [ ] [`sas`](https://github.com/wooorm/refractor/blob/master/lang/sas.js)
*   [ ] [`sass`](https://github.com/wooorm/refractor/blob/master/lang/sass.js)
*   [ ] [`scala`](https://github.com/wooorm/refractor/blob/master/lang/scala.js)
*   [ ] [`scheme`](https://github.com/wooorm/refractor/blob/master/lang/scheme.js)
*   [ ] [`scss`](https://github.com/wooorm/refractor/blob/master/lang/scss.js)
*   [ ] [`smalltalk`](https://github.com/wooorm/refractor/blob/master/lang/smalltalk.js)
*   [ ] [`smarty`](https://github.com/wooorm/refractor/blob/master/lang/smarty.js)
*   [ ] [`soy`](https://github.com/wooorm/refractor/blob/master/lang/soy.js)
*   [ ] [`sql`](https://github.com/wooorm/refractor/blob/master/lang/sql.js)
*   [ ] [`stylus`](https://github.com/wooorm/refractor/blob/master/lang/stylus.js)
*   [ ] [`swift`](https://github.com/wooorm/refractor/blob/master/lang/swift.js)
*   [ ] [`tap`](https://github.com/wooorm/refractor/blob/master/lang/tap.js)
*   [ ] [`tcl`](https://github.com/wooorm/refractor/blob/master/lang/tcl.js)
*   [ ] [`textile`](https://github.com/wooorm/refractor/blob/master/lang/textile.js)
*   [ ] [`tsx`](https://github.com/wooorm/refractor/blob/master/lang/tsx.js)
*   [ ] [`tt2`](https://github.com/wooorm/refractor/blob/master/lang/tt2.js)
*   [ ] [`twig`](https://github.com/wooorm/refractor/blob/master/lang/twig.js)
*   [ ] [`typescript`](https://github.com/wooorm/refractor/blob/master/lang/typescript.js) — alias: `ts`
*   [ ] [`vbnet`](https://github.com/wooorm/refractor/blob/master/lang/vbnet.js)
*   [ ] [`velocity`](https://github.com/wooorm/refractor/blob/master/lang/velocity.js)
*   [ ] [`verilog`](https://github.com/wooorm/refractor/blob/master/lang/verilog.js)
*   [ ] [`vhdl`](https://github.com/wooorm/refractor/blob/master/lang/vhdl.js)
*   [ ] [`vim`](https://github.com/wooorm/refractor/blob/master/lang/vim.js)
*   [ ] [`visualBasic`](https://github.com/wooorm/refractor/blob/master/lang/visual-basic.js)
*   [ ] [`wasm`](https://github.com/wooorm/refractor/blob/master/lang/wasm.js)
*   [ ] [`wiki`](https://github.com/wooorm/refractor/blob/master/lang/wiki.js)
*   [ ] [`xeora`](https://github.com/wooorm/refractor/blob/master/lang/xeora.js) — alias: `xeoracube`
*   [ ] [`xojo`](https://github.com/wooorm/refractor/blob/master/lang/xojo.js)
*   [ ] [`xquery`](https://github.com/wooorm/refractor/blob/master/lang/xquery.js)
*   [ ] [`yaml`](https://github.com/wooorm/refractor/blob/master/lang/yaml.js)

<!--support end-->

## Related

*   [`lowlight`][lowlight] — Same, but based on [`highlight.js`][hljs]

## Projects

*   [`react-syntax-highlighter`](https://github.com/conorhastings/react-syntax-highlighter)
    — [React][] component for syntax highlighting
*   [`rehype-prism`](https://github.com/mapbox/rehype-prism)
    — Syntax highlighting in [**rehype**](https://github.com/rehypejs/rehype)
*   [`react-refractor`](https://github.com/rexxars/react-refractor)
    — Syntax highlighter for [React][]

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://img.shields.io/travis/wooorm/refractor.svg

[build]: https://travis-ci.org/wooorm/refractor

[coverage-badge]: https://img.shields.io/codecov/c/github/wooorm/refractor.svg

[coverage]: https://codecov.io/github/wooorm/refractor

[downloads-badge]: https://img.shields.io/npm/dm/refractor.svg

[downloads]: https://www.npmjs.com/package/refractor

[size-badge]: https://img.shields.io/bundlephobia/minzip/refractor.svg

[size]: https://bundlephobia.com/result?p=refractor

[npm]: https://www.npmjs.com/package/refractor/tutorial

[license]: license

[author]: https://wooorm.com

[releases]: https://github.com/wooorm/refractor/releases

[rehype]: https://github.com/rehypejs/rehype

[names]: https://prismjs.com/#languages-list

[themes]: https://prismjs.com/#theme

[react]: https://facebook.github.io/react/

[vdom]: https://github.com/Matt-Esch/virtual-dom

[to-hyperscript]: https://github.com/syntax-tree/hast-to-hyperscript

[browser]: #browser

[prism]: https://github.com/PrismJS/prism

[prismjs]: https://www.npmjs.com/package/prismjs

[clipboard]: https://github.com/zenorocha/clipboard.js

[lowlight]: https://github.com/wooorm/lowlight

[hljs]: https://github.com/isagalaev/highlight.js

[browserify]: https://github.com/browserify/browserify

[tinyify]: https://github.com/browserify/tinyify

[node]: https://github.com/syntax-tree/hast#ast

[syntax]: #syntaxes

[register]: #refractorregistersyntax
