'use strict';

var _moduleVisitor = require('eslint-module-utils/moduleVisitor');

var _moduleVisitor2 = _interopRequireDefault(_moduleVisitor);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

var _path = require('path');

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _importType = require('../core/importType');

var _importType2 = _interopRequireDefault(_importType);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-relative-parent-imports')
    },
    schema: [(0, _moduleVisitor.makeOptionsSchema)()]
  },

  create: function noRelativePackages(context) {
    const myPath = context.getFilename();
    if (myPath === '<text>') return {}; // can't check a non-file

    function checkSourceValue(sourceNode) {
      const depPath = sourceNode.value;

      if ((0, _importType2.default)(depPath, context) === 'external') {
        // ignore packages
        return;
      }

      const absDepPath = (0, _resolve2.default)(depPath, context);

      if (!absDepPath) {
        // unable to resolve path
        return;
      }

      const relDepPath = (0, _path.relative)((0, _path.dirname)(myPath), absDepPath);

      if ((0, _importType2.default)(relDepPath, context) === 'parent') {
        context.report({
          node: sourceNode,
          message: 'Relative imports from parent directories are not allowed. ' + `Please either pass what you're importing through at runtime ` + `(dependency injection), move \`${(0, _path.basename)(myPath)}\` to same ` + `directory as \`${depPath}\` or consider making \`${depPath}\` a package.`
        });
      }
    }

    return (0, _moduleVisitor2.default)(checkSourceValue, context.options[0]);
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLXJlbGF0aXZlLXBhcmVudC1pbXBvcnRzLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsInVybCIsInNjaGVtYSIsImNyZWF0ZSIsIm5vUmVsYXRpdmVQYWNrYWdlcyIsImNvbnRleHQiLCJteVBhdGgiLCJnZXRGaWxlbmFtZSIsImNoZWNrU291cmNlVmFsdWUiLCJzb3VyY2VOb2RlIiwiZGVwUGF0aCIsInZhbHVlIiwiYWJzRGVwUGF0aCIsInJlbERlcFBhdGgiLCJyZXBvcnQiLCJub2RlIiwibWVzc2FnZSIsIm9wdGlvbnMiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7O0FBRUE7Ozs7OztBQUVBQSxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFFBQU07QUFDSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLDRCQUFSO0FBREQsS0FERjtBQUlKQyxZQUFRLENBQUMsdUNBQUQ7QUFKSixHQURTOztBQVFmQyxVQUFRLFNBQVNDLGtCQUFULENBQTRCQyxPQUE1QixFQUFxQztBQUMzQyxVQUFNQyxTQUFTRCxRQUFRRSxXQUFSLEVBQWY7QUFDQSxRQUFJRCxXQUFXLFFBQWYsRUFBeUIsT0FBTyxFQUFQLENBRmtCLENBRVI7O0FBRW5DLGFBQVNFLGdCQUFULENBQTBCQyxVQUExQixFQUFzQztBQUNwQyxZQUFNQyxVQUFVRCxXQUFXRSxLQUEzQjs7QUFFQSxVQUFJLDBCQUFXRCxPQUFYLEVBQW9CTCxPQUFwQixNQUFpQyxVQUFyQyxFQUFpRDtBQUFFO0FBQ2pEO0FBQ0Q7O0FBRUQsWUFBTU8sYUFBYSx1QkFBUUYsT0FBUixFQUFpQkwsT0FBakIsQ0FBbkI7O0FBRUEsVUFBSSxDQUFDTyxVQUFMLEVBQWlCO0FBQUU7QUFDakI7QUFDRDs7QUFFRCxZQUFNQyxhQUFhLG9CQUFTLG1CQUFRUCxNQUFSLENBQVQsRUFBMEJNLFVBQTFCLENBQW5COztBQUVBLFVBQUksMEJBQVdDLFVBQVgsRUFBdUJSLE9BQXZCLE1BQW9DLFFBQXhDLEVBQWtEO0FBQ2hEQSxnQkFBUVMsTUFBUixDQUFlO0FBQ2JDLGdCQUFNTixVQURPO0FBRWJPLG1CQUFTLCtEQUNOLDhEQURNLEdBRU4sa0NBQWlDLG9CQUFTVixNQUFULENBQWlCLGFBRjVDLEdBR04sa0JBQWlCSSxPQUFRLDJCQUEwQkEsT0FBUTtBQUxqRCxTQUFmO0FBT0Q7QUFDRjs7QUFFRCxXQUFPLDZCQUFjRixnQkFBZCxFQUFnQ0gsUUFBUVksT0FBUixDQUFnQixDQUFoQixDQUFoQyxDQUFQO0FBQ0Q7QUF2Q2MsQ0FBakIiLCJmaWxlIjoicnVsZXMvbm8tcmVsYXRpdmUtcGFyZW50LWltcG9ydHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbW9kdWxlVmlzaXRvciwgeyBtYWtlT3B0aW9uc1NjaGVtYSB9IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvbW9kdWxlVmlzaXRvcidcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgcmVsYXRpdmUgfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHJlc29sdmUgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9yZXNvbHZlJ1xuXG5pbXBvcnQgaW1wb3J0VHlwZSBmcm9tICcuLi9jb3JlL2ltcG9ydFR5cGUnXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduby1yZWxhdGl2ZS1wYXJlbnQtaW1wb3J0cycpLFxuICAgIH0sXG4gICAgc2NoZW1hOiBbbWFrZU9wdGlvbnNTY2hlbWEoKV0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiBub1JlbGF0aXZlUGFja2FnZXMoY29udGV4dCkge1xuICAgIGNvbnN0IG15UGF0aCA9IGNvbnRleHQuZ2V0RmlsZW5hbWUoKVxuICAgIGlmIChteVBhdGggPT09ICc8dGV4dD4nKSByZXR1cm4ge30gLy8gY2FuJ3QgY2hlY2sgYSBub24tZmlsZVxuXG4gICAgZnVuY3Rpb24gY2hlY2tTb3VyY2VWYWx1ZShzb3VyY2VOb2RlKSB7XG4gICAgICBjb25zdCBkZXBQYXRoID0gc291cmNlTm9kZS52YWx1ZVxuXG4gICAgICBpZiAoaW1wb3J0VHlwZShkZXBQYXRoLCBjb250ZXh0KSA9PT0gJ2V4dGVybmFsJykgeyAvLyBpZ25vcmUgcGFja2FnZXNcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGFic0RlcFBhdGggPSByZXNvbHZlKGRlcFBhdGgsIGNvbnRleHQpXG5cbiAgICAgIGlmICghYWJzRGVwUGF0aCkgeyAvLyB1bmFibGUgdG8gcmVzb2x2ZSBwYXRoXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBjb25zdCByZWxEZXBQYXRoID0gcmVsYXRpdmUoZGlybmFtZShteVBhdGgpLCBhYnNEZXBQYXRoKVxuXG4gICAgICBpZiAoaW1wb3J0VHlwZShyZWxEZXBQYXRoLCBjb250ZXh0KSA9PT0gJ3BhcmVudCcpIHtcbiAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgIG5vZGU6IHNvdXJjZU5vZGUsXG4gICAgICAgICAgbWVzc2FnZTogJ1JlbGF0aXZlIGltcG9ydHMgZnJvbSBwYXJlbnQgZGlyZWN0b3JpZXMgYXJlIG5vdCBhbGxvd2VkLiAnICtcbiAgICAgICAgICAgIGBQbGVhc2UgZWl0aGVyIHBhc3Mgd2hhdCB5b3UncmUgaW1wb3J0aW5nIHRocm91Z2ggYXQgcnVudGltZSBgICtcbiAgICAgICAgICAgIGAoZGVwZW5kZW5jeSBpbmplY3Rpb24pLCBtb3ZlIFxcYCR7YmFzZW5hbWUobXlQYXRoKX1cXGAgdG8gc2FtZSBgICtcbiAgICAgICAgICAgIGBkaXJlY3RvcnkgYXMgXFxgJHtkZXBQYXRofVxcYCBvciBjb25zaWRlciBtYWtpbmcgXFxgJHtkZXBQYXRofVxcYCBhIHBhY2thZ2UuYCxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kdWxlVmlzaXRvcihjaGVja1NvdXJjZVZhbHVlLCBjb250ZXh0Lm9wdGlvbnNbMF0pXG4gIH0sXG59XG4iXX0=