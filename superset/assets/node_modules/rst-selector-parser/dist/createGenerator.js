'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
// @flow

/*:: import type {
  CombinatorTokenType,
  SelectorTokenType
} from './types';*/


var escapeValue = function escapeValue(value /*: string*/) /*: string*/ {
  return JSON.stringify(value);
};

var renderSelector = function renderSelector(selectorToken /*: SelectorTokenType*/) {
  var tokens = selectorToken.body;
  var parts = [];

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = tokens[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var token = _step.value;

      var part = void 0;

      if (token.type === 'universalSelector') {
        part = '*';
      } else if (token.type === 'typeSelector') {
        part = token.name;
      } else if (token.type === 'idSelector') {
        part = '#' + token.name;
      } else if (token.type === 'classSelector') {
        part = '.' + token.name;
      } else if (token.type === 'attributePresenceSelector') {
        part = '[' + token.name + ']';
      } else if (token.type === 'attributeValueSelector') {
        part = '[' + token.name + token.operator + escapeValue(token.value) + ']';
      } else if (token.type === 'pseudoClassSelector') {
        part = ':' + token.name;

        if (token.parameters.length) {
          part += '(' + token.parameters.map(escapeValue).join(', ') + ')';
        }
      } else if (token.type === 'pseudoElementSelector') {
        part = '::' + token.name;
      } else {
        throw new Error('Unknown token.');
      }

      parts.push(part);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return parts.join('');
};

exports.default = function () {
  var generate = function generate(tokens /*: Array<SelectorTokenType | CombinatorTokenType>*/) /*: string*/ {
    /**
     * @todo Think of a better name. This array contains selectors or combinators.
     */
    var sequences /*: Array<string>*/ = [];

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = tokens[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var token = _step2.value;

        if (token.type === 'selector') {
          sequences.push(renderSelector(token));
        } else if (token.type === 'descendantCombinator') {
          sequences.push(' ');
        } else if (token.type === 'childCombinator') {
          sequences.push(' > ');
        } else if (token.type === 'adjacentSiblingCombinator') {
          sequences.push(' + ');
        } else if (token.type === 'generalSiblingCombinator') {
          sequences.push(' ~ ');
        } else {
          throw new Error('Unknown token.');
        }
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    return sequences.join('');
  };

  return {
    generate: generate
  };
};
//# sourceMappingURL=createGenerator.js.map