'use strict';

var _importType = require('../core/importType');

var _importType2 = _interopRequireDefault(_importType);

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function reportIfMissing(context, node, allowed, name) {
  if (allowed.indexOf(name) === -1 && (0, _importType2.default)(name, context) === 'builtin') {
    context.report(node, 'Do not import Node.js builtin module "' + name + '"');
  }
}

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-nodejs-modules')
    }
  },

  create: function (context) {
    const options = context.options[0] || {};
    const allowed = options.allow || [];

    return {
      ImportDeclaration: function handleImports(node) {
        reportIfMissing(context, node, allowed, node.source.value);
      },
      CallExpression: function handleRequires(node) {
        if ((0, _staticRequire2.default)(node)) {
          reportIfMissing(context, node, allowed, node.arguments[0].value);
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLW5vZGVqcy1tb2R1bGVzLmpzIl0sIm5hbWVzIjpbInJlcG9ydElmTWlzc2luZyIsImNvbnRleHQiLCJub2RlIiwiYWxsb3dlZCIsIm5hbWUiLCJpbmRleE9mIiwicmVwb3J0IiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwiY3JlYXRlIiwib3B0aW9ucyIsImFsbG93IiwiSW1wb3J0RGVjbGFyYXRpb24iLCJoYW5kbGVJbXBvcnRzIiwic291cmNlIiwidmFsdWUiLCJDYWxsRXhwcmVzc2lvbiIsImhhbmRsZVJlcXVpcmVzIiwiYXJndW1lbnRzIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7O0FBRUEsU0FBU0EsZUFBVCxDQUF5QkMsT0FBekIsRUFBa0NDLElBQWxDLEVBQXdDQyxPQUF4QyxFQUFpREMsSUFBakQsRUFBdUQ7QUFDckQsTUFBSUQsUUFBUUUsT0FBUixDQUFnQkQsSUFBaEIsTUFBMEIsQ0FBQyxDQUEzQixJQUFnQywwQkFBV0EsSUFBWCxFQUFpQkgsT0FBakIsTUFBOEIsU0FBbEUsRUFBNkU7QUFDM0VBLFlBQVFLLE1BQVIsQ0FBZUosSUFBZixFQUFxQiwyQ0FBMkNFLElBQTNDLEdBQWtELEdBQXZFO0FBQ0Q7QUFDRjs7QUFFREcsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU07QUFDSkMsV0FBSyx1QkFBUSxtQkFBUjtBQUREO0FBREYsR0FEUzs7QUFPZkMsVUFBUSxVQUFVWCxPQUFWLEVBQW1CO0FBQ3pCLFVBQU1ZLFVBQVVaLFFBQVFZLE9BQVIsQ0FBZ0IsQ0FBaEIsS0FBc0IsRUFBdEM7QUFDQSxVQUFNVixVQUFVVSxRQUFRQyxLQUFSLElBQWlCLEVBQWpDOztBQUVBLFdBQU87QUFDTEMseUJBQW1CLFNBQVNDLGFBQVQsQ0FBdUJkLElBQXZCLEVBQTZCO0FBQzlDRix3QkFBZ0JDLE9BQWhCLEVBQXlCQyxJQUF6QixFQUErQkMsT0FBL0IsRUFBd0NELEtBQUtlLE1BQUwsQ0FBWUMsS0FBcEQ7QUFDRCxPQUhJO0FBSUxDLHNCQUFnQixTQUFTQyxjQUFULENBQXdCbEIsSUFBeEIsRUFBOEI7QUFDNUMsWUFBSSw2QkFBZ0JBLElBQWhCLENBQUosRUFBMkI7QUFDekJGLDBCQUFnQkMsT0FBaEIsRUFBeUJDLElBQXpCLEVBQStCQyxPQUEvQixFQUF3Q0QsS0FBS21CLFNBQUwsQ0FBZSxDQUFmLEVBQWtCSCxLQUExRDtBQUNEO0FBQ0Y7QUFSSSxLQUFQO0FBVUQ7QUFyQmMsQ0FBakIiLCJmaWxlIjoicnVsZXMvbm8tbm9kZWpzLW1vZHVsZXMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgaW1wb3J0VHlwZSBmcm9tICcuLi9jb3JlL2ltcG9ydFR5cGUnXG5pbXBvcnQgaXNTdGF0aWNSZXF1aXJlIGZyb20gJy4uL2NvcmUvc3RhdGljUmVxdWlyZSdcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbmZ1bmN0aW9uIHJlcG9ydElmTWlzc2luZyhjb250ZXh0LCBub2RlLCBhbGxvd2VkLCBuYW1lKSB7XG4gIGlmIChhbGxvd2VkLmluZGV4T2YobmFtZSkgPT09IC0xICYmIGltcG9ydFR5cGUobmFtZSwgY29udGV4dCkgPT09ICdidWlsdGluJykge1xuICAgIGNvbnRleHQucmVwb3J0KG5vZGUsICdEbyBub3QgaW1wb3J0IE5vZGUuanMgYnVpbHRpbiBtb2R1bGUgXCInICsgbmFtZSArICdcIicpXG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ25vLW5vZGVqcy1tb2R1bGVzJyksXG4gICAgfSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGNvbnRleHQub3B0aW9uc1swXSB8fCB7fVxuICAgIGNvbnN0IGFsbG93ZWQgPSBvcHRpb25zLmFsbG93IHx8IFtdXG5cbiAgICByZXR1cm4ge1xuICAgICAgSW1wb3J0RGVjbGFyYXRpb246IGZ1bmN0aW9uIGhhbmRsZUltcG9ydHMobm9kZSkge1xuICAgICAgICByZXBvcnRJZk1pc3NpbmcoY29udGV4dCwgbm9kZSwgYWxsb3dlZCwgbm9kZS5zb3VyY2UudmFsdWUpXG4gICAgICB9LFxuICAgICAgQ2FsbEV4cHJlc3Npb246IGZ1bmN0aW9uIGhhbmRsZVJlcXVpcmVzKG5vZGUpIHtcbiAgICAgICAgaWYgKGlzU3RhdGljUmVxdWlyZShub2RlKSkge1xuICAgICAgICAgIHJlcG9ydElmTWlzc2luZyhjb250ZXh0LCBub2RlLCBhbGxvd2VkLCBub2RlLmFyZ3VtZW50c1swXS52YWx1ZSlcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9XG4gIH0sXG59XG4iXX0=