# Changelog

## 1.4.2
Throw an error if `Search` is instantiated without the required `uidFieldName` constructor parameter.

## 1.4.1
-

## 1.4.0
Search uid field can now be an array (for nested/deep keys).

## 1.3.7
Fixed `package.json` to include correct files.

## 1.3.6
Performance tuning and removal of eager deopts.

Behind the scenes, this release also includes a rewrite from TypeScript to Flowtype.
The external API should not be impacted by this rewrite however.

## 1.3.5
Fixed (hopefully) previous broken build.

## 1.3.4
Simple tokenizer now supports cyrillic. ([De-Luxis](https://github.com/De-Luxis) - [#21](https://github.com/bvaughn/js-search/pull/21))

## 1.3.3
Fixed a bug in `TfIdfSearchIndex` that caused errors when indexing certain reserved keywords (eg "constructor").

## 1.3.2
Fixed tokenizer bug affecting IE <= 10 that caused prefix and substring token strategies incorrectly index terms.

## 1.3.1
Replaced `array.push.call` with `array.concat` in `addDocuments`.
This avoids potential stack overflow for large documents arrays.

## 1.3.0
`Search.addIndex` supports `Array` parameter for nested values.
`Search` indexing supports non-string values (eg numbers).
Special thanks to @konradjurk for this release.

## 1.2.2
Small tweak to Node export check to avoid `module is not defined` error for browser-based users.

## 1.2.1
Modified export to better support Node environment (thanks to @scommisso).

## 1.2.0
Added `ISearchIndex` interface in order to support TF-IDF (enabled by default).
Removed `IPruningStrategy`; it didn't seem like it added sufficient value to offset performance costs.

## 1.1.1
Udpated stop-words list to avoid filtering `Object.prototype` properties.

## 1.1.0
Refactored stemming and stop-word support to be based on `ITokenizer` decorators for better accuracy.
Updated README examples with more info.

## 1.0.2
Added `JsSearch` module wrapper around library and renamed `JsSearch` class to `Search`.
Added stemming support by way of the new `StemmingSanitizerDecorator` class.

## 1.0.1
Renamed `WhitespaceTokenizer` to `SimpleTokenizer` and added better support for punctuation.
Added `StopWordsIndexStrategyDecorator` to support stop words filtering.

## 1.0.0
Initial release!
