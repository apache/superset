<div align="center">
  <h1>useQueryParams</h1>
  <p>A <a href="https://reactjs.org/docs/hooks-intro.html">React Hook</a>, HOC, and Render Props solution for managing state in URL query parameters with easy serialization.
  </p>
  <p>Works with <a href="https://reacttraining.com/react-router/">React Router</a> and <a href="https://reach.tech/router">Reach Router</a> out of the box. TypeScript supported.</p>


  <p>
    <a href="https://www.npmjs.com/package/use-query-params"><img alt="npm" src="https://img.shields.io/npm/v/use-query-params.svg"></a>
  <a href="https://travis-ci.com/pbeshai/use-query-params/"><img alt="Travis (.com)" src="https://img.shields.io/travis/com/pbeshai/use-query-params.svg"></a>

  </p>
<hr />

<a href="#installation">Installation</a> |
<a href="#usage">Usage</a> |
<a href="#examples">Examples</a> |
<a href="#api">API</a> |
<a href="https://peterbeshai.com/use-query-params/">Demo</a>

</div>
<hr/>

When creating apps with easily shareable URLs, you often want to encode state as query parameters, but all query parameters must be encoded as strings. `useQueryParams` allows you to easily encode and decode data of any type as query parameters with smart memoization to prevent creating unnecessary duplicate objects. It uses [serialize-query-params](https://github.com/pbeshai/serialize-query-params).


### Installation

Using npm:

```
$ npm install --save use-query-params
```

Link your routing system (e.g., [React Router example](https://github.com/pbeshai/use-query-params/blob/master/examples/react-router/src/index.tsx), [Reach Router example](https://github.com/pbeshai/use-query-params/blob/master/examples/reach-router/src/index.tsx)):

```js
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import App from './App';

ReactDOM.render(
  <Router>
    <QueryParamProvider ReactRouterRoute={Route}>
      <App />
    </QueryParamProvider>
  </Router>,
  document.getElementById('root')
);
```


### Usage

Add the hook to your component. There are two options: `useQueryParam`:

```js
import * as React from 'react';
import { useQueryParam, NumberParam, StringParam } from 'use-query-params';

const UseQueryParamExample = () => {
  // something like: ?x=123&foo=bar in the URL
  const [num, setNum] = useQueryParam('x', NumberParam);
  const [foo, setFoo] = useQueryParam('foo', StringParam);

  return (
    <div>
      <h1>num is {num}</h1>
      <button onClick={() => setNum(Math.random())}>Change</button>
      <h1>foo is {foo}</h1>
      <button onClick={() => setFoo(`str${Math.random()}`)}>Change</button>
    </div>
  );
};

export default UseQueryParamExample;
```

Or `useQueryParams`:

```js
import * as React from 'react';
import {
  useQueryParams,
  StringParam,
  NumberParam,
  ArrayParam,
} from 'use-query-params';

const UseQueryParamsExample = () => {
  // something like: ?x=123&q=foo&filters=a&filters=b&filters=c in the URL
  const [query, setQuery] = useQueryParams({
    x: NumberParam,
    q: StringParam,
    filters: ArrayParam,
  });
  const { x: num, q: searchQuery, filters = [] } = query;

  return (
    <div>
      <h1>num is {num}</h1>
      <button onClick={() => setQuery({ x: Math.random() })}>Change</button>
      <h1>searchQuery is {searchQuery}</h1>
      <h1>There are {filters.length} filters active.</h1>
      <button
        onClick={() =>
          setQuery(
            { x: Math.random(), filters: [...filters, 'foo'], q: 'bar' },
            'push'
          )
        }
      >
        Change All
      </button>
    </div>
  );
};

export default UseQueryParamsExample;
```

Or with the higher-order component (HOC) `withQueryParams`:

```js
import * as React from 'react';
import {
  withQueryParams,
  StringParam,
  NumberParam,
  ArrayParam,
} from 'use-query-params';

const WithQueryParamsExample = ({ query, setQuery }: any) => {
  const { x: num, q: searchQuery, filters = [] } = query;

  return (
    <div>
      <h1>num is {num}</h1>
      <button onClick={() => setQuery({ x: Math.random() })}>Change</button>
      <h1>searchQuery is {searchQuery}</h1>
      <h1>There are {filters.length} filters active.</h1>
      <button
        onClick={() =>
          setQuery(
            { x: Math.random(), filters: [...filters, 'foo'], q: 'bar' },
            'push'
          )
        }
      >
        Change All
      </button>
    </div>
  );
};

export default withQueryParams({
  x: NumberParam,
  q: StringParam,
  filters: ArrayParam,
}, WithQueryParamsExample);
```

Or with render props via `<QueryParams>`:

```js
import * as React from 'react';
import {
  QueryParams,
  StringParam,
  NumberParam,
  ArrayParam,
} from 'use-query-params';

const RenderPropsExample = () => {
  const queryConfig = {
    x: NumberParam,
    q: StringParam,
    filters: ArrayParam,
  };
  return (
    <div>
      <QueryParams config={queryConfig}>
        {({ query, setQuery }) => {
          const { x: num, q: searchQuery, filters = [] } = query;
          return (
            <>
              <h1>num is {num}</h1>
              <button onClick={() => setQuery({ x: Math.random() })}>
                Change
              </button>
              <h1>searchQuery is {searchQuery}</h1>
              <h1>There are {filters.length} filters active.</h1>
              <button
                onClick={() =>
                  setQuery(
                    {
                      x: Math.random(),
                      filters: [...filters, 'foo'],
                      q: 'bar',
                    },
                    'push'
                  )
                }
              >
                Change All
              </button>
            </>
          );
        }}
      </QueryParams>
    </div>
  );
};

export default RenderPropsExample;
```


### Examples

A few basic [examples](https://github.com/pbeshai/use-query-params/tree/master/examples) have been put together to demonstrate how `useQueryParams` works with different routing systems.

- [React Router Example](https://github.com/pbeshai/use-query-params/tree/master/examples/react-router)
- [Reach Router Example](https://github.com/pbeshai/use-query-params/tree/master/examples/reach-router)

### API

- [UrlUpdateType](#urlupdatetype)
- [Param Types](#param-types)
- [useQueryParam](#usequeryparam)
- [useQueryParams](#usequeryparams-1)
- [withQueryParams](#withqueryparams)
- [QueryParams](#queryparams)
- [encodeQueryParams](#encodequeryparams)
- [QueryParamProvider](#queryparamprovider)
- [Type Definitions](https://github.com/pbeshai/use-query-params/blob/master/src/types.ts) and from [serialize-query-params](https://github.com/pbeshai/serialize-query-params/blob/master/src/types.ts).
- [Serialization Utility Functions](https://github.com/pbeshai/serialize-query-params/blob/master/src/serialize.ts)

For convenience, use-query-params exports all of the [serialize-query-params](https://github.com/pbeshai/serialize-query-params) library. This includes most functions from [query-string](https://github.com/sindresorhus/query-string), which is used internally.

#### UrlUpdateType

The `UrlUpdateType` is a string type definings the different methods for updating the URL:

 - `'replaceIn'`: Replace just a single parameter, leaving the rest as is
 - `'replace'`: Replace all parameters with just those specified
 - `'pushIn'`: Push just a single parameter, leaving the rest as is (back button works)
 - `'push'`: Push all parameters with just those specified (back button works)


#### Param Types
See [all param definitions from serialize-query-params here](https://github.com/pbeshai/serialize-query-params/blob/master/src/params.ts). You can define your own parameter types by creating an object with an `encode` and a `decode` function. See the existing definitions for examples.

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
| BooleanParam | boolean | `true` | `?qp=1` |
| NumericObjectParam | { key: number } | `{ foo: 1, bar: 2 }` | `?qp=foo-1_bar-2` |
| DelimitedArrayParam | string[] | `['a','b','c']` | `?qp=a_b_c'` |
| DelimitedNumericArrayParam | number[] | `[1, 2, 3]` | `?qp=1_2_3'` |

**Example**

```js
import { ArrayParam, useQueryParam, useQueryParams } from 'use-query-params';

// typically used with the hooks:
const [foo, setFoo] = useQueryParam('foo', ArrayParam);
// - OR -
const [query, setQuery] = useQueryParams({ foo: ArrayParam });
```

**Example with Custom Param**

You can define your own params if the ones shipped with this package don't work for you. There are included [serialization utility functions](https://github.com/pbeshai/use-query-params/blob/master/src/serialize.ts) to make this easier, but you can use whatever you like.

```js
import {
  encodeDelimitedArray,
  decodeDelimitedArray
} from 'use-query-params';

/** Uses a comma to delimit entries. e.g. ['a', 'b'] => qp?=a,b */
const CommaArrayParam = {
  encode: (array: string[] | null | undefined) =>
    encodeDelimitedArray(array, ','),

  decode: (arrayStr: string | string[] | null | undefined) =>
    decodeDelimitedArray(arrayStr, ',')
};
```

<br/>


#### useQueryParam

```js
useQueryParam<T>(name: string, paramConfig: QueryParamConfig<T>, rawQuery?: ParsedQuery):
  [T | undefined, (newValue: T, updateType?: UrlUpdateType) => void]
```

Given a query param name and query parameter configuration `{ encode, decode }`
return the decoded value and a setter for updating it.

The setter takes two arguments `(newValue, updateType)` where updateType
is one of `'replace' | 'replaceIn' | 'push' | 'pushIn'`, defaulting to
`'replaceIn'`.

You may optionally pass in a rawQuery object, otherwise the query is derived
from the location available in the QueryParamContext.

**Example**

```js
import { useQueryParam, NumberParam } from 'use-query-params';

// reads query parameter `foo` from the URL and stores its decoded numeric value
const [foo, setFoo] = useQueryParam('foo', NumberParam);
setFoo(500);
setFoo(123, 'push');
```

<br/>

#### useQueryParams

```js
useQueryParams<QPCMap extends QueryParamConfigMap>(paramConfigMap: QPCMap):
  [DecodedValueMap<QPCMap>, SetQuery<QPCMap>]
```

Given a query parameter configuration (mapping query param name to `{ encode, decode }`),
return an object with the decoded values and a setter for updating them.

The setter takes two arguments `(newQuery, updateType)` where updateType
is one of `'replace' | 'replaceIn' | 'push' | 'pushIn'`, defaulting to
`'replaceIn'`.

**Example**

```js
import { useQueryParams, StringParam, NumberParam } from 'use-query-params';

// reads query parameters `foo` and `bar` from the URL and stores their decoded values
const [query, setQuery] = useQueryParams({ foo: NumberParam, bar: StringParam });
setQuery({ foo: 500 })
setQuery({ foo: 123, bar: 'zzz' }, 'push');
```

**Example with Custom Parameter Type**
Parameter types are just objects with `{ encode, decode }` functions. You can
provide your own if the provided ones don't work for your use case.

```js
import { useQueryParams } from 'use-query-params';

const MyParam = {
  encode(value) {
    return `${value * 10000}`;
  },

  decode(strValue) {
    return parseFloat(strValue) / 10000;
  }
}

// ?foo=10000 -> query = { foo: 1 }
const [query, setQuery] = useQueryParams({ foo: MyParam });

// goes to ?foo=99000
setQuery({ foo: 99 })
```

<br/>


#### withQueryParams

```js
withQueryParams<QPCMap extends QueryParamConfigMap, P extends InjectedQueryProps<QPCMap>>
  (paramConfigMap: QPCMap, WrappedComponent: React.ComponentType<P>):
      React.FC<Diff<P, InjectedQueryProps<QPCMap>>>
```

Given a query parameter configuration (mapping query param name to `{ encode, decode }`) and
a component, inject the props `query` and `setQuery` into the component based on the config.

The setter takes two arguments `(newQuery, updateType)` where updateType
is one of `'replace' | 'replaceIn' | 'push' | 'pushIn'`, defaulting to
`'replaceIn'`.

**Example**

```js
import { withQueryParams, StringParam, NumberParam } from 'use-query-params';

const MyComponent = ({ query, setQuery, ...others }) => {
  const { foo, bar } = query;
  return <div>foo = {foo}, bar = {bar}</div>
}

// reads query parameters `foo` and `bar` from the URL and stores their decoded values
export default withQueryParams({ foo: NumberParam, bar: StringParam }, MyComponent);
```

<br/>



#### QueryParams

```js
<QueryParams config={{ foo: NumberParam }}>
  {({ query, setQuery }) => <div>foo = {query.foo}</div>}
</QueryParams>
```

Given a query parameter configuration (mapping query param name to `{ encode, decode }`) and
a component, provide render props `query` and `setQuery` based on the config.

The setter takes two arguments `(newQuery, updateType)` where updateType
is one of `'replace' | 'replaceIn' | 'push' | 'pushIn'`, defaulting to
`'replaceIn'`.


<br/>


#### encodeQueryParams

```js
encodeQueryParams<QPCMap extends QueryParamConfigMap>(
  paramConfigMap: QPCMap,
  query: Partial<DecodedValueMap<QPCMap>>
): EncodedQueryWithNulls
```

Convert the values in query to strings via the encode functions configured
in paramConfigMap. This can be useful for constructing links using decoded
query parameters.

**Example**

```js
import { encodeQueryParams, NumberParam, stringify } from 'use-query-params';

// encode each parameter according to the configuration
const encodedQuery = encodeQueryParams({ foo: NumberParam }, { foo });
const link = `/?${stringify(encodedQuery)}`;
```

<br/>

#### QueryParamProvider

```js
// Use one of these:
<QueryParamProvider ReactRouterRoute={Route}><App /></QueryParamProvider>

<QueryParamProvider reachHistory={globalHisory}><App /></QueryParamProvider>

<QueryParamProvider history={myCustomHistory}><App /></QueryParamProvider>
```

The **QueryParamProvider** component links your routing library's history to
the **useQueryParams** hook. It is needed for the hook to be able to update
the URL and have the rest of your app know about it.

See the tests or these examples for how to use it:

- [React Router Example](https://github.com/pbeshai/use-query-params/tree/master/examples/react-router)
- [Reach Router Example](https://github.com/pbeshai/use-query-params/tree/master/examples/reach-router)


**Example (Reach Router)**

```js
import React from 'react';
import ReactDOM from 'react-dom';
import { globalHistory, Router } from '@reach/router';
import { QueryParamProvider } from 'use-query-params';
import App from './App';

ReactDOM.render(
  <QueryParamProvider reachHistory={globalHistory}>
    <Router>
      <App default />
    </Router>
  </QueryParamProvider>,
  document.getElementById('root')
);
```

<br/>

### Development

Run the typescript compiler in watch mode:

```
npm run dev
```


You can run an example app:

```
npm link
cd examples/react-router
npm install
npm link use-query-params
npm start
```
