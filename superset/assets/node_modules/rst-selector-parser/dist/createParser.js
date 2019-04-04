'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _nearley = require('nearley');

var _grammar = require('./grammar');

var _grammar2 = _interopRequireDefault(_grammar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*:: import type {
  CombinatorTokenType,
  SelectorTokenType
} from './types';*/ // @flow

exports.default = function () {
  var parse = function parse(selector /*: string*/) /*: Array<SelectorTokenType | CombinatorTokenType>*/ {
    var parser = new _nearley.Parser(_grammar2.default.ParserRules, _grammar2.default.ParserStart);

    var results = parser.feed(selector).results;

    if (results.length === 0) {
      throw new Error('Found no parsings.');
    }

    if (results.length > 1) {
      throw new Error('Ambiguous results.');
    }

    return results[0];
  };

  return {
    parse: parse
  };
};
//# sourceMappingURL=createParser.js.map