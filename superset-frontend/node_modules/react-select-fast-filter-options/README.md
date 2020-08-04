# react-select-fast-filter-options
Fast `filterOptions` function for `react-select`;
optimized to quickly filter huge options lists.

## Installation

The easiest way to install is using NPM:

```shell
npm install react-select-fast-filter-options --save
```

ES6, CommonJS, and UMD builds are available with each distribution.
Use unpkg to access the UMD build:

```html
<script src="https://unpkg.com/react-select-fast-filter-options/dist/umd/react-select-fast-filter-options.js"></script>
```

## Examples

#### Basic example

Here's how to fast filter with [`react-select`](https://github.com/JedWatson/react-select) or [`react-virtualized-select`](https://github.com/bvaughn/react-virtualized-select):

```js
// Import the Select component from either react-select or react-virtualized-select
import Select from 'react-virtualized-select' // or from 'react-select'

// The search index will need to be recreated if your options array changes.
// This index is powered by js-search: https://github.com/bvaughn/js-search
const filterOptions = createFilterOptions({ options })

// Render your Select, complete with the fast-filter index
function render ({ options }) {
  return (
    <Select
      filterOptions={filterOptions}
      options={options}
      {...otherSelectProps}
    />
  )
}
```

Here's how to fast filter with [`redux`](https://github.com/reactjs/redux), [`react-redux`](https://github.com/reactjs/react-redux), and [`reselect`](https://github.com/reactjs/reselect)

#### Redux example

##### selectors/SearchSelectors.js
```js
// selectors file
import { createSelector } from 'reselect';
import createFilterOptions from 'react-select-fast-filter-options';

// Create a search index optimized to quickly filter options.
// The search index will need to be recreated if your options array changes.
// This index is powered by js-search: https://github.com/bvaughn/js-search
// Reselect will only re-run this if options has changed
export const getIndexedOptions = createSelector(
  state => state.options,
  options => createFilterOptions({ options })
)
```

##### components/Search.js
```js
// Import the Select component from either react-select or react-virtualized-select
import Select from 'react-virtualized-select'; // or from 'react-select'

// Render your Select, complete with the fast-filter index
function render ({ options }) {
  return (
    <Select
      filterOptions={filterOptions}
      options={options}
      {...otherSelectProps}
    />
  )
}

import { connect } from 'react-redux';
import { getIndexedOptions } from 'selectors/SearchSelectors'

const mapStateToProps = (state) => ({
  options: getIndexedOptions(state)
})

export default connect(mapStateToProps)(
  render
)
```

## Configuration Options

By default, `createFilterOptions` returns a filter function configured to match all substrings, in a case-insensitive way, and return results in their original order. However it supports all of the underlying [`js-search`](https://github.com/bvaughn/js-search) configuration options.

The following table shows all supported parameters and their default values:

| Property | Type | Default | Description |
|:---|:---|:---|:---|
| `indexes` | `Array<String>` |  | Optional array of attributes to build search index from; defaults to the `labelKey` attribute. |
| `indexStrategy` | [`IndexStrategy`](https://github.com/bvaughn/js-search/blob/master/source/IndexStrategy/IndexStrategy.js) | [`AllSubstringsIndexStrategy`](https://github.com/bvaughn/js-search/blob/master/source/IndexStrategy/AllSubstringsIndexStrategy.js) | See [js-search docs](https://github.com/bvaughn/js-search) |
| `labelKey` | string | "label" | Option key containing the display text |
| `options` | array | [] | Array of options objects |
| `sanitizer` | [`Sanitizer`](https://github.com/bvaughn/js-search/blob/master/source/Sanitizer/Sanitizer.js) | [`LowerCaseSanitizer`](https://github.com/bvaughn/js-search/blob/master/source/Sanitizer/LowerCaseSanitizer.js) | See [js-search docs](https://github.com/bvaughn/js-search) |
| `searchIndex` | [`SearchIndex`](https://github.com/bvaughn/js-search/blob/master/source/SearchIndex/SearchIndex.js) | [`UnorderedSearchIndex`](https://github.com/bvaughn/js-search/blob/master/source/SearchIndex/UnorderedSearchIndex.js) | See [js-search docs](https://github.com/bvaughn/js-search) |
| `tokenizer` | [`Tokenizer`](https://github.com/bvaughn/js-search/blob/master/source/Tokenizer/Tokenizer.js) | [`SimpleTokenizer`](https://github.com/bvaughn/js-search/blob/master/source/Tokenizer/SimpleTokenizer.js) | See [js-search docs](https://github.com/bvaughn/js-search) |
| `valueKey` | string | "value" | Option key containing the value |

## Advanced Configuration

The default filter configuration mimics `react-search` behavior.
But you can also customize search.
For example:

```js
import {
  CaseSensitiveSanitizer,
  ExactWordIndexStrategy,
  Search,
  SimpleTokenizer,
  StemmingTokenizer,
  TfIdfSearchIndex
} from 'js-search'
import { stemmer } from 'porter-stemmer'
import createFilterOptions from 'react-select-fast-filter-options'

// Default index strategy is built for all substrings.
// In other word "c", "ca", "cat", "a", "at", and "t" all match "cat".
// Override to only allow exact-word matches like so:
const indexStrategy = new ExactWordIndexStrategy()

// Default sanitizer is case-insensitive
// Searches for "foo" will match "Foo".
// Override to be case-sensitive like so:
const sanitizer = new CaseSensitiveSanitizer()

// By default, search results are returned in the order they wre indexed.
// This means that your filtered options will match their unfiltered order.
// More advanced results orderings are possbile.
// For example TF-IDF ranking is an option.
// Learn more at https://github.com/bvaughn/js-search#tf-idf-ranking
const searchIndex = new TfIdfSearchIndex()

// Default tokenizer just splits search text on spaces.
// In other words "the boy" becomes 2 search tokens, "the" and "boy".
// The StemmingTokenizer can be used for fuzzier matching.
// For example, "searching" will match  "search", "searching", and "searched".
// Learn more at https://github.com/bvaughn/js-search#stemming
const tokenizer = new StemmingTokenizer(stemmer, new SimpleTokenizer())

const filterOptions = createFilterOptions({
  indexStrategy,
  options,
  sanitizer,
  searchIndex,
  tokenizer
})
```

In addition to the stemming tokenizer, other tokenizers are available as well, including `StopWordsTokenizer` which removes common words like "a", "and", and "the".
For more information on available configuration options, see [`js-search` documentation](https://github.com/bvaughn/js-search).
