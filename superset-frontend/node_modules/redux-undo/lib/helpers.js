'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseActions = parseActions;
exports.isHistory = isHistory;
exports.distinctState = distinctState;
exports.includeAction = includeAction;
exports.excludeAction = excludeAction;
exports.combineFilters = combineFilters;
exports.groupByActionTypes = groupByActionTypes;
exports.newHistory = newHistory;
// parseActions helper: takes a string (or array)
//                      and makes it an array if it isn't yet
function parseActions(rawActions) {
  var defaultValue = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  if (Array.isArray(rawActions)) {
    return rawActions;
  } else if (typeof rawActions === 'string') {
    return [rawActions];
  }
  return defaultValue;
}

// isHistory helper: check for a valid history object
function isHistory(history) {
  return typeof history.present !== 'undefined' && typeof history.future !== 'undefined' && typeof history.past !== 'undefined' && Array.isArray(history.future) && Array.isArray(history.past);
}

// distinctState helper: deprecated, does nothing in latest beta
/* istanbul ignore next */
function distinctState() {
  console.warn('distinctState is deprecated in beta4 and newer. ' + 'The distinctState behavior is now default, which means only ' + 'actions resulting in a new state are recorded. ' + 'See https://github.com/omnidan/redux-undo#filtering-actions ' + 'for more details.');
  return function () {
    return true;
  };
}

// includeAction helper: whitelist actions to be added to the history
function includeAction(rawActions) {
  var actions = parseActions(rawActions);
  return function (action) {
    return actions.indexOf(action.type) >= 0;
  };
}

// excludeAction helper: blacklist actions from being added to the history
function excludeAction(rawActions) {
  var actions = parseActions(rawActions);
  return function (action) {
    return actions.indexOf(action.type) < 0;
  };
}

// combineFilters helper: combine multiple filters to one
function combineFilters() {
  for (var _len = arguments.length, filters = Array(_len), _key = 0; _key < _len; _key++) {
    filters[_key] = arguments[_key];
  }

  return filters.reduce(function (prev, curr) {
    return function (action, currentState, previousHistory) {
      return prev(action, currentState, previousHistory) && curr(action, currentState, previousHistory);
    };
  }, function () {
    return true;
  });
}

function groupByActionTypes(rawActions) {
  var actions = parseActions(rawActions);
  return function (action) {
    return actions.indexOf(action.type) >= 0 ? action.type : null;
  };
}

function newHistory(past, present, future) {
  var group = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

  return {
    past: past,
    present: present,
    future: future,
    group: group,
    _latestUnfiltered: present,
    index: past.length,
    limit: past.length + future.length + 1
  };
}