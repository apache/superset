'use strict';

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isImportingSelf(context, node, requireName) {
  const filePath = context.getFilename();

  // If the input is from stdin, this test can't fail
  if (filePath !== '<text>' && filePath === (0, _resolve2.default)(requireName, context)) {
    context.report({
      node,
      message: 'Module imports itself.'
    });
  }
} /**
   * @fileOverview Forbids a module from importing itself
   * @author Gio d'Amelio
   */

module.exports = {
  meta: {
    docs: {
      description: 'Forbid a module from importing itself',
      recommended: true,
      url: (0, _docsUrl2.default)('no-self-import')
    },

    schema: []
  },
  create: function (context) {
    return {
      ImportDeclaration(node) {
        isImportingSelf(context, node, node.source.value);
      },
      CallExpression(node) {
        if ((0, _staticRequire2.default)(node)) {
          isImportingSelf(context, node, node.arguments[0].value);
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLXNlbGYtaW1wb3J0LmpzIl0sIm5hbWVzIjpbImlzSW1wb3J0aW5nU2VsZiIsImNvbnRleHQiLCJub2RlIiwicmVxdWlyZU5hbWUiLCJmaWxlUGF0aCIsImdldEZpbGVuYW1lIiwicmVwb3J0IiwibWVzc2FnZSIsIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsImRlc2NyaXB0aW9uIiwicmVjb21tZW5kZWQiLCJ1cmwiLCJzY2hlbWEiLCJjcmVhdGUiLCJJbXBvcnREZWNsYXJhdGlvbiIsInNvdXJjZSIsInZhbHVlIiwiQ2FsbEV4cHJlc3Npb24iLCJhcmd1bWVudHMiXSwibWFwcGluZ3MiOiI7O0FBS0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7QUFFQSxTQUFTQSxlQUFULENBQXlCQyxPQUF6QixFQUFrQ0MsSUFBbEMsRUFBd0NDLFdBQXhDLEVBQXFEO0FBQ25ELFFBQU1DLFdBQVdILFFBQVFJLFdBQVIsRUFBakI7O0FBRUE7QUFDQSxNQUFJRCxhQUFhLFFBQWIsSUFBeUJBLGFBQWEsdUJBQVFELFdBQVIsRUFBcUJGLE9BQXJCLENBQTFDLEVBQXlFO0FBQ3ZFQSxZQUFRSyxNQUFSLENBQWU7QUFDWEosVUFEVztBQUVYSyxlQUFTO0FBRkUsS0FBZjtBQUlEO0FBQ0YsQyxDQW5CRDs7Ozs7QUFxQkFDLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKQyxVQUFNO0FBQ0pDLG1CQUFhLHVDQURUO0FBRUpDLG1CQUFhLElBRlQ7QUFHSkMsV0FBSyx1QkFBUSxnQkFBUjtBQUhELEtBREY7O0FBT0pDLFlBQVE7QUFQSixHQURTO0FBVWZDLFVBQVEsVUFBVWYsT0FBVixFQUFtQjtBQUN6QixXQUFPO0FBQ0xnQix3QkFBa0JmLElBQWxCLEVBQXdCO0FBQ3RCRix3QkFBZ0JDLE9BQWhCLEVBQXlCQyxJQUF6QixFQUErQkEsS0FBS2dCLE1BQUwsQ0FBWUMsS0FBM0M7QUFDRCxPQUhJO0FBSUxDLHFCQUFlbEIsSUFBZixFQUFxQjtBQUNuQixZQUFJLDZCQUFnQkEsSUFBaEIsQ0FBSixFQUEyQjtBQUN6QkYsMEJBQWdCQyxPQUFoQixFQUF5QkMsSUFBekIsRUFBK0JBLEtBQUttQixTQUFMLENBQWUsQ0FBZixFQUFrQkYsS0FBakQ7QUFDRDtBQUNGO0FBUkksS0FBUDtBQVVEO0FBckJjLENBQWpCIiwiZmlsZSI6InJ1bGVzL25vLXNlbGYtaW1wb3J0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IEZvcmJpZHMgYSBtb2R1bGUgZnJvbSBpbXBvcnRpbmcgaXRzZWxmXG4gKiBAYXV0aG9yIEdpbyBkJ0FtZWxpb1xuICovXG5cbmltcG9ydCByZXNvbHZlIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvcmVzb2x2ZSdcbmltcG9ydCBpc1N0YXRpY1JlcXVpcmUgZnJvbSAnLi4vY29yZS9zdGF0aWNSZXF1aXJlJ1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxuZnVuY3Rpb24gaXNJbXBvcnRpbmdTZWxmKGNvbnRleHQsIG5vZGUsIHJlcXVpcmVOYW1lKSB7XG4gIGNvbnN0IGZpbGVQYXRoID0gY29udGV4dC5nZXRGaWxlbmFtZSgpXG5cbiAgLy8gSWYgdGhlIGlucHV0IGlzIGZyb20gc3RkaW4sIHRoaXMgdGVzdCBjYW4ndCBmYWlsXG4gIGlmIChmaWxlUGF0aCAhPT0gJzx0ZXh0PicgJiYgZmlsZVBhdGggPT09IHJlc29sdmUocmVxdWlyZU5hbWUsIGNvbnRleHQpKSB7XG4gICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICBub2RlLFxuICAgICAgICBtZXNzYWdlOiAnTW9kdWxlIGltcG9ydHMgaXRzZWxmLicsXG4gICAgfSlcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIGRvY3M6IHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnRm9yYmlkIGEgbW9kdWxlIGZyb20gaW1wb3J0aW5nIGl0c2VsZicsXG4gICAgICByZWNvbW1lbmRlZDogdHJ1ZSxcbiAgICAgIHVybDogZG9jc1VybCgnbm8tc2VsZi1pbXBvcnQnKSxcbiAgICB9LFxuXG4gICAgc2NoZW1hOiBbXSxcbiAgfSxcbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIHJldHVybiB7XG4gICAgICBJbXBvcnREZWNsYXJhdGlvbihub2RlKSB7XG4gICAgICAgIGlzSW1wb3J0aW5nU2VsZihjb250ZXh0LCBub2RlLCBub2RlLnNvdXJjZS52YWx1ZSlcbiAgICAgIH0sXG4gICAgICBDYWxsRXhwcmVzc2lvbihub2RlKSB7XG4gICAgICAgIGlmIChpc1N0YXRpY1JlcXVpcmUobm9kZSkpIHtcbiAgICAgICAgICBpc0ltcG9ydGluZ1NlbGYoY29udGV4dCwgbm9kZSwgbm9kZS5hcmd1bWVudHNbMF0udmFsdWUpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfVxuICB9LFxufVxuIl19