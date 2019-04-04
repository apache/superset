'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------


module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-namespace')
    }
  },

  create: function (context) {
    return {
      'ImportNamespaceSpecifier': function (node) {
        context.report(node, `Unexpected namespace import.`);
      }
    };
  }
}; /**
    * @fileoverview Rule to disallow namespace import
    * @author Radek Benkel
    */
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLW5hbWVzcGFjZS5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJjb250ZXh0Iiwibm9kZSIsInJlcG9ydCJdLCJtYXBwaW5ncyI6Ijs7QUFLQTs7Ozs7O0FBRUE7QUFDQTtBQUNBOzs7QUFHQUEsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU07QUFDSkMsV0FBSyx1QkFBUSxjQUFSO0FBREQ7QUFERixHQURTOztBQU9mQyxVQUFRLFVBQVVDLE9BQVYsRUFBbUI7QUFDekIsV0FBTztBQUNMLGtDQUE0QixVQUFVQyxJQUFWLEVBQWdCO0FBQzFDRCxnQkFBUUUsTUFBUixDQUFlRCxJQUFmLEVBQXNCLDhCQUF0QjtBQUNEO0FBSEksS0FBUDtBQUtEO0FBYmMsQ0FBakIsQyxDQVpBIiwiZmlsZSI6InJ1bGVzL25vLW5hbWVzcGFjZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGVvdmVydmlldyBSdWxlIHRvIGRpc2FsbG93IG5hbWVzcGFjZSBpbXBvcnRcbiAqIEBhdXRob3IgUmFkZWsgQmVua2VsXG4gKi9cblxuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFJ1bGUgRGVmaW5pdGlvblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIGRvY3M6IHtcbiAgICAgIHVybDogZG9jc1VybCgnbm8tbmFtZXNwYWNlJyksXG4gICAgfSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICdJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXInOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICBjb250ZXh0LnJlcG9ydChub2RlLCBgVW5leHBlY3RlZCBuYW1lc3BhY2UgaW1wb3J0LmApXG4gICAgICB9LFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==