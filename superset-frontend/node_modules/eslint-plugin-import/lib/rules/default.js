'use strict';

var _ExportMap = require('../ExportMap');

var _ExportMap2 = _interopRequireDefault(_ExportMap);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('default')
    }
  },

  create: function (context) {

    function checkDefault(specifierType, node) {

      // poor man's Array.find
      let defaultSpecifier;
      node.specifiers.some(n => {
        if (n.type === specifierType) {
          defaultSpecifier = n;
          return true;
        }
      });

      if (!defaultSpecifier) return;
      var imports = _ExportMap2.default.get(node.source.value, context);
      if (imports == null) return;

      if (imports.errors.length) {
        imports.reportErrors(context, node);
      } else if (imports.get('default') === undefined) {
        context.report(defaultSpecifier, 'No default export found in module.');
      }
    }

    return {
      'ImportDeclaration': checkDefault.bind(null, 'ImportDefaultSpecifier'),
      'ExportNamedDeclaration': checkDefault.bind(null, 'ExportDefaultSpecifier')
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL2RlZmF1bHQuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwiY3JlYXRlIiwiY29udGV4dCIsImNoZWNrRGVmYXVsdCIsInNwZWNpZmllclR5cGUiLCJub2RlIiwiZGVmYXVsdFNwZWNpZmllciIsInNwZWNpZmllcnMiLCJzb21lIiwibiIsInR5cGUiLCJpbXBvcnRzIiwiRXhwb3J0cyIsImdldCIsInNvdXJjZSIsInZhbHVlIiwiZXJyb3JzIiwibGVuZ3RoIiwicmVwb3J0RXJyb3JzIiwidW5kZWZpbmVkIiwicmVwb3J0IiwiYmluZCJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7OztBQUNBOzs7Ozs7QUFFQUEsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU07QUFDSkMsV0FBSyx1QkFBUSxTQUFSO0FBREQ7QUFERixHQURTOztBQU9mQyxVQUFRLFVBQVVDLE9BQVYsRUFBbUI7O0FBRXpCLGFBQVNDLFlBQVQsQ0FBc0JDLGFBQXRCLEVBQXFDQyxJQUFyQyxFQUEyQzs7QUFFekM7QUFDQSxVQUFJQyxnQkFBSjtBQUNBRCxXQUFLRSxVQUFMLENBQWdCQyxJQUFoQixDQUFzQkMsQ0FBRCxJQUFPO0FBQzFCLFlBQUlBLEVBQUVDLElBQUYsS0FBV04sYUFBZixFQUE4QjtBQUM1QkUsNkJBQW1CRyxDQUFuQjtBQUNBLGlCQUFPLElBQVA7QUFDRDtBQUNGLE9BTEQ7O0FBT0EsVUFBSSxDQUFDSCxnQkFBTCxFQUF1QjtBQUN2QixVQUFJSyxVQUFVQyxvQkFBUUMsR0FBUixDQUFZUixLQUFLUyxNQUFMLENBQVlDLEtBQXhCLEVBQStCYixPQUEvQixDQUFkO0FBQ0EsVUFBSVMsV0FBVyxJQUFmLEVBQXFCOztBQUVyQixVQUFJQSxRQUFRSyxNQUFSLENBQWVDLE1BQW5CLEVBQTJCO0FBQ3pCTixnQkFBUU8sWUFBUixDQUFxQmhCLE9BQXJCLEVBQThCRyxJQUE5QjtBQUNELE9BRkQsTUFFTyxJQUFJTSxRQUFRRSxHQUFSLENBQVksU0FBWixNQUEyQk0sU0FBL0IsRUFBMEM7QUFDL0NqQixnQkFBUWtCLE1BQVIsQ0FBZWQsZ0JBQWYsRUFBaUMsb0NBQWpDO0FBQ0Q7QUFDRjs7QUFFRCxXQUFPO0FBQ0wsMkJBQXFCSCxhQUFha0IsSUFBYixDQUFrQixJQUFsQixFQUF3Qix3QkFBeEIsQ0FEaEI7QUFFTCxnQ0FBMEJsQixhQUFha0IsSUFBYixDQUFrQixJQUFsQixFQUF3Qix3QkFBeEI7QUFGckIsS0FBUDtBQUlEO0FBbkNjLENBQWpCIiwiZmlsZSI6InJ1bGVzL2RlZmF1bHQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgRXhwb3J0cyBmcm9tICcuLi9FeHBvcnRNYXAnXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIGRvY3M6IHtcbiAgICAgIHVybDogZG9jc1VybCgnZGVmYXVsdCcpLFxuICAgIH0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuXG4gICAgZnVuY3Rpb24gY2hlY2tEZWZhdWx0KHNwZWNpZmllclR5cGUsIG5vZGUpIHtcblxuICAgICAgLy8gcG9vciBtYW4ncyBBcnJheS5maW5kXG4gICAgICBsZXQgZGVmYXVsdFNwZWNpZmllclxuICAgICAgbm9kZS5zcGVjaWZpZXJzLnNvbWUoKG4pID0+IHtcbiAgICAgICAgaWYgKG4udHlwZSA9PT0gc3BlY2lmaWVyVHlwZSkge1xuICAgICAgICAgIGRlZmF1bHRTcGVjaWZpZXIgPSBuXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgaWYgKCFkZWZhdWx0U3BlY2lmaWVyKSByZXR1cm5cbiAgICAgIHZhciBpbXBvcnRzID0gRXhwb3J0cy5nZXQobm9kZS5zb3VyY2UudmFsdWUsIGNvbnRleHQpXG4gICAgICBpZiAoaW1wb3J0cyA9PSBudWxsKSByZXR1cm5cblxuICAgICAgaWYgKGltcG9ydHMuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICBpbXBvcnRzLnJlcG9ydEVycm9ycyhjb250ZXh0LCBub2RlKVxuICAgICAgfSBlbHNlIGlmIChpbXBvcnRzLmdldCgnZGVmYXVsdCcpID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29udGV4dC5yZXBvcnQoZGVmYXVsdFNwZWNpZmllciwgJ05vIGRlZmF1bHQgZXhwb3J0IGZvdW5kIGluIG1vZHVsZS4nKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAnSW1wb3J0RGVjbGFyYXRpb24nOiBjaGVja0RlZmF1bHQuYmluZChudWxsLCAnSW1wb3J0RGVmYXVsdFNwZWNpZmllcicpLFxuICAgICAgJ0V4cG9ydE5hbWVkRGVjbGFyYXRpb24nOiBjaGVja0RlZmF1bHQuYmluZChudWxsLCAnRXhwb3J0RGVmYXVsdFNwZWNpZmllcicpLFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==