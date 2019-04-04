'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = undoable;

var _debug = require('./debug');

var debug = _interopRequireWildcard(_debug);

var _actions = require('./actions');

var _helpers = require('./helpers');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

// createHistory
function createHistory(state, ignoreInitialState) {
  // ignoreInitialState essentially prevents the user from undoing to the
  // beginning, in the case that the undoable reducer handles initialization
  // in a way that can't be redone simply
  var history = (0, _helpers.newHistory)([], state, []);
  if (ignoreInitialState) {
    history._latestUnfiltered = null;
  }
  return history;
}

// lengthWithoutFuture: get length of history
function lengthWithoutFuture(history) {
  return history.past.length + 1;
}

// insert: insert `state` into history, which means adding the current state
//         into `past`, setting the new `state` as `present` and erasing
//         the `future`.
function insert(history, state, limit, group) {
  debug.log('inserting', state);
  debug.log('new free: ', limit - lengthWithoutFuture(history));

  var past = history.past,
      _latestUnfiltered = history._latestUnfiltered;

  var historyOverflow = limit && lengthWithoutFuture(history) >= limit;

  var pastSliced = past.slice(historyOverflow ? 1 : 0);
  var newPast = _latestUnfiltered != null ? [].concat(_toConsumableArray(pastSliced), [_latestUnfiltered]) : pastSliced;

  return (0, _helpers.newHistory)(newPast, state, [], group);
}

// jumpToFuture: jump to requested index in future history
function jumpToFuture(history, index) {
  if (index < 0 || index >= history.future.length) return history;

  var past = history.past,
      future = history.future,
      _latestUnfiltered = history._latestUnfiltered;


  var newPast = [].concat(_toConsumableArray(past), [_latestUnfiltered], _toConsumableArray(future.slice(0, index)));
  var newPresent = future[index];
  var newFuture = future.slice(index + 1);

  return (0, _helpers.newHistory)(newPast, newPresent, newFuture);
}

// jumpToPast: jump to requested index in past history
function jumpToPast(history, index) {
  if (index < 0 || index >= history.past.length) return history;

  var past = history.past,
      future = history.future,
      _latestUnfiltered = history._latestUnfiltered;


  var newPast = past.slice(0, index);
  var newFuture = [].concat(_toConsumableArray(past.slice(index + 1)), [_latestUnfiltered], _toConsumableArray(future));
  var newPresent = past[index];

  return (0, _helpers.newHistory)(newPast, newPresent, newFuture);
}

// jump: jump n steps in the past or forward
function jump(history, n) {
  if (n > 0) return jumpToFuture(history, n - 1);
  if (n < 0) return jumpToPast(history, history.past.length + n);
  return history;
}

// helper to dynamically match in the reducer's switch-case
function actionTypeAmongClearHistoryType(actionType, clearHistoryType) {
  return clearHistoryType.indexOf(actionType) > -1 ? actionType : !actionType;
}

// redux-undo higher order reducer
function undoable(reducer) {
  var rawConfig = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  debug.set(rawConfig.debug);

  var config = {
    initTypes: (0, _helpers.parseActions)(rawConfig.initTypes, ['@@redux-undo/INIT']),
    limit: rawConfig.limit,
    filter: rawConfig.filter || function () {
      return true;
    },
    groupBy: rawConfig.groupBy || function () {
      return null;
    },
    undoType: rawConfig.undoType || _actions.ActionTypes.UNDO,
    redoType: rawConfig.redoType || _actions.ActionTypes.REDO,
    jumpToPastType: rawConfig.jumpToPastType || _actions.ActionTypes.JUMP_TO_PAST,
    jumpToFutureType: rawConfig.jumpToFutureType || _actions.ActionTypes.JUMP_TO_FUTURE,
    jumpType: rawConfig.jumpType || _actions.ActionTypes.JUMP,
    clearHistoryType: Array.isArray(rawConfig.clearHistoryType) ? rawConfig.clearHistoryType : [rawConfig.clearHistoryType || _actions.ActionTypes.CLEAR_HISTORY],
    neverSkipReducer: rawConfig.neverSkipReducer || false,
    ignoreInitialState: rawConfig.ignoreInitialState || false,
    syncFilter: rawConfig.syncFilter || false
  };

  var initialState = config.history;
  return function () {
    for (var _len = arguments.length, slices = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      slices[_key - 2] = arguments[_key];
    }

    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : initialState;
    var action = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    debug.start(action, state);

    var history = state;
    if (!initialState) {
      debug.log('history is uninitialized');

      if (state === undefined) {
        var clearHistoryAction = { type: _actions.ActionTypes.CLEAR_HISTORY };
        var start = reducer.apply(undefined, [state, clearHistoryAction].concat(slices));

        history = createHistory(start, config.ignoreInitialState);

        debug.log('do not set initialState on probe actions');
      } else if ((0, _helpers.isHistory)(state)) {
        history = initialState = config.ignoreInitialState ? state : (0, _helpers.newHistory)(state.past, state.present, state.future);
        debug.log('initialHistory initialized: initialState is a history', initialState);
      } else {
        history = initialState = createHistory(state, config.ignoreInitialState);
        debug.log('initialHistory initialized: initialState is not a history', initialState);
      }
    }

    var skipReducer = function skipReducer(res) {
      return config.neverSkipReducer ? _extends({}, res, {
        present: reducer.apply(undefined, [res.present, action].concat(slices))
      }) : res;
    };

    var res = void 0;
    switch (action.type) {
      case undefined:
        return history;

      case config.undoType:
        res = jump(history, -1);
        debug.log('perform undo');
        debug.end(res);
        return skipReducer(res);

      case config.redoType:
        res = jump(history, 1);
        debug.log('perform redo');
        debug.end(res);
        return skipReducer(res);

      case config.jumpToPastType:
        res = jumpToPast(history, action.index);
        debug.log('perform jumpToPast to ' + action.index);
        debug.end(res);
        return skipReducer(res);

      case config.jumpToFutureType:
        res = jumpToFuture(history, action.index);
        debug.log('perform jumpToFuture to ' + action.index);
        debug.end(res);
        return skipReducer(res);

      case config.jumpType:
        res = jump(history, action.index);
        debug.log('perform jump to ' + action.index);
        debug.end(res);
        return skipReducer(res);

      case actionTypeAmongClearHistoryType(action.type, config.clearHistoryType):
        res = createHistory(history.present);
        debug.log('perform clearHistory');
        debug.end(res);
        return skipReducer(res);

      default:
        res = reducer.apply(undefined, [history.present, action].concat(slices));

        if (config.initTypes.some(function (actionType) {
          return actionType === action.type;
        })) {
          debug.log('reset history due to init action');
          debug.end(initialState);
          return initialState;
        }

        if (history._latestUnfiltered === res) {
          // Don't handle this action. Do not call debug.end here,
          // because this action should not produce side effects to the console
          return history;
        }

        var filtered = typeof config.filter === 'function' && !config.filter(action, res, history);
        var group = config.groupBy(action, res, history);

        if (filtered) {
          // if filtering an action, merely update the present
          var filteredState = (0, _helpers.newHistory)(history.past, res, history.future, history.group);
          if (!config.syncFilter) {
            filteredState._latestUnfiltered = history._latestUnfiltered;
          }
          debug.log('filter ignored action, not storing it in past');
          debug.end(filteredState);
          return filteredState;
        } else if (group != null && group === history.group) {
          var groupedState = (0, _helpers.newHistory)(history.past, res, history.future, history.group);
          debug.log('groupBy grouped the action with the previous action');
          debug.end(groupedState);
          return groupedState;
        } else {
          // If the action wasn't filtered, insert normally
          history = insert(history, res, config.limit, group);

          debug.log('inserted new state into history');
          debug.end(history);
          return history;
        }
    }
  };
}
module.exports = exports['default'];