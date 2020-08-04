### Version 2.0.0 (2019-02-02)

- Removed: The `margins` option. Check out
  [@aitodotai/json-stringify-pretty-compact] if you miss it. This package is now
  purely a combination of `JSON.stringify(obj)` and
  `JSON.stringify(obj, null, 2)` with no additional formatting features on top
  of that.
- Added: Support for the [replacer] argument.
- Changed: Passing `undefined` to options now result in the default value being
  used. This is to align with how destructuring defaults work in ES2015.

### Version 1.2.0 (2018-04-22)

- Added: TypeScript definition. Thanks to @domoritz!

### Version 1.1.0 (2018-01-12)

- Added: The `margins` option. Thanks to @randallsquared!

### Version 1.0.4 (2017-04-29)

- Fixed: String contents are no longer accidentally modified in some cases.
  Thanks to @powellquiring!

### Version 1.0.3 (2017-03-30)

- No code changes. Just trying to get the readme to show on npmjs.com.

### Version 1.0.2 (2016-09-08)

- Improved: Limited npm package contents for a smaller download.

### Version 1.0.1 (2014-11-03)

- Fixed: Commas are now accounted for when calculating the available length of a
  line, so that they do not appear outside `options.maxLength`.

### Version 1.0.0 (2014-11-01)

- Initial release.

<!-- prettier-ignore-start -->
[@aitodotai/json-stringify-pretty-compact]: https://www.npmjs.com/package/@aitodotai/json-stringify-pretty-compact
[replacer]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter
<!-- prettier-ignore-end -->
