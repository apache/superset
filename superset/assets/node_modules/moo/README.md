![](cow.png)

Moo!
====

Moo is a highly-optimised tokenizer/lexer generator. Use it to tokenize your strings, before parsing 'em with a parser like [nearley](https://github.com/hardmath123/nearley) or whatever else you're into.

* [Fast](#is-it-fast)
* [Convenient](#usage)
* uses [Regular Expressions](#on-regular-expressions)
* tracks [Line Numbers](#line-numbers)
* handles [Keywords](#keywords)
* supports [States](#states)
* custom [Errors](#errors)
* is even [Iterable](#iteration)
* has no dependencies
* <3KB gzipped
* Moo!

Is it fast?
-----------

Yup! Flying-cows-and-singed-steak fast.

Moo is the fastest JS tokenizer around. It's **~2–10x** faster than most other tokenizers; it's a **couple orders of magnitude** faster than some of the slower ones.

Define your tokens **using regular expressions**. Moo will compile 'em down to a **single RegExp for performance**. It uses the new ES6 **sticky flag** where possible to make things faster; otherwise it falls back to an almost-as-efficient workaround. (For more than you ever wanted to know about this, read [adventures in the land of substrings and RegExps](http://mrale.ph/blog/2016/11/23/making-less-dart-faster.html).)

You _might_ be able to go faster still by writing your lexer by hand rather than using RegExps, but that's icky.

Oh, and it [avoids parsing RegExps by itself](https://hackernoon.com/the-madness-of-parsing-real-world-javascript-regexps-d9ee336df983#.2l8qu3l76). Because that would be horrible.


Usage
-----

First, you need to do the needful: `$ npm install moo`, or whatever will ship this code to your computer. Alternatively, grab the `moo.js` file by itself and slap it into your web page via a `<script>` tag; moo is completely standalone.

Then you can start roasting your very own lexer/tokenizer:

```js
    const moo = require('moo')

    let lexer = moo.compile({
      WS:      /[ \t]+/,
      comment: /\/\/.*?$/,
      number:  /0|[1-9][0-9]*/,
      string:  /"(?:\\["\\]|[^\n"\\])*"/,
      lparen:  '(',
      rparen:  ')',
      keyword: ['while', 'if', 'else', 'moo', 'cows'],
      NL:      { match: /\n/, lineBreaks: true },
    })
```

And now throw some text at it:

```js
    lexer.reset('while (10) cows\nmoo')
    lexer.next() // -> { type: 'keyword', value: 'while' }
    lexer.next() // -> { type: 'WS', value: ' ' }
    lexer.next() // -> { type: 'lparen', value: '(' }
    lexer.next() // -> { type: 'number', value: '10' }
    // ...
```

When you reach the end of Moo's internal buffer, next() will return `undefined`. You can always `reset()` it and feed it more data when that happens.


On Regular Expressions
----------------------

RegExps are nifty for making tokenizers, but they can be a bit of a pain. Here are some things to be aware of:

* You often want to use **non-greedy quantifiers**: e.g. `*?` instead of `*`. Otherwise your tokens will be longer than you expect:

    ```js
    let lexer = moo.compile({
      string: /".*"/,   // greedy quantifier *
      // ...
    })

    lexer.reset('"foo" "bar"')
    lexer.next() // -> { type: 'string', value: 'foo" "bar' }
    ```
    
    Better:
    
    ```js
    let lexer = moo.compile({
      string: /".*?"/,   // non-greedy quantifier *?
      // ...
    })

    lexer.reset('"foo" "bar"')
    lexer.next() // -> { type: 'string', value: 'foo' }
    lexer.next() // -> { type: 'space', value: ' ' }
    lexer.next() // -> { type: 'string', value: 'bar' }
    ```

* The **order of your rules** matters. Earlier ones will take precedence.

    ```js
    moo.compile({
        identifier:  /[a-z0-9]+/,
        number:  /[0-9]+/,
    }).reset('42').next() // -> { type: 'identifier', value: '42' }

    moo.compile({
        number:  /[0-9]+/,
        identifier:  /[a-z0-9]+/,
    }).reset('42').next() // -> { type: 'number', value: '42' }
    ```

* Moo uses **multiline RegExps**. This has a few quirks: for example, the **dot `/./` doesn't include newlines**. Use `[^]` instead if you want to match newlines too.

* Since an excluding character ranges like `/[^ ]/` (which matches anything but a space) _will_ include newlines, you have to be careful not to include them by accident! In particular, the whitespace metacharacter `\s` includes newlines.


Line Numbers
------------

Moo tracks detailed information about the input for you.

It will track line numbers, as long as you **apply the `lineBreaks: true` option to any rules which might contain newlines**. Moo will try to warn you if you forget to do this.

Note that this is `false` by default, for performance reasons: counting the number of lines in a matched token has a small cost. For optimal performance, only match newlines inside a dedicated token:

```js
    newline: {match: '\n', lineBreaks: true},
```


### Token Info ###

Token objects (returned from `next()`) have the following attributes:

* **`type`**: the name of the group, as passed to compile.
* **`value`**: the match contents.
* **`offset`**: the number of bytes from the start of the buffer where the match starts.
* **`lineBreaks`**: the number of line breaks found in the match. (Always zero if this rule has `lineBreaks: false`.)
* **`line`**: the line number of the beginning of the match, starting from 1.
* **`col`**: the column where the match begins, starting from 1.


### Reset ###

Calling `reset()` on your lexer will empty its internal buffer, and set the line, column, and offset counts back to their initial value.

If you don't want this, you can `save()` the state, and later pass it as the second argument to `reset()` to explicitly control the internal state of the lexer.

```js
    lexer.reset('some line\n')
    let info = lexer.save() // -> { line: 10 }
    lexer.next() // -> { line: 10 }
    lexer.next() // -> { line: 11 }
    // ...
    lexer.reset('a different line\n', info)
    lexer.next() // -> { line: 10 }
```


Keywords
--------

Moo makes it convenient to define literals.

```js
    moo.compile({
      lparen:  '(',
      rparen:  ')',
      keyword: ['while', 'if', 'else', 'moo', 'cows'],
    })
```

It'll automatically compile them into regular expressions, escaping them where necessary.

**Keywords** should be written using the `keywords` attribute.

```js
    moo.compile({
      IDEN: {match: /[a-zA-Z]+/, keywords: {
        KW: ['while', 'if', 'else', 'moo', 'cows']),
      }},
      SPACE: {match: /\s+/, lineBreaks: true},
    })
```


### Why? ###

You need to do this to ensure the **longest match** principle applies, even in edge cases.

Imagine trying to parse the input `className` with the following rules:

```js
    keyword: ['class'],
    identifier: /[a-zA-Z]+/,
```

You'll get _two_ tokens — `['class', 'Name']` -- which is _not_ what you want! If you swap the order of the rules, you'll fix this example; but now you'll lex `class` wrong (as an `identifier`).

The keywords helper checks matches against the list of keywords; if any of them match, it uses the type `'keyword'` instead of `'identifier'` (for this example).


### Keyword Types ###

Keywords can also have **individual types**.

```js
    let lexer = moo.compile({
      name: {match: /[a-zA-Z]+/, keywords: {
        'kw-class': 'class',
        'kw-def': 'def',
        'kw-if': 'if',
      }},
      // ...
    })
    lexer.reset('def foo')
    lexer.next() // -> { type: 'kw-def', value: 'def' }
    lexer.next() // space
    lexer.next() // -> { type: 'name', value: 'foo' }
```

You can use [itt](https://github.com/nathan/itt)'s iterator adapters to make constructing keyword objects easier:

```js
    itt(['class', 'def', 'if'])
    .map(k => ['kw-' + k, k])
    .toObject()
```


States
------

Sometimes you want your lexer to support different states. This is useful for string interpolation, for example: to tokenize `a${{c: d}}e`, you might use:

```js
    let lexer = moo.states({
      main: {
        strstart: {match: '`', push: 'lit'},
        ident:    /\w+/,
        lbrace:   {match: '{', push: 'main'},
        rbrace:   {match: '}', pop: true},
        colon:    ':',
        space:    {match: /\s+/, lineBreaks: true},
      },
      lit: {
        interp:   {match: '${', push: 'main'},
        escape:   /\\./,
        strend:   {match: '`', pop: true},
        const:    {match: /(?:[^$`]|\$(?!\{))+/, lineBreaks: true},
      },
    })
    // <= `a${{c: d}}e`
    // => strstart const interp lbrace ident colon space ident rbrace rbrace const strend
```

It's also nice to let states inherit rules from other states and be able to count things, e.g. the interpolated expression state needs a `}` rule that can tell if it's a closing brace or the end of the interpolation, but is otherwise identical to the normal expression state.

To support this, Moo allows annotating tokens with `push`, `pop` and `next`:

* **`push`** moves the lexer to a new state, and pushes the old state onto the stack.
* **`pop`** returns to a previous state, by removing one or more states from the stack.
* **`next`** moves to a new state, but does not affect the stack.


Errors
------

If no token matches, Moo will throw an Error.

If you'd rather treat errors as just another kind of token, you can ask Moo to do so.

```js
    moo.compile({
      // ...
      myError: moo.error,
    })
    
    moo.reset('invalid')
    moo.next() // -> { type: 'myError', value: 'invalid' }
```


You can have a token type that both matches tokens _and_ contains error values.

```js
    moo.compile({
      // ...
      myError: {match: /[\$?`]/, error: true},
    })
```

If you want to throw an error from your parser, you might find `formatError` helpful. Call it with the offending token:

```js
throw new Error(lexer.formatError(token, "invalid syntax"))
```

And it returns a string with a pretty error message.

```
Error: invalid syntax at line 2 col 15:

  totally valid `syntax`
                ^
```


Iteration
---------

Iterators: we got 'em.

```js
    for (let here of lexer) {
      // here = { type: 'number', value: '123', ... }
    }
```

Create an array of tokens.

```js
    let tokens = Array.from(lexer);
```

Use [itt](https://github.com/nathan/itt)'s iteration tools with Moo.

```js
    for (let [here, next] = itt(lexer).lookahead()) { // pass a number if you need more tokens
      // enjoy!
    }
```


Transform
---------

Moo doesn't allow capturing groups, but you can supply a transform function, `value()`, which will be called on the value before storing it in the Token object.

```js
    moo.compile({
      STRING: [
        {match: /"""[^]*?"""/, lineBreaks: true, value: x => x.slice(3, -3)},
        {match: /"(?:\\["\\rn]|[^"\\])*?"/, lineBreaks: true, value: x => x.slice(1, -1)},
        {match: /'(?:\\['\\rn]|[^'\\])*?'/, lineBreaks: true, value: x => x.slice(1, -1)},
      ],
      // ...
    })
```


Contributing
------------

Do check the [FAQ](https://github.com/tjvr/moo/issues?q=label%3Aquestion).

Before submitting an issue, [remember...](https://github.com/tjvr/moo/blob/master/.github/CONTRIBUTING.md)

