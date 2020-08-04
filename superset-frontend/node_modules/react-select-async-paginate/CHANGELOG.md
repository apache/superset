## 0.4.0-alpha.1

### Breaking changes

* `AsyncPaginateBase` is removed. `AsyncPaginate` supports `inputValue`, `menuIsOpen`, `onInputChange`, `onMenuClose`, `onMenuOpen` now.

## 0.4.0-alpha.0

The project was fully rewritten to **typescript** and **react hooks**.

### Breaking changes

* Use `withAsyncPaginate` and `withAsyncPaginateBase` instead of `SelectComponent` prop.

  ```javascript
  const CustomAsyncPagiante = withAsyncPaginate(SelectComponent);
  ```

* `AsyncPaginateBase` is removed. `AsyncPaginate` supports `inputValue`, `menuIsOpen`, `onInputChange`, `onMenuClose`, `onMenuOpen` now.

* `additional` is `undefined` by default instead of `null`.

* Save previous additional if not changed.

* Validate result of `loadOptions` call.

* Use named export instead of default export.

  ```javascript
  import { AsyncPaginate } from 'react-select-async-paginate';
  ```

## 0.3.14 (01 apr 2020)

### Bugfix

- Removed excess check of scrollability of menu for load more options [#52](https://github.com/vtaits/react-select-async-paginate/issues/52)

## 0.3.13 (28 mar 2020)

### Bugfix

- Fixed checking of the need to load options [#51](https://github.com/vtaits/react-select-async-paginate/issues/51)

## 0.3.12 (17 mar 2020)

### New features

- Add `loadOptionsOnMenuOpen` prop

## 0.3.6 (06 aug 2019)

### Bugfix

- Request options automatically on change `cacheUniq` if `defaultOptions` is `true`

## 0.3.5 (30 jul 2019)

### New features

- Support `defaultOptions` prop

## 0.3.4 (15 jun 2019)

### Bugfix

- Changed TypeScript typings

## 0.3.3 (06 jun 2019)

### New features

- Added TypeScript typings

## 0.3.2 (03 jun 2019)

### New features

- Support `react-select` v3

## 0.3.1 (24 may 2019)

### Bugfix

- Disabled filtering of options in select by default.

## 0.3.0 (25 apr 2019)

### New features

- Moved logic of opening and closing menu to `AsyncPaginateBase`.

### Breaking changes

- `AsyncPaginateBase` now requires `menuIsOpen` prop.
- `AsyncPaginate` not supports `onMenuOpen` and `onMenuClose`. You should use `AsyncPaginateBase` for those cases now.

## 0.2.9 (25 mar 2019)

### New features

- Added `AsyncPaginateBase` component for manual control of input value.
- Added `onMenuClose` and `onMenuOpen` callbacks.

## 0.2.8 (31 jan 2019)

### New features

- Added `SelectComponent` prop for usage of custom base select component.

## 0.2.7 (23 jan 2019)

### New features

- Added `reduceOptions` prop for reduce grouped options from different groups into one.
- Added `reduceGroupedOptions` util.

## 0.2.6 (15 jan 2019)

### New features

- Added `shouldLoadMore` prop.

## 0.2.5 (11 jan 2019)

### New features

- Added `debounceTimeout` prop.
- Added `additional` prop for collect additional data of requests (e.g. current page number).
