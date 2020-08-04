'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getValuesForKey = getValuesForKey;
exports.searchStrings = searchStrings;
exports.createFilter = createFilter;

var _fuse = require('fuse.js');

var _fuse2 = _interopRequireDefault(_fuse);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function flatten(array) {
  return array.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
  }, []);
}

function getValuesForKey(key, item) {
  var keys = key.split('.');
  var results = [item];
  keys.forEach(function (_key) {
    var tmp = [];
    results.forEach(function (result) {
      if (result) {
        if (result instanceof Array) {
          var index = parseInt(_key, 10);
          if (!isNaN(index)) {
            return tmp.push(result[index]);
          }
          result.forEach(function (res) {
            tmp.push(res[_key]);
          });
        } else if (result && typeof result.get === 'function') {
          tmp.push(result.get(_key));
        } else {
          tmp.push(result[_key]);
        }
      }
    });

    results = tmp;
  });

  // Support arrays and Immutable lists.
  results = results.map(function (r) {
    return r && r.push && r.toArray ? r.toArray() : r;
  });
  results = flatten(results);

  return results.filter(function (r) {
    return typeof r === 'string' || typeof r === 'number';
  });
}

function searchStrings(strings, term) {
  var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
      caseSensitive = _ref.caseSensitive,
      fuzzy = _ref.fuzzy,
      sortResults = _ref.sortResults,
      exactMatch = _ref.exactMatch;

  strings = strings.map(function (e) {
    return e.toString();
  });

  try {
    if (fuzzy) {
      if (typeof strings.toJS === 'function') {
        strings = strings.toJS();
      }
      var fuse = new _fuse2.default(strings.map(function (s) {
        return { id: s };
      }), { keys: ['id'], id: 'id', caseSensitive: caseSensitive, shouldSort: sortResults });
      return fuse.search(term).length;
    }
    return strings.some(function (value) {
      try {
        if (!caseSensitive) {
          value = value.toLowerCase();
        }
        if (exactMatch) {
          term = new RegExp('^' + term + '$', 'i');
        }
        if (value && value.search(term) !== -1) {
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    });
  } catch (e) {
    return false;
  }
}

function createFilter(term, keys) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  return function (item) {
    if (term === '') {
      return true;
    }

    if (!options.caseSensitive) {
      term = term.toLowerCase();
    }

    var terms = term.split(' ');

    if (!keys) {
      return terms.every(function (term) {
        return searchStrings([item], term, options);
      });
    }

    if (typeof keys === 'string') {
      keys = [keys];
    }

    return terms.every(function (term) {
      // allow search in specific fields with the syntax `field:search`
      var currentKeys = void 0;
      if (term.indexOf(':') !== -1) {
        var searchedField = term.split(':')[0];
        term = term.split(':')[1];
        currentKeys = keys.filter(function (key) {
          return key.toLowerCase().indexOf(searchedField) > -1;
        });
      } else {
        currentKeys = keys;
      }

      return currentKeys.some(function (key) {
        var values = getValuesForKey(key, item);
        return searchStrings(values, term, options);
      });
    });
  };
}