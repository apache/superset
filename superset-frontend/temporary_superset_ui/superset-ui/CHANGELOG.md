# @superset-ui : Change Log

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
