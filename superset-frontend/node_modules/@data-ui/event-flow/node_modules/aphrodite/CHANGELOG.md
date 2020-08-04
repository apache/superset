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
