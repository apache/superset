# @superset-ui : Change Log

## 0.10.5 (2019-03-21)


### feat

* chart: Add `<ChartDataProvider />` (#120) ([ade9dbe32d2e76a095ca864ce9fdc277688035df](https://github.com/apache-superset/superset-ui/pull/120)), closes [#120](https://github.com/apache-superset/superset-ui/pull/120)
* 🎸 Improved QueryObject to handle more fields (#116) ([57a64b13ea5c93e57fcf356e627b2b668ade8b1f](https://github.com/apache-superset/superset-ui/commit/57a64b13ea5c93e57fcf356e627b2b668ade8b1f)), closes [#116](https://github.com/apache-superset/superset-ui/issues/116)



## 0.10.4 (2019-03-11)


### feat

* add dimension type (#117) ([e4a22ade305fd6ea962648b86ff88431d77ea41e](https://github.com/apache-superset/superset-ui/commit/e4a22ade305fd6ea962648b86ff88431d77ea41e)), closes [#117](https://github.com/apache-superset/superset-ui/issues/117)
* re-export types from @superset-ui/dimension (#115) ([8c3f8b0f5f2edb558cb8e9f708a17d3d3b4b92aa](https://github.com/apache-superset/superset-ui/commit/8c3f8b0f5f2edb558cb8e9f708a17d3d3b4b92aa)), closes [#115](https://github.com/apache-superset/superset-ui/issues/115)



## v0.10.3 (2019-03-07)

### ✨ Features

* feat(superset-ui-dimension): add `mergeMargin()` function (#114) ([c5589384c12f5ff2480e3614cf44b33d85b1299e](https://github.com/apache-superset/superset-ui/commit/c5589384c12f5ff2480e3614cf44b33d85b1299e)), closes [#114](https://github.com/apache-superset/superset-ui/issues/114)

## v0.10.2

### ✨ Features

* feat(superset-ui-chart): add `.clone()` function to `ChartMetadata` (#112) ([1c1ef3b](https://github.com/apache-superset/superset-ui/commit/1c1ef3b)), closes [#112](https://github.com/apache-superset/superset-ui/issues/112)
* feat(superset-ui-connection): Allow `PUT` and `PATCH` in call API ([efcfd1a](https://github.com/apache-superset/superset-ui/commit/efcfd1a))

## v0.10.1

### 💔 BREAKING CHANGE

* `@superset-ui/core` becomes peer dependency

### 🛠️ Internal

* refactor: make `@superset-ui/core` peer dependency (#111) ([e9c7b91](https://github.com/apache-superset/superset-ui/commit/e9c7b91)), closes [#111](https://github.com/apache-superset/superset-ui/issues/111)
* chore: add `commitlint` and `commitizen` config ([cae32ce](https://github.com/apache-superset/superset-ui/commit/cae32ce))
* docs: update changelog ([4d70053](https://github.com/apache-superset/superset-ui/commit/4d70053))

## v0.10.0

### 💔 BREAKING CHANGES

* Rename `FormData ` to `ChartFormData` to avoid naming collision with native JS (#100)
* Rename constants in `NumberFormats` changing `_CHANGE` to `_SIGNED`.
* Default number format is now `SMART_NUMBER` instead of `D3` `.3~s`.

### ✨ Features

* Add SMART_NUMBER formatter and make it default (#109)
* Enable warnings when values are overwritten in registries (#107)

### 🛠️ Internal

* Migrate `plugin-chart-word-cloud` to `@superset-ui-plugins` repo.

## v0.9.6

### 🛠️ Internal

* Update `@superset-ui/chart` dependency.

## v0.9.5

### 🛠️ Internal

* Remove unnecessary export types and remove warning when using `esm` output in target application.

## v0.9.4

### 🐞 Bug fixes

* Make `id` an optional prop for `SuperChart`.

## v0.9.3

### ✨ Features

* Add new package `@superset-ui/dimension`
* Add new package `@superset-ui/plugin-chart-word-cloud`

### 🛠️ Internal

* Minor update and additional unit tests for generator

## v0.9.2

### ✨ Features

* Add more subgenerators to create package and demo in `superset-ui-legacy`
* Support put and delete HTTP methods in `SupersetClient`

## v0.9.1

### 🐞 Bug fixes

* Fix TypeScript declaration for package `jed` with `@superset-ui/translation` distribution.

## v0.9.0

### ✨ Features

* Add `useLegacyApi` field to `ChartMetadata`. This flag will help us determine whether to use the new `/api/v1/query` endpoint or the legacy one.
* Add two generics to `Registry<V, W>`
  * `V` is type of value in the registry
  * `W` is type of value returned from `loader` function when using `.registerLoader(key, loader)`.
  * `W` can be either `V`, `Promise<V>` or `V | Promise<V>`
  * Set `W=V` when does not support asynchronous loader. Making return type of `.get()` become `V` instead of `Promise<V>`
  * By default, `W` is set to `V | Promise<V>` to support both synchronous and asynchronous loaders.
* Include and link TypeScript declaration for package `jed` with `@superset-ui/translation` distribution.

### 🛠️ Internal

* Convert `@superset-ui/number-format` to TypeScript
* Convert `@superset-ui/time-format` to TypeScript
* Convert `@superset-ui/translation` to TypeScript

### 💔 BREAKING CHANGES

* Make number formatter always returns `string`. This is different from previous behavior.

|Value|formatted value (before)|formatted value (after)|
|------------|------------|-----------|
| `null` | `null` | `'null'` |
| `undefined` | `undefined` | `'undefined'` |
| `NaN` | `NaN` | `'NaN'` |

* Make time formatter always returns `string`. This is different from previous behavior.

|Value|formatted value (before)|formatted value (after)|
|------------|------------|-----------|
| `null` | `null` | `'null'` |
| `undefined` | `undefined` | `'undefined'` |
| `NaN` | `NaN` | `'NaN'` |

## v0.8.0

### ✨ Features

* Add SuperChart and convert to TypeScript
* Allow metrics arrays in form data
* Moved query module from `incubator-superset` into `superset-ui`
* Add `reactify` function from `incubator-superset`

### 🐞 Bug fixes

* Handle `BigNumber` conversions to/from JSON without loss of precision

### 🛠️ Internal

* Use DefinitelyTyped's `fetch-mock` type def
* Improved type def for `json-bigint`
* Migrated `@superset-ui/chart` to TypeScript
* Migrated `@superset-ui/color` to TypeScript
* Migrated `@superset-ui/core` to TypeScript
* Made `connection` and `color` packages peer dependencies

## v0.7.2

### ✨ Features

* Make `@superset-ui/time-format` and `@superset-ui/number-format` ignore leading and trailing spaces when looking for formatters.

## v0.7.1

### ✨ Features

* Add new APIs to `@superset-ui/time-format`
  - `createD3TimeFormatter`
  - `createMultiFormatter`
* Add new APIs to `@superset-ui/number-format`
  - `createD3NumberFormatter`
  - `createSiAtMostNDigitFormatter`

## v0.7.0

### ✨ Features

* Add `@superset-ui/time-format` package
* Add `@superset-ui/number-format` package
* Use the recently added `ExtensibleFunction` to make an instance of `CategoricalColorScale` be a function
* Add `overwritePolicy` for `Registry` so developer can customize whether overwriting is `ALLOW`, `WARN` or `PROHIBIT`.

### 🐞 Bug fixes

* Transform input value before setting color.

### 🛠️ Internal

* Rewrite `@superset-ui/connection` in TypeScript

### 💔 BREAKING CHANGES

* Remove `categoricalColorScale.toFunction()`. Now `categoricalColorScale` itself is already a function.
* The color scales no longer convert input to lowercase before finding color.
* Rename `ColorScheme` field `name` to `id`.
* Change `Registry` constructor API to take object instead of single string name.

-----

## v0.6.0

### ✨ Features

* Add `@superset-ui/generator-superset`
* Add `RegistryWithDefaultKey` and `ExtensibleFunction` to `@superset-ui/core`

### 💔 BREAKING CHANGES

* `getDefaultSchemeName()` and `setDefaultSchemeName()` are renamed to `getDefaultKey()` and `setDefaultKey()`

-----

## v0.5.0

### ✨ Features

* Add `@superset-ui/chart`

### 🐞 Bug fixes

* Use simple js to create range

-----

## v0.4.0

### ✨ Features

* Add `@superset-ui/color` for color management

-----

## v0.3.0

### ✨ Features

* Add new `@superset-ui/core` with data structures and utilities.

### 💔 BREAKING CHANGES

* Rename former `@superset-ui/core` to `@superset-ui/connection`.
