redux-localstorage
==================

Store enhancer that syncs (a subset) of your Redux store state to localstorage.

**NOTE:** Be sure to check out the [1.0-breaking-changes](https://github.com/elgerlambert/redux-localstorage/tree/1.0-breaking-changes) branch (available on npm as `redux-localstorage@rc`). It includes support for flexible storage backends, including (but not limited to) `sessionStorage` and react-natives' `AsyncStorage`.

## Installation
```js
npm install --save redux-localstorage
```

## Usage
```js
import {compose, createStore} from 'redux';
import persistState from 'redux-localstorage'

const enhancer = compose(
  /* [middlewares] */,
  persistState(/*paths, config*/),
)

const store = createStore(/*reducer, [initialState]*/, enhancer)
```

### persistState(paths, config)
#### paths
```js
type paths = Void | String | Array<String>
```
If left `Void`, persistState will sync Redux's complete store state with localStorage. Alternatively you may specify which part(s) of your state should be persisted.

**Note:** Currently no support for nested paths. Only "top-level" paths are supported, i.e. state[path]. If your needs are more complex and you require more control over
which parts of your store's state should be persisted you can define your own strategy through [config.slicer](#configslicer)

#### config
##### config.key
```js
type config.key = String
```
The localStorage key used to store state. The default value is `redux`.

##### config.slicer
```js
type config.slicer = (paths: Any) => (state: Collection) => subset: Collection
```
Config.slicer allows you to define your own function which will be used to determine which parts should be synced with localStorage. It should look something like this:
```js
function myCustomSlicer (paths) {
  return (state) => {
    let subset = {}
    /*Custom logic goes here*/
    return subset
  }
}
```
It is called with the paths argument supplied to persistState. It should return a function that will be called with the store's state, which should return a subset that matches the original shape/structure of the store - it's this subset that'll be persisted.

If, for example, you want to dynamically persist parts of your store state based on a user's preference, defining your own `slicer` allows you to do that. Simply add something along the following lines to your customSlicer function:

```js
paths.forEach((path) => {
  if (state[path].persistToLocalStorage)
    subset[path] = state[path]
}
```

## Immutable Data
If you're using immutable collections or some other custom collection, redux-localstorage exposes a number of functions that can be overridden by providing the following config options. These allow you to specify your own transformations based on your needs. If you're using ordinary javascript Objects, Arrays or primitives, you shouldn't have to concern yourself with these options.

##### config.serialize
```js
type config.serialize = (subset: Collection) => serializedData: String
```
The default serialization strategy is JSON.stringify. Specifying a serialize function as part of your config will override this.
This function receives a single argument (the subset of your store's state about to be persisted) and should return a serialized (i.e. stringified) representation thereof. 

##### config.deserialize
```js
type config.deserialize = (serializedData: String) => subset: Collection
```
The default deserialization strategy is JSON.parse. Specifying a deserialize function as part of your config will override this.
This function receives a single argument (a serialized representation of your persisted state) and should return the data in a format that's expected by your application.

##### config.merge
```js
type config.merge = (initialState: Collection, persistedState: Collection) => finalInitialState: Collection
```
During initialization any persisted state is merged with the initialState passed in as an argument to `createStore`.
The default strategy `extends` the initialState with the persistedState. Override this function if that doesn't work for you. **Note:** this is only required if you want to merge values within an immutable collection. If your values are immutable, but the object that holds them is not, the default strategy should work just fine.
