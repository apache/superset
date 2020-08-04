# 2.3.1

- Use deep import for inline-style-prefixer ([#363](https://github.com/Khan/aphrodite/pull/363))

# 2.3.0

- Bump inline-style-prefixer 4.0.2 -> 5.0.4 ([#358](https://github.com/Khan/aphrodite/pull/358))
- Update rollup to v1.2.0 and babel to v7 ([#362](https://github.com/Khan/aphrodite/pull/362))

# 2.2.3

- Bump inline-style-prefixer 4.0.0 -> 4.0.2 ([#341](https://github.com/Khan/aphrodite/pull/341))

# 2.2.2

- Fix multiple `@font-face` of the same name ([#327](https://github.com/Khan/aphrodite/pull/327))
- Fix typings to allow for extending ([#330](https://github.com/Khan/aphrodite/pull/330))

# 2.2.1

- Use code-splitting for default and no-important builds ([#325](https://github.com/Khan/aphrodite/pull/325))

# 2.2.0

- Expose `defaultSelectorHandlers` and `injectAndGetClassName` ([#320](https://github.com/Khan/aphrodite/pull/320))


# 2.1.1

- Add `minify` and `flushToStyleTag` to no-important ([#316](https://github.com/Khan/aphrodite/pull/316))

# 2.1.0

- Expose `flushToStyleTag` ([#310](https://github.com/Khan/aphrodite/pull/310))

# 2.0.0

- Selector handlers now must return an array of rules. Returning a string containing multiple rules is deprecated. The fallback behavior for selector handlers that still return strings is to use media queries, which are not supported in older browsers like Internet Explorer 8, which makes this a breaking change. If you find yourself seeing this warning, you need to update your custom selector handlers to return arrays of strings instead of plain strings. This fallback will be removed entirely in a future major release.
- `insertRule` is now used to inject styles to the style element ([#240](https://github.com/Khan/aphrodite/pull/240))
- New `minify()` controls the minification of style names (defaults to `true` when `process.env.NODE_ENV === 'production'`) ([#291](https://github.com/Khan/aphrodite/pull/291))
- New TypeScript typings ([#302](https://github.com/Khan/aphrodite/pull/302))
- New `StyleSheetTestUtils.getBufferedStyles()` ([#294](https://github.com/Khan/aphrodite/pull/294))
- `StyleSheetTestUtils` will be minified out in production builds (i.e. when `process.env.NODE_ENV === 'production'`) ([#305](https://github.com/Khan/aphrodite/pull/305))
- Reduce bundle size impact by building with rollup instead of webpack ([#281](https://github.com/Khan/aphrodite/pull/281))
- Simplify output for more useful RunKit result ([#244](https://github.com/Khan/aphrodite/pull/244))
- Update inline-style-prefixer dependency to v4 ([#297](https://github.com/Khan/aphrodite/pull/297))

# 1.2.5

- Allow overriding styles to re-order the styles they override ([#279](https://github.com/Khan/aphrodite/pull/279))

# 1.2.4

- Minify combined class names in production builds ([#248](https://github.com/Khan/aphrodite/pull/248))

# 1.2.3

- Revert make string handlers use `useImportant`([f162220e3](https://github.com/Khan/aphrodite/commit/f162220e3d7321c7ede0aefc189de9bb694e5107)

# 1.2.2

- Minify selectors when building with `process.env.NODE_ENV === 'production'` ([#246](https://github.com/Khan/aphrodite/pull/246))
- Make string handlers use `useImportant` ([#256](https://github.com/Khan/aphrodite/pull/256))

# 1.2.1

- Fix bug that caused unexpected mutations of nested objects ([#231](https://github.com/Khan/aphrodite/issues/231))
- More optimizations ([#233](https://github.com/Khan/aphrodite/pull/233), [#216](https://github.com/Khan/aphrodite/pull/216))

# 1.2.0

- Allow specifying styles as `Map`s to guarantee ordering ([#200](https://github.com/Khan/aphrodite/pull/200))
- Replace murmur hash with djb2 hash. This changes all generated classNames. ([#203](https://github.com/Khan/aphrodite/pull/203))
- Misc. optimizations ([#201](https://github.com/Khan/aphrodite/pull/201), [#202](https://github.com/Khan/aphrodite/pull/202), [#204](https://github.com/Khan/aphrodite/pull/204), [#205](https://github.com/Khan/aphrodite/pull/205), [#206](https://github.com/Khan/aphrodite/pull/206), [#207](https://github.com/Khan/aphrodite/pull/207), [#208](https://github.com/Khan/aphrodite/pull/208), [#213](https://github.com/Khan/aphrodite/pull/213))

# 1.1.0

- Animations now support multiple animations per style ([see section on Animations](https://github.com/Khan/aphrodite#animations)) ([PR #167](https://github.com/Khan/aphrodite/pull/167))

# 1.0.0
- Syntax extensions ([see section on Advanced extensions](https://github.com/Khan/aphrodite#advanced-extensions)) ([PR #95](https://github.com/Khan/aphrodite/pull/95))

# 0.6.0
- `css()` will now accept arbitrarily nested arrays. i.e. instead of `css(styles.a, styles.b)`, you can now do `css([styles.a, [styles.b, styles.c]])`. ([PR #154](https://github.com/Khan/aphrodite/pull/154))
- Support for multiple font styles with the same font-family. ([PR #82](https://github.com/Khan/aphrodite/pull/82))
