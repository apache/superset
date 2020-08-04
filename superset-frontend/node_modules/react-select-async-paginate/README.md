[![NPM](https://img.shields.io/npm/v/react-select-async-paginate/next.svg)](https://www.npmjs.com/package/react-select-async-paginate/v/next)
[![NPM](https://img.shields.io/npm/v/react-select-async-paginate.svg)](https://www.npmjs.com/package/react-select-async-paginate)
[![Build Status](https://img.shields.io/travis/vtaits/react-select-async-paginate.svg?style=flat)](https://travis-ci.org/vtaits/react-select-async-paginate)
[![codecov.io](https://codecov.io/gh/vtaits/react-select-async-paginate/branch/master/graph/badge.svg)](https://codecov.io/gh/vtaits/react-select-async-paginate)
[![Types](https://img.shields.io/npm/types/react-select-async-paginate.svg)](https://www.npmjs.com/package/react-select-async-paginate)

# react-select-async-paginate

Wrapper above `react-select` that supports pagination on menu scroll.

## Sandbox examples

- [Simple](https://codesandbox.io/s/o75rno2w65)
- [Multi](https://codesandbox.io/s/2323yrlo9r)
- [Creatable](https://codesandbox.io/s/5ycdz)
- [Creatable with adding new options](https://codesandbox.io/s/6pznz)
- [Initial options](https://codesandbox.io/s/q111nqw9j)
- [Autoload](https://codesandbox.io/s/v8pkw)
- [Debounce](https://codesandbox.io/s/5y2xq39v5k)
- [Request by page number](https://codesandbox.io/s/10r1k12vk7)
- [Customization check of the need of load options](https://codesandbox.io/s/kokz6j65zv)
- [Grouped options](https://codesandbox.io/s/oxv62x8j4y)
- [Custom select base](https://codesandbox.io/s/l2pjrv0ryl)
- [Manual control of input value and menu opening](https://codesandbox.io/s/6y34j51k1n)

## Versions

| react-select | react-select-async-paginate |
|--------------|-----------------------------|
| 3.x | 0.4.x, ^0.3.2 |
| 2.x | 0.3.x, 0.2.x |
| 1.x | 0.1.x |

## Installation

```
npm install react-select react-select-async-paginate@next
```

or

```
yarn add react-select react-select-async-paginate@next
```

## Usage

`AsyncPaginate` is an alternative of `Async` but supports loading page by page. It is wrapper above default `react-select` thus it accepts all props of default `Select` except `isLoading`. And there are some new props:

### loadOptions

Required. Async function that take next arguments:

1. Current value of search input.
2. Loaded options for current search.
3. Collected additional data e.g. current page number etc. For first load it is `additional` from props, for next is `additional` from previous response for current search. `null` by default.

It should return next object:

```
{
  options: Array,
  hasMore: boolean,
  additional?: any,
}
```

It similar to `loadOptions` from `Select.Async` but there is some differences:

1. Loaded options as 2nd argument.
2. Additional data as 3nd argument.
3. Not supports callback.
4. Should return `hasMore` for detect end of options list for current search.

### debounceTimeout

Not required. Number. Debounce timeout for `loadOptions` calls. `0` by default.

### additional

Not required. Default `additional` for first request for every search.

### shouldLoadMore

Not required. Function. By default new options will load only after scroll menu to bottom. Arguments:

- scrollHeight
- clientHeight
- scrollTop

Should return boolean.

### reduceOptions

Not required. Function. By default new loaded options are concat with previous. Arguments:

- previous options
- loaded options
- next additional

Should return new options.

### cacheUniqs

Not required. Array. Works as 2nd argument of `useEffect` hook. When one of items changed, `AsyncPaginate` cleans all cached options.

### loadOptionsOnMenuOpen

Not required. Boolean. If `false` options will not load on menu opening.

### selectRef

Ref for take `react-select` instance.

## Example

### offset way

```javascript
import { AsyncPaginate } from 'react-select-async-paginate';

...

/*
 * assuming the API returns something like this:
 *   const json = {
 *     results: [
 *       {
 *         value: 1,
 *         label: 'Audi',
 *       },
 *       {
 *         value: 2,
 *         label: 'Mercedes',
 *       },
 *       {
 *         value: 3,
 *         label: 'BMW',
 *       },
 *     ],
 *     has_more: true,
 *   };
 */

async function loadOptions(search, loadedOptions) {
  const response = await fetch(`/awesome-api-url/?search=${search}&offset=${loadedOptions.length}`);
  const responseJSON = await response.json();

  return {
    options: responseJSON.results,
    hasMore: responseJSON.has_more,
  };
}

<AsyncPaginate
  value={value}
  loadOptions={loadOptions}
  onChange={setValue}
/>
```

### page way

```javascript
import { AsyncPaginate } from 'react-select-async-paginate';

...

async function loadOptions(search, loadedOptions, { page }) {
  const response = await fetch(`/awesome-api-url/?search=${search}&page=${page}`);
  const responseJSON = await response.json();

  return {
    options: responseJSON.results,
    hasMore: responseJSON.has_more,
    additional: {
      page: page + 1,
    },
  };
}

<AsyncPaginate
  value={value}
  loadOptions={loadOptions}
  onChange={setValue}
  additional={{
    page: 1,
  }}
/>
```

## Grouped options

You can use `reduceGroupedOptions` util to group options by `label` key.

```javascript
import { AsyncPaginate, reduceGroupedOptions } from 'react-select-async-paginate';

/*
 * assuming the API returns something like this:
 *   const json = {
 *     options: [
 *       label: 'Cars',
 *       options: [
 *         {
 *           value: 1,
 *           label: 'Audi',
 *         },
 *         {
 *           value: 2,
 *           label: 'Mercedes',
 *         },
 *         {
 *           value: 3,
 *           label: 'BMW',
 *         },
 *       ]
 *     ],
 *     hasMore: true,
 *   };
 */

...

<AsyncPaginate
  {...otherProps}
  reduceOptions={reduceGroupedOptions}
/>
```

## Replacing react-select component

You can use `withAsyncPaginate` HOC.

```javascript
import { withAsyncPaginate } from 'react-select-async-paginate';

...

const CustomAsyncPaginate = withAsyncPaginate(CustomSelect);
```

## Replacing Components

Usage of replacing components is similar with `react-select`, but there is one difference. If you redefine `MenuList` you should wrap it with `wrapMenuList` for workaround of some internal bugs of `react-select`.

```javascript
import { AsyncPaginate, wrapMenuList } from 'react-select-async-paginate';

...

const MenuList = wrapMenuList(CustomMenuList);

<AsyncPaginate
  {...otherProps}
  components={{
    ...otherComponents,
    MenuList,
  }}
/>
```

## Extended usage

If you want construct own component that uses logic of `react-select-async-paginate` inside, you can use next hooks:

- `useAsyncPaginate`
- `useAsyncPaginateBase`
- `useComponents`

```javascript
import {
  useAsyncPaginate,
  useComponents,
} from 'react-select-async-paginate`;

...

const CustomAsyncPaginateComponent = ({
  {
    options,
    defaultOptions,
    additional,
    loadOptionsOnMenuOpen,
    debounceTimeout,
    filterOption,
    reduceOptions,
    shouldLoadMore,

    components: defaultComponents,

    value,
    onChange,
  }
}) => {
  const asyncPaginateProps = useAsyncPaginate({
    options,
    defaultOptions,
    additional,
    loadOptionsOnMenuOpen,
    debounceTimeout,
    filterOption,
    reduceOptions,
    shouldLoadMore,
  });

  const components = useComponents(defaultComponents);

  return (
    <CustomSelect
      {...asyncPaginateProps}
      components={components}
      value={value}
      onChange={onChange}
    />
  );
}
```

`useComponents` provides redefined `MenuList` component by default. If you want redefine it, you should also wrap in with `wrapMenuList`.
