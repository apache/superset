# XRegExp 4.0.0

[![Build Status](https://travis-ci.org/slevithan/xregexp.svg?branch=master)](https://travis-ci.org/slevithan/xregexp)

XRegExp provides augmented (and extensible) JavaScript regular expressions. You get modern syntax and flags beyond what browsers support natively. XRegExp is also a regex utility belt with tools to make your grepping and parsing easier, while freeing you from regex cross-browser inconsistencies and other annoyances.

XRegExp supports all native ES6 regular expression syntax. It supports ES5+ browsers, and you can use it with Node.js or as a RequireJS module.

## Performance

XRegExp compiles to native `RegExp` objects. Therefore regexes built with XRegExp perform just as fast as native regular expressions. There is a tiny extra cost when compiling a pattern for the first time.

## Usage examples

```js
// Using named capture and flag x for free-spacing and line comments
const date = XRegExp(
    `(?<year>  [0-9]{4} ) -?  # year
     (?<month> [0-9]{2} ) -?  # month
     (?<day>   [0-9]{2} )     # day`, 'x');

// XRegExp.exec gives you named backreferences on the match result
let match = XRegExp.exec('2017-02-22', date);
match.year; // -> '2017'

// It also includes optional pos and sticky arguments
let pos = 3;
const result = [];
while (match = XRegExp.exec('<1><2><3>4<5>', /<(\d+)>/, pos, 'sticky')) {
    result.push(match[1]);
    pos = match.index + match[0].length;
}
// result -> ['2', '3']

// XRegExp.replace allows named backreferences in replacements
XRegExp.replace('2017-02-22', date, '$<month>/$<day>/$<year>');
// -> '02/22/2017'
XRegExp.replace('2017-02-22', date, (match) => {
    return `${match.month}/${match.day}/${match.year}`;
});
// -> '02/22/2017'

// XRegExps compile to RegExps and work perfectly with native methods
date.test('2017-02-22');
// -> true

// The only caveat is that named captures must be referenced using
// numbered backreferences if used with native methods
'2017-02-22'.replace(date, '$2/$3/$1');
// -> '02/22/2017'

// Use XRegExp.forEach to extract every other digit from a string
const evens = [];
XRegExp.forEach('1a2345', /\d/, (match, i) => {
    if (i % 2) evens.push(+match[0]);
});
// evens -> [2, 4]

// Use XRegExp.matchChain to get numbers within <b> tags
XRegExp.matchChain('1 <b>2</b> 3 <B>4 \n 56</B>', [
    XRegExp('(?is)<b>.*?</b>'),
    /\d+/
]);
// -> ['2', '4', '56']

// You can also pass forward and return specific backreferences
const html =
    `<a href="http://xregexp.com/">XRegExp</a>
     <a href="http://www.google.com/">Google</a>`;
XRegExp.matchChain(html, [
    {regex: /<a href="([^"]+)">/i, backref: 1},
    {regex: XRegExp('(?i)^https?://(?<domain>[^/?#]+)'), backref: 'domain'}
]);
// -> ['xregexp.com', 'www.google.com']

// Merge strings and regexes, with updated backreferences
XRegExp.union(['m+a*n', /(bear)\1/, /(pig)\1/], 'i', {conjunction: 'or'});
// -> /m\+a\*n|(bear)\1|(pig)\2/i
```

These examples give the flavor of what's possible, but XRegExp has more syntax, flags, methods, options, and browser fixes that aren't shown here. You can also augment XRegExp's regular expression syntax with addons (see below) or write your own. See [xregexp.com](http://xregexp.com/) for details.

## Addons

You can either load addons individually, or bundle all addons with XRegExp by loading `xregexp-all.js` from https://unpkg.com/xregexp/xregexp-all.js.

### Unicode

If not using `xregexp-all.js`, first include the Unicode Base script and then one or more of the addons for Unicode blocks, categories, properties, or scripts.

Then you can do this:

```js
// Test the Unicode category L (Letter)
const unicodeWord = XRegExp('^\\pL+$');
unicodeWord.test('Русский'); // -> true
unicodeWord.test('日本語'); // -> true
unicodeWord.test('العربية'); // -> true

// Test some Unicode scripts
XRegExp('^\\p{Hiragana}+$').test('ひらがな'); // -> true
XRegExp('^[\\p{Latin}\\p{Common}]+$').test('Über Café.'); // -> true
```

By default, `\p{…}` and `\P{…}` support the Basic Multilingual Plane (i.e. code points up to `U+FFFF`). You can opt-in to full 21-bit Unicode support (with code points up to `U+10FFFF`) on a per-regex basis by using flag `A`. This is called *astral mode*. You can automatically add flag `A` for all new regexes by running `XRegExp.install('astral')`. When in astral mode, `\p{…}` and `\P{…}` always match a full code point rather than a code unit, using surrogate pairs for code points above `U+FFFF`.

```js
// Using flag A to match astral code points
XRegExp('^\\pS$').test('💩'); // -> false
XRegExp('^\\pS$', 'A').test('💩'); // -> true
XRegExp('(?A)^\\pS$').test('💩'); // -> true
// Using surrogate pair U+D83D U+DCA9 to represent U+1F4A9 (pile of poo)
XRegExp('(?A)^\\pS$').test('\uD83D\uDCA9'); // -> true

// Implicit flag A
XRegExp.install('astral');
XRegExp('^\\pS$').test('💩'); // -> true
```

Opting in to astral mode disables the use of `\p{…}` and `\P{…}` within character classes. In astral mode, use e.g. `(\pL|[0-9_])+` instead of `[\pL0-9_]+`.

XRegExp uses Unicode 9.0.0.

### XRegExp.build

Build regular expressions using named subpatterns, for readability and pattern reuse:

```js
const time = XRegExp.build('(?x)^ {{hours}} ({{minutes}}) $', {
    hours: XRegExp.build('{{h12}} : | {{h24}}', {
        h12: /1[0-2]|0?[1-9]/,
        h24: /2[0-3]|[01][0-9]/
    }),
    minutes: /^[0-5][0-9]$/
});

time.test('10:59'); // -> true
XRegExp.exec('10:59', time).minutes; // -> '59'
```

Named subpatterns can be provided as strings or regex objects. A leading `^` and trailing unescaped `$` are stripped from subpatterns if both are present, which allows embedding independently-useful anchored patterns. `{{…}}` tokens can be quantified as a single unit. Any backreferences in the outer pattern or provided subpatterns are automatically renumbered to work correctly within the larger combined pattern. The syntax `({{name}})` works as shorthand for named capture via `(?<name>{{name}})`. Named subpatterns cannot be embedded within character classes.

#### XRegExp.tag (included with XRegExp.build)

Provides tagged template literals that create regexes with XRegExp syntax and flags:

```js
const h12 = /1[0-2]|0?[1-9]/;
const h24 = /2[0-3]|[01][0-9]/;
const hours = XRegExp.tag('x')`${h12} : | ${h24}`;
const minutes = /^[0-5][0-9]$/;
// Note that explicitly naming the 'minutes' group is required for named backreferences
const time = XRegExp.tag('x')`^ ${hours} (?<minutes>${minutes}) $`;
time.test('10:59'); // -> true
XRegExp.exec('10:59', time).minutes; // -> '59'
```

XRegExp.tag does more than just basic interpolation. For starters, you get all the XRegExp syntax and flags. Even better, since `XRegExp.tag` uses your pattern as a raw string, you no longer need to escape all your backslashes. And since it relies on `XRegExp.build` under the hood, you get all of its extras for free. Leading `^` and trailing unescaped `$` are stripped from interpolated patterns if both are present (to allow embedding independently useful anchored regexes), interpolating into a character class is an error (to avoid unintended meaning in edge cases), interpolated patterns are treated as atomic units when quantified, interpolated strings have their special characters escaped, and any backreferences within an interpolated regex are rewritten to work within the overall pattern.

### XRegExp.matchRecursive

Match recursive constructs using XRegExp pattern strings as left and right delimiters:

```js
const str1 = '(t((e))s)t()(ing)';
XRegExp.matchRecursive(str1, '\\(', '\\)', 'g');
// -> ['t((e))s', '', 'ing']

// Extended information mode with valueNames
const str2 = 'Here is <div> <div>an</div></div> example';
XRegExp.matchRecursive(str2, '<div\\s*>', '</div>', 'gi', {
    valueNames: ['between', 'left', 'match', 'right']
});
/* -> [
{name: 'between', value: 'Here is ',       start: 0,  end: 8},
{name: 'left',    value: '<div>',          start: 8,  end: 13},
{name: 'match',   value: ' <div>an</div>', start: 13, end: 27},
{name: 'right',   value: '</div>',         start: 27, end: 33},
{name: 'between', value: ' example',       start: 33, end: 41}
] */

// Omitting unneeded parts with null valueNames, and using escapeChar
const str3 = '...{1}.\\{{function(x,y){return {y:x}}}';
XRegExp.matchRecursive(str3, '{', '}', 'g', {
    valueNames: ['literal', null, 'value', null],
    escapeChar: '\\'
});
/* -> [
{name: 'literal', value: '...',  start: 0, end: 3},
{name: 'value',   value: '1',    start: 4, end: 5},
{name: 'literal', value: '.\\{', start: 6, end: 9},
{name: 'value',   value: 'function(x,y){return {y:x}}', start: 10, end: 37}
] */

// Sticky mode via flag y
const str4 = '<1><<<2>>><3>4<5>';
XRegExp.matchRecursive(str4, '<', '>', 'gy');
// -> ['1', '<<2>>', '3']
```

`XRegExp.matchRecursive` throws an error if it scans past an unbalanced delimiter in the target string.

## Installation and usage

In browsers (bundle XRegExp with all of its addons):

```html
<script src="https://unpkg.com/xregexp/xregexp-all.js"></script>
```

Using [npm](https://www.npmjs.com/):

```bash
npm install xregexp
```

In [Node.js](http://nodejs.org/):

```js
const XRegExp = require('xregexp');
```

In an AMD loader like [RequireJS](http://requirejs.org/):

```js
require({paths: {xregexp: 'xregexp-all'}}, ['xregexp'], (XRegExp) => {
    console.log(XRegExp.version);
});
```

## About

XRegExp copyright 2007-2017 by [Steven Levithan](http://stevenlevithan.com/). Unicode data generators by [Mathias Bynens](http://mathiasbynens.be/), adapted from [unicode-data](http://git.io/unicode). XRegExp's syntax extensions and flags come from [Perl](http://www.perl.org/), [.NET](http://www.microsoft.com/net), etc.

All code, including addons, tools, and tests, is released under the terms of the [MIT License](http://mit-license.org/).

Learn more at [xregexp.com](http://xregexp.com/).
