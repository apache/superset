# redux undo/redo

[![NPM version (>=0.4)](https://img.shields.io/npm/v/redux-undo.svg?style=flat-square)](https://www.npmjs.com/package/redux-undo) [![NPM Downloads](https://img.shields.io/npm/dm/redux-undo.svg?style=flat-square)](https://www.npmjs.com/package/redux-undo) [![Coverage Status](https://img.shields.io/coveralls/omnidan/redux-undo.svg?style=flat-square)](https://coveralls.io/r/omnidan/redux-undo) [![Dependencies](https://img.shields.io/david/omnidan/redux-undo.svg?style=flat-square)](https://david-dm.org/omnidan/redux-undo) [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://raw.githubusercontent.com/omnidan/redux-undo/master/LICENSE.md)

_simple undo/redo functionality for redux state containers_

[![https://i.imgur.com/M2KR4uo.gif](https://i.imgur.com/M2KR4uo.gif)](https://github.com/omnidan/redux-undo-boilerplate)

**Protip:** Check out the [todos-with-undo example](https://github.com/omnidan/redux-undo/tree/master/examples/todos-with-undo) or the [redux-undo-boilerplate](https://github.com/omnidan/redux-undo-boilerplate) to quickly get started with `redux-undo`.

**Switching from 0.x to 1.0 (beta):** Make sure to update your programs to the [latest History API](#history-api).

---

**This README is about the new 1.0-beta branch of redux-undo, if you are using
or plan on using 0.6, check out [the `0.6` branch](https://github.com/omnidan/redux-undo/tree/0.6)**

---

## Note on 1.0.0-beta7

If you use Redux Undo in CommonJS environment, **don’t forget to add `.default` to your import**.

```diff
- var ReduxUndo = require('redux-undo')
+ var ReduxUndo = require('redux-undo').default
```

If your environment support es modules just go by:

```js
import ReduxUndo from 'redux-undo';
```

We are also supporting UMD build:

```js
var ReduxUndo = window.ReduxUndo.default;
```

**once again `.default` is required.**

## Installation

```
npm install --save redux-undo@beta
```


## API

```js
import undoable from 'redux-undo';
undoable(reducer)
undoable(reducer, config)
```


## Making your reducers undoable

`redux-undo` is a reducer enhancer (higher-order reducer), it provides the `undoable` function, which
takes an existing reducer and a configuration object and enhances your existing
reducer with undo functionality.

**Note:** If you were accessing `state.counter` before, you have to access
`state.counter.present` after wrapping your reducer with `undoable`.

To install, firstly import `redux-undo`:

```js
// Redux utility functions
import { combineReducers } from 'redux';
// redux-undo higher-order reducer
import undoable from 'redux-undo';
```

Then, add `undoable` to your reducer(s) like this:

```js
combineReducers({
  counter: undoable(counter)
})
```

A [configuration](#configuration) can be passed like this:

```js
combineReducers({
  counter: undoable(counter, {
    limit: 10 // set a limit for the history
  })
})
```


## History API

Wrapping your reducer with `undoable` makes the state look like this:

```js
{
  past: [...pastStatesHere...],
  present: {...currentStateHere...},
  future: [...futureStatesHere...]
}
```

Now you can get your current state like this: `state.present`

And you can access all past states (e.g. to show a history) like this: `state.past`


## Undo/Redo Actions

Firstly, import the undo/redo action creators:

```js
import { ActionCreators } from 'redux-undo';
```

Then, you can use `store.dispatch()` and the undo/redo action creators to
perform undo/redo operations on your state:

```js
store.dispatch(ActionCreators.undo()) // undo the last action
store.dispatch(ActionCreators.redo()) // redo the last action

store.dispatch(ActionCreators.jump(-2)) // undo 2 steps
store.dispatch(ActionCreators.jump(5)) // redo 5 steps

store.dispatch(ActionCreators.jumpToPast(index)) // jump to requested index in the past[] array
store.dispatch(ActionCreators.jumpToFuture(index)) // jump to requested index in the future[] array

store.dispatch(ActionCreators.clearHistory()) // [beta only] Remove all items from past[] and future[] arrays
```


## Configuration

A configuration object can be passed to `undoable()` like this (values shown
are default values):

```js
undoable(reducer, {
  limit: false, // set to a number to turn on a limit for the history

  filter: () => true, // see `Filtering Actions`
  groupBy: () => null, // see `Grouping Actions`

  undoType: ActionTypes.UNDO, // define a custom action type for this undo action
  redoType: ActionTypes.REDO, // define a custom action type for this redo action

  jumpType: ActionTypes.JUMP, // define custom action type for this jump action

  jumpToPastType: ActionTypes.JUMP_TO_PAST, // define custom action type for this jumpToPast action
  jumpToFutureType: ActionTypes.JUMP_TO_FUTURE, // define custom action type for this jumpToFuture action

  clearHistoryType: ActionTypes.CLEAR_HISTORY, // [beta only] define custom action type for this clearHistory action
  // you can also pass an array of strings to define several action types that would clear the history
  // beware: those actions will not be passed down to the wrapped reducers

  initTypes: ['@@redux-undo/INIT'], // history will be (re)set upon init action type
  // beware: those actions will not be passed down to the wrapped reducers

  debug: false, // set to `true` to turn on debugging
  ignoreInitialState: false, // prevent user from undoing to the beginning, ex: client-side hydration

  neverSkipReducer: false, // prevent undoable from skipping the reducer on undo/redo and clearHistoryType actions
  syncFilter: false // set to `true` to synchronize the `_latestUnfiltered` state with `present` when an excluded action is dispatched
})
```

**Note:** If you want to use just the `initTypes` functionality, but not import
the whole redux-undo library, use [redux-recycle](https://github.com/omnidan/redux-recycle)!

### Initial State and History

You can use your redux store to set an initial history for your undoable reducers:

```js

import { createStore } from 'redux';

const initialHistory = {
  past: [0, 1, 2, 3],
  present: 4,
  future: [5, 6, 7]
}

const store = createStore(undoable(counter), initialHistory);

```

Or just set the current state like you're used to with Redux. Redux-undo will create the history for you:

```js

import { createStore } from 'redux';

const store = createStore(undoable(counter), {foo: 'bar'});

// will make the state look like this:
{
  past: [],
  present: {foo: 'bar'},
  future: []
}

```

### Grouping Actions

If you want to group your actions together into single undo/redo steps, you
can add a `groupBy` function to `undoable`. `redux-undo` provides
`groupByActionTypes` as a basic `groupBy` function:

```js
import undoable, { groupByActionTypes } from 'redux-undo';

undoable(reducer, { groupBy: groupByActionTypes(SOME_ACTION) })
// or with arrays
undoable(reducer, { groupBy: groupByActionTypes([SOME_ACTION]) })
```

In these cases, consecutive `SOME_ACTION` actions will be considered a single
step in the undo/redo history.

#### Custom `groupBy` Function

If you want to implement custom grouping behaviour, pass in your own function
with the signature `(action, currentState, previousHistory)`. If the return
value is not `null`, then the new state will be grouped by that return value.
If the next state is grouped into the same group as the previous state, then
the two states will be grouped together in one step.

If the return value is `null`, then `redux-undo` will not group the next state
with the previous state.

The `groupByActionTypes` function essentially returns the following:
* If a grouped action type (`SOME_ACTION`), the action type of the action (`SOME_ACTION`).
* If not a grouped action type (any other action type), `null`.

When `groupBy` groups a state change, the associated `group` will be saved
alongside `past`, `present`, and `future` so that it may be referenced by the
next state change.

After an undo/redo/jump occurs, the current group gets reset to `null` so that
the undo/redo history is remembered.

### Filtering Actions

If you don't want to include every action in the undo/redo history, you can add
a `filter` function to `undoable`. This is useful for, for example, excluding
actions that were not triggered by the user.

`redux-undo` provides you with the `includeAction` and `excludeAction` helpers
for basic filtering. They should be imported like this:

```js
import undoable, { includeAction, excludeAction } from 'redux-undo';
```

Now you can use the helper functions:

```js
undoable(reducer, { filter: includeAction(SOME_ACTION) })
undoable(reducer, { filter: excludeAction(SOME_ACTION) })

// they even support Arrays:

undoable(reducer, { filter: includeAction([SOME_ACTION, SOME_OTHER_ACTION]) })
undoable(reducer, { filter: excludeAction([SOME_ACTION, SOME_OTHER_ACTION]) })
```

**Note:** Since [`beta4`](https://github.com/omnidan/redux-undo/releases/tag/beta4),
          only actions resulting in a new state are recorded. This means the
          (now deprecated) `distinctState()` filter is auto-applied.

#### Custom Filters

If you want to create your own filter, pass in a function with the signature
`(action, currentState, previousHistory)`. For example:

```js
undoable(reducer, {
  filter: function filterActions(action, currentState, previousHistory) {
    return action.type === SOME_ACTION; // only add to history if action is SOME_ACTION
  }
})

// The entire `history` state is available to your filter, so you can make
// decisions based on past or future states:

undoable(reducer, {
  filter: function filterState(action, currentState, previousHistory) {
    let { past, present, future } = previousHistory;
    return future.length === 0; // only add to history if future is empty
  }
})
```

#### Combining Filters

You can also use our helper to combine filters.

```js
import undoable, {combineFilters} from 'redux-undo'

function isActionSelfExcluded(action) {
  return action.wouldLikeToBeInHistory
}

function areWeRecording(action, state) {
  return state.recording
}

undoable(reducer, {
  filter: combineFilters(isActionSelfExcluded, areWeRecording)
})
```

### Ignoring Actions

When implementing a filter function, it only prevents the old state from being
stored in the history. **`filter` does not prevent the present state from being
updated.**

If you want to ignore an action completely, as in, not even update the present
state, you can make use of [redux-ignore](https://github.com/omnidan/redux-ignore).

It can be used like this:

```js
import { ignoreActions } from 'redux-ignore'

ignoreActions(
  undoable(reducer),
  [IGNORED_ACTION, ANOTHER_IGNORED_ACTION]
)

// or define your own function:

ignoreActions(
  undoable(reducer),
  (action) => action.type === SOME_ACTION // only add to history if action is SOME_ACTION
)
```


## What is this magic? How does it work?

Have a read of the [Implementing Undo History recipe](http://redux.js.org/docs/recipes/ImplementingUndoHistory.html) in the Redux documents, which explains in detail how redux-undo works.


## Gitter Chat / Support

If you have a question or just want to discuss something with other redux-undo users/maintainers, [chat with the community on gitter.im/omnidan/redux-undo](https://gitter.im/omnidan/redux-undo)

## License

MIT, see `LICENSE.md` for more information.
