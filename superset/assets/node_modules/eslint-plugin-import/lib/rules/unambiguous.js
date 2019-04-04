'use strict';

var _unambiguous = require('eslint-module-utils/unambiguous');

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @fileOverview Report modules that could parse incorrectly as scripts.
 * @author Ben Mosher
 */

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('unambiguous')
    }
  },

  create: function (context) {
    // ignore non-modules
    if (context.parserOptions.sourceType !== 'module') {
      return {};
    }

    return {
      Program: function (ast) {
        if (!(0, _unambiguous.isModule)(ast)) {
          context.report({
            node: ast,
            message: 'This module could be parsed as a valid script.'
          });
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL3VuYW1iaWd1b3VzLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsInVybCIsImNyZWF0ZSIsImNvbnRleHQiLCJwYXJzZXJPcHRpb25zIiwic291cmNlVHlwZSIsIlByb2dyYW0iLCJhc3QiLCJyZXBvcnQiLCJub2RlIiwibWVzc2FnZSJdLCJtYXBwaW5ncyI6Ijs7QUFLQTs7QUFDQTs7Ozs7O0FBTkE7Ozs7O0FBUUFBLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKQyxVQUFNO0FBQ0pDLFdBQUssdUJBQVEsYUFBUjtBQUREO0FBREYsR0FEUzs7QUFPZkMsVUFBUSxVQUFVQyxPQUFWLEVBQW1CO0FBQ3pCO0FBQ0EsUUFBSUEsUUFBUUMsYUFBUixDQUFzQkMsVUFBdEIsS0FBcUMsUUFBekMsRUFBbUQ7QUFDakQsYUFBTyxFQUFQO0FBQ0Q7O0FBRUQsV0FBTztBQUNMQyxlQUFTLFVBQVVDLEdBQVYsRUFBZTtBQUN0QixZQUFJLENBQUMsMkJBQVNBLEdBQVQsQ0FBTCxFQUFvQjtBQUNsQkosa0JBQVFLLE1BQVIsQ0FBZTtBQUNiQyxrQkFBTUYsR0FETztBQUViRyxxQkFBUztBQUZJLFdBQWY7QUFJRDtBQUNGO0FBUkksS0FBUDtBQVdEO0FBeEJjLENBQWpCIiwiZmlsZSI6InJ1bGVzL3VuYW1iaWd1b3VzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IFJlcG9ydCBtb2R1bGVzIHRoYXQgY291bGQgcGFyc2UgaW5jb3JyZWN0bHkgYXMgc2NyaXB0cy5cbiAqIEBhdXRob3IgQmVuIE1vc2hlclxuICovXG5cbmltcG9ydCB7IGlzTW9kdWxlIH0gZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy91bmFtYmlndW91cydcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCd1bmFtYmlndW91cycpLFxuICAgIH0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIC8vIGlnbm9yZSBub24tbW9kdWxlc1xuICAgIGlmIChjb250ZXh0LnBhcnNlck9wdGlvbnMuc291cmNlVHlwZSAhPT0gJ21vZHVsZScpIHtcbiAgICAgIHJldHVybiB7fVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBQcm9ncmFtOiBmdW5jdGlvbiAoYXN0KSB7XG4gICAgICAgIGlmICghaXNNb2R1bGUoYXN0KSkge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgIG5vZGU6IGFzdCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdUaGlzIG1vZHVsZSBjb3VsZCBiZSBwYXJzZWQgYXMgYSB2YWxpZCBzY3JpcHQuJyxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH1cblxuICB9LFxufVxuIl19