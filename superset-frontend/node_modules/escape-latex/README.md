# escape-latex

[![Greenkeeper badge](https://badges.greenkeeper.io/dangmai/escape-latex.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/dangmai/escape-latex.png)](https://travis-ci.org/dangmai/escape-latex)

Escape LaTeX special characters with Javascript in NodeJS (>= 4.x) environment.

## Usage

```javascript
npm install escape-latex
var lescape = require('escape-latex');
lescape("String to be escaped here #yolo");
```

## API

```javascript
lescape((input: String), {
  preserveFormatting: Boolean,
  escapeMapFn: Function,
});
```

By default,
`escape-latex` only escapes characters that would result in malformed LaTeX.
These characters include `# $ % & \ ^ _ { }`.

This means that the final LaTeX output might not look the same as your input Javascript string.
For example, multiple spaces are kept as-is, which may be truncated to 1 space by your LaTeX software.

If you want the final output string to be as similar to your input Javascript string as possible,
you can set the `preserveFormatting` param to `true`, like so:

```javascript
lescape("Hello   World", { preserveFormatting: true });
// Hello~~~World
```

Which will be converted to three non-breaking spaces by your LaTeX software.

The list of format characters that are escaped include `space, \t (tab), – (en-dash), — (em-dash)`.

There is also the param `escapeMapFn` to modify the mapping of escaped characters,
so you can add/modify/remove your own escapes if necessary.

It accepts a callback function that takes in the default character escapes and the formatting escapes as parameters, and returns a complete escape mapping. Here's an example:

```javascript
lescape("Hello   World", {
  preseveFormatting: true,
  escapeMapFn: function(defaultEscapes, formattingEscapes) {
    formattingEscapes[" "] = "\\\\";
    return Object.assign({}, defaultEscapes, formattingEscapes);
  },
});
// Hello\\\\\\world
```

## Testing

```
npm test
```

## Notes

* If you are updating from `escape-latex < 1.0.0`,
  the `en-dash` and `em-dash` are no longer escaped by default.
  Please use `preserveFormatting` to turn them on if necessary.

## License

MIT
