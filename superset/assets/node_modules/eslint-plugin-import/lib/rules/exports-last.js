'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isNonExportStatement(_ref) {
  let type = _ref.type;

  return type !== 'ExportDefaultDeclaration' && type !== 'ExportNamedDeclaration' && type !== 'ExportAllDeclaration';
}

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('exports-last')
    }
  },

  create: function (context) {
    return {
      Program: function (_ref2) {
        let body = _ref2.body;

        const lastNonExportStatementIndex = body.reduce(function findLastIndex(acc, item, index) {
          if (isNonExportStatement(item)) {
            return index;
          }
          return acc;
        }, -1);

        if (lastNonExportStatementIndex !== -1) {
          body.slice(0, lastNonExportStatementIndex).forEach(function checkNonExport(node) {
            if (!isNonExportStatement(node)) {
              context.report({
                node,
                message: 'Export statements should appear at the end of the file'
              });
            }
          });
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL2V4cG9ydHMtbGFzdC5qcyJdLCJuYW1lcyI6WyJpc05vbkV4cG9ydFN0YXRlbWVudCIsInR5cGUiLCJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJjb250ZXh0IiwiUHJvZ3JhbSIsImJvZHkiLCJsYXN0Tm9uRXhwb3J0U3RhdGVtZW50SW5kZXgiLCJyZWR1Y2UiLCJmaW5kTGFzdEluZGV4IiwiYWNjIiwiaXRlbSIsImluZGV4Iiwic2xpY2UiLCJmb3JFYWNoIiwiY2hlY2tOb25FeHBvcnQiLCJub2RlIiwicmVwb3J0IiwibWVzc2FnZSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0FBRUEsU0FBU0Esb0JBQVQsT0FBd0M7QUFBQSxNQUFSQyxJQUFRLFFBQVJBLElBQVE7O0FBQ3RDLFNBQU9BLFNBQVMsMEJBQVQsSUFDTEEsU0FBUyx3QkFESixJQUVMQSxTQUFTLHNCQUZYO0FBR0Q7O0FBRURDLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKQyxVQUFNO0FBQ0pDLFdBQUssdUJBQVEsY0FBUjtBQUREO0FBREYsR0FEUzs7QUFPZkMsVUFBUSxVQUFVQyxPQUFWLEVBQW1CO0FBQ3pCLFdBQU87QUFDTEMsZUFBUyxpQkFBb0I7QUFBQSxZQUFSQyxJQUFRLFNBQVJBLElBQVE7O0FBQzNCLGNBQU1DLDhCQUE4QkQsS0FBS0UsTUFBTCxDQUFZLFNBQVNDLGFBQVQsQ0FBdUJDLEdBQXZCLEVBQTRCQyxJQUE1QixFQUFrQ0MsS0FBbEMsRUFBeUM7QUFDdkYsY0FBSWhCLHFCQUFxQmUsSUFBckIsQ0FBSixFQUFnQztBQUM5QixtQkFBT0MsS0FBUDtBQUNEO0FBQ0QsaUJBQU9GLEdBQVA7QUFDRCxTQUxtQyxFQUtqQyxDQUFDLENBTGdDLENBQXBDOztBQU9BLFlBQUlILGdDQUFnQyxDQUFDLENBQXJDLEVBQXdDO0FBQ3RDRCxlQUFLTyxLQUFMLENBQVcsQ0FBWCxFQUFjTiwyQkFBZCxFQUEyQ08sT0FBM0MsQ0FBbUQsU0FBU0MsY0FBVCxDQUF3QkMsSUFBeEIsRUFBOEI7QUFDL0UsZ0JBQUksQ0FBQ3BCLHFCQUFxQm9CLElBQXJCLENBQUwsRUFBaUM7QUFDL0JaLHNCQUFRYSxNQUFSLENBQWU7QUFDYkQsb0JBRGE7QUFFYkUseUJBQVM7QUFGSSxlQUFmO0FBSUQ7QUFDRixXQVBEO0FBUUQ7QUFDRjtBQW5CSSxLQUFQO0FBcUJEO0FBN0JjLENBQWpCIiwiZmlsZSI6InJ1bGVzL2V4cG9ydHMtbGFzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbmZ1bmN0aW9uIGlzTm9uRXhwb3J0U3RhdGVtZW50KHsgdHlwZSB9KSB7XG4gIHJldHVybiB0eXBlICE9PSAnRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uJyAmJlxuICAgIHR5cGUgIT09ICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJyAmJlxuICAgIHR5cGUgIT09ICdFeHBvcnRBbGxEZWNsYXJhdGlvbidcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ2V4cG9ydHMtbGFzdCcpLFxuICAgIH0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIHJldHVybiB7XG4gICAgICBQcm9ncmFtOiBmdW5jdGlvbiAoeyBib2R5IH0pIHtcbiAgICAgICAgY29uc3QgbGFzdE5vbkV4cG9ydFN0YXRlbWVudEluZGV4ID0gYm9keS5yZWR1Y2UoZnVuY3Rpb24gZmluZExhc3RJbmRleChhY2MsIGl0ZW0sIGluZGV4KSB7XG4gICAgICAgICAgaWYgKGlzTm9uRXhwb3J0U3RhdGVtZW50KGl0ZW0pKSB7XG4gICAgICAgICAgICByZXR1cm4gaW5kZXhcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGFjY1xuICAgICAgICB9LCAtMSlcblxuICAgICAgICBpZiAobGFzdE5vbkV4cG9ydFN0YXRlbWVudEluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIGJvZHkuc2xpY2UoMCwgbGFzdE5vbkV4cG9ydFN0YXRlbWVudEluZGV4KS5mb3JFYWNoKGZ1bmN0aW9uIGNoZWNrTm9uRXhwb3J0KG5vZGUpIHtcbiAgICAgICAgICAgIGlmICghaXNOb25FeHBvcnRTdGF0ZW1lbnQobm9kZSkpIHtcbiAgICAgICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0V4cG9ydCBzdGF0ZW1lbnRzIHNob3VsZCBhcHBlYXIgYXQgdGhlIGVuZCBvZiB0aGUgZmlsZScsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9XG4gIH0sXG59XG4iXX0=