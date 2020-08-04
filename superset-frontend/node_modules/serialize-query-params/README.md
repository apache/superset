<div align="center">
  <h1>serialize-query-params</h1>
  <p>A library for simplifying encoding and decoding URL query parameters.
  </p>

  <p>
    <a href="https://www.npmjs.com/package/serialize-query-params"><img alt="npm" src="https://img.shields.io/npm/v/serialize-query-params.svg"></a>
    <a href="https://travis-ci.com/pbeshai/serialize-query-params"><img alt="Travis (.com)" src="https://img.shields.io/travis/com/pbeshai/serialize-query-params.svg"></a>
  </p>
<hr />

<a href="#installation">Installation</a> | 
<a href="#api">API</a> |
<a href="https://peterbeshai.com/use-query-params/">useQueryParams</a>

</div>
<hr/>

Used in React with [use-query-params](https://github.com/pbeshai/url-query-params).

### Installation

Using npm:

```
$ npm install --save serialize-query-params
```

### API

- [Param Types](#param-types)
- [decodeQueryParams](#decodequeryparams)
- [encodeQueryParams](#encodequeryparams)
- [updateLocation](#usequeryparam)
- [updateLocationIn](#usequeryparams-1)
- [Type Definitions](https://github.com/pbeshai/serialize-query-params/blob/master/src/types.ts)
- [Serialization Utility Functions](https://github.com/pbeshai/serialize-query-params/blob/master/src/serialize.ts)

For convenience, serialize-query-params exports `parse`, `stringify`, `extract`, and `parseUrl` functions from the [query-string](https://github.com/sindresorhus/query-string) library.


#### Param Types
See [all param definitions here](https://github.com/pbeshai/serialize-query-params/blob/master/src/params.ts). You can define your own parameter types by creating an object with an `encode` and a `decode` function. See the existing definitions for examples.

Note that all nully values will encode and decode as `undefined`.

Examples in this table assume query parameter named `qp`.

| Param | Type | Example Decoded | Example Encoded |
| --- | --- | --- | --- |
| StringParam | string | `'foo'` | `?qp=foo` |
| NumberParam | number | `123` | `?qp=123` |
| ObjectParam | { key: string } | `{ foo: 'bar', baz: 'zzz' }` | `?qp=foo-bar_baz-zzz` |
| ArrayParam | string[] | `['a','b','c']` | `?qp=a&qp=b&qp=c` |
| JsonParam | any | `{ foo: 'bar' }` | `?qp=%7B%22foo%22%3A%22bar%22%7D` |
| DateParam | Date | `Date(2019, 2, 1)` | `?qp=2019-03-01` |
| DateTimeParam | Date | `Date(2019, 2, 1)` | `?qp=2019-02-28T22:00:00.000Z` |
| BooleanParam | boolean | `true` | `?qp=1` |
| NumericObjectParam | { key: number } | `{ foo: 1, bar: 2 }` | `?qp=foo-1_bar-2` |
| DelimitedArrayParam | string[] | `['a','b','c']` | `?qp=a_b_c'` |
| DelimitedNumericArrayParam | number[] | `[1, 2, 3]` | `?qp=1_2_3'` |

**Example with Custom Param**

You can define your own params if the ones shipped with this package don't work for you. There are included [serialization utility functions](https://github.com/pbeshai/serialize-query-params/blob/master/src/serialize.ts) to make this easier, but you can use whatever you like.

```js
import {
  encodeDelimitedArray,
  decodeDelimitedArray
} from 'serialize-query-params';

/** Uses a comma to delimit entries. e.g. ['a', 'b'] => qp?=a,b */
const CommaArrayParam = {
  encode: (array: string[] | null | undefined): string | undefined => 
    encodeDelimitedArray(array, ','),

  decode: (arrayStr: string | string[] | null | undefined): string[] | undefined => 
    decodeDelimitedArray(arrayStr, ',')
};
```

<br/>

#### decodeQueryParams

```js
decodeQueryParams<QPCMap extends QueryParamConfigMap>(
  paramConfigMap: QPCMap,
  encodedQuery: Partial<EncodedValueMap<QPCMap>>
): Partial<DecodedValueMap<QPCMap>>
```

Convert the values in query from strings to their natural types via the
decode functions configured in paramConfigMap. 

**Example**

```js
import {
  stringify,
  decodeQueryParams,
  NumberParam,
} from 'serialize-query-params';

// encode each parameter according to the configuration
const decodedQuery = decodeQueryParams(
  { foo: NumberParam, bar: DelimitedArrayParam },
  { foo: '123', bar: 'a_b' }
);
// produces: { foo: 123, bar: ['a', 'b'] }
```

<br/>


#### encodeQueryParams

```js
encodeQueryParams<QPCMap extends QueryParamConfigMap>(
  paramConfigMap: QPCMap,
  query: Partial<DecodedValueMap<QPCMap>>
): Partial<EncodedValueMap<QPCMap>>
```

Convert the values in query to strings via the encode functions configured
in paramConfigMap. This can be useful for constructing links using decoded
query parameters.

**Example**

```js
import {
  stringify,
  encodeQueryParams,
  NumberParam,
} from 'serialize-query-params';

// encode each parameter according to the configuration
const encodedQuery = encodeQueryParams(
  { foo: NumberParam, bar: DelimitedArrayParam },
  { foo: 123, bar: ['a', 'b'] }
);
// produces: { foo: '123', bar: 'a_b' }

const link = `/?${stringify(encodedQuery)}`;
```

<br/>



#### updateLocation

```js
export function updateLocation(
  encodedQuery: EncodedQueryWithNulls,
  location: Location
): Location {
```

Updates a location object to have a new query string (the `search` field) based 
on the encoded query parameters passed in via `encodedQuery`. Parameters not
specified in `encodedQuery` will be dropped from the URL.

**Example**

```js
import { updateLocation } from 'serialize-query-params';

// location has search: ?foo=123&bar=abc
const newLocation = updateLocation({ foo: '555' }, location);

// newLocation has search: ?foo=555
// note that unspecified query parameters (bar in this case) are not retained.
```

<br/>


#### updateInLocation

```js
export function updateInLocation(
  encodedQueryReplacements: EncodedQueryWithNulls,
  location: Location
): Location {
```

Updates a location object to have a new query string (the `search` field) based 
on the encoded query parameters passed in via `encodedQueryReplacements`. Only
parameters specified in `encodedQueryReplacements` are affected by this update,
all other parameters are retained.

**Example**

```js
import { updateInLocation } from 'serialize-query-params';

// location has search: ?foo=123&bar=abc
const newLocation = updateLocation({ foo: '555' }, location);

// newLocation has search: ?foo=555&bar=abc
// note that unspecified query parameters (bar in this case) are retained.
```

<br/>



### Development

Run the typescript compiler in watch mode:

```
npm run dev
```

