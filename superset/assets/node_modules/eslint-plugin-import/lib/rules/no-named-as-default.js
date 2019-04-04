'use strict';

var _ExportMap = require('../ExportMap');

var _ExportMap2 = _interopRequireDefault(_ExportMap);

var _importDeclaration = require('../importDeclaration');

var _importDeclaration2 = _interopRequireDefault(_importDeclaration);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-named-as-default')
    }
  },

  create: function (context) {
    function checkDefault(nameKey, defaultSpecifier) {
      // #566: default is a valid specifier
      if (defaultSpecifier[nameKey].name === 'default') return;

      var declaration = (0, _importDeclaration2.default)(context);

      var imports = _ExportMap2.default.get(declaration.source.value, context);
      if (imports == null) return;

      if (imports.errors.length) {
        imports.reportErrors(context, declaration);
        return;
      }

      if (imports.has('default') && imports.has(defaultSpecifier[nameKey].name)) {

        context.report(defaultSpecifier, 'Using exported name \'' + defaultSpecifier[nameKey].name + '\' as identifier for default export.');
      }
    }
    return {
      'ImportDefaultSpecifier': checkDefault.bind(null, 'local'),
      'ExportDefaultSpecifier': checkDefault.bind(null, 'exported')
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLW5hbWVkLWFzLWRlZmF1bHQuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwiY3JlYXRlIiwiY29udGV4dCIsImNoZWNrRGVmYXVsdCIsIm5hbWVLZXkiLCJkZWZhdWx0U3BlY2lmaWVyIiwibmFtZSIsImRlY2xhcmF0aW9uIiwiaW1wb3J0cyIsIkV4cG9ydHMiLCJnZXQiLCJzb3VyY2UiLCJ2YWx1ZSIsImVycm9ycyIsImxlbmd0aCIsInJlcG9ydEVycm9ycyIsImhhcyIsInJlcG9ydCIsImJpbmQiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7QUFFQUEsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU07QUFDSkMsV0FBSyx1QkFBUSxxQkFBUjtBQUREO0FBREYsR0FEUzs7QUFPZkMsVUFBUSxVQUFVQyxPQUFWLEVBQW1CO0FBQ3pCLGFBQVNDLFlBQVQsQ0FBc0JDLE9BQXRCLEVBQStCQyxnQkFBL0IsRUFBaUQ7QUFDL0M7QUFDQSxVQUFJQSxpQkFBaUJELE9BQWpCLEVBQTBCRSxJQUExQixLQUFtQyxTQUF2QyxFQUFrRDs7QUFFbEQsVUFBSUMsY0FBYyxpQ0FBa0JMLE9BQWxCLENBQWxCOztBQUVBLFVBQUlNLFVBQVVDLG9CQUFRQyxHQUFSLENBQVlILFlBQVlJLE1BQVosQ0FBbUJDLEtBQS9CLEVBQXNDVixPQUF0QyxDQUFkO0FBQ0EsVUFBSU0sV0FBVyxJQUFmLEVBQXFCOztBQUVyQixVQUFJQSxRQUFRSyxNQUFSLENBQWVDLE1BQW5CLEVBQTJCO0FBQ3pCTixnQkFBUU8sWUFBUixDQUFxQmIsT0FBckIsRUFBOEJLLFdBQTlCO0FBQ0E7QUFDRDs7QUFFRCxVQUFJQyxRQUFRUSxHQUFSLENBQVksU0FBWixLQUNBUixRQUFRUSxHQUFSLENBQVlYLGlCQUFpQkQsT0FBakIsRUFBMEJFLElBQXRDLENBREosRUFDaUQ7O0FBRS9DSixnQkFBUWUsTUFBUixDQUFlWixnQkFBZixFQUNFLDJCQUEyQkEsaUJBQWlCRCxPQUFqQixFQUEwQkUsSUFBckQsR0FDQSxzQ0FGRjtBQUlEO0FBQ0Y7QUFDRCxXQUFPO0FBQ0wsZ0NBQTBCSCxhQUFhZSxJQUFiLENBQWtCLElBQWxCLEVBQXdCLE9BQXhCLENBRHJCO0FBRUwsZ0NBQTBCZixhQUFhZSxJQUFiLENBQWtCLElBQWxCLEVBQXdCLFVBQXhCO0FBRnJCLEtBQVA7QUFJRDtBQW5DYyxDQUFqQiIsImZpbGUiOiJydWxlcy9uby1uYW1lZC1hcy1kZWZhdWx0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEV4cG9ydHMgZnJvbSAnLi4vRXhwb3J0TWFwJ1xuaW1wb3J0IGltcG9ydERlY2xhcmF0aW9uIGZyb20gJy4uL2ltcG9ydERlY2xhcmF0aW9uJ1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ25vLW5hbWVkLWFzLWRlZmF1bHQnKSxcbiAgICB9LFxuICB9LFxuXG4gIGNyZWF0ZTogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICBmdW5jdGlvbiBjaGVja0RlZmF1bHQobmFtZUtleSwgZGVmYXVsdFNwZWNpZmllcikge1xuICAgICAgLy8gIzU2NjogZGVmYXVsdCBpcyBhIHZhbGlkIHNwZWNpZmllclxuICAgICAgaWYgKGRlZmF1bHRTcGVjaWZpZXJbbmFtZUtleV0ubmFtZSA9PT0gJ2RlZmF1bHQnKSByZXR1cm5cblxuICAgICAgdmFyIGRlY2xhcmF0aW9uID0gaW1wb3J0RGVjbGFyYXRpb24oY29udGV4dClcblxuICAgICAgdmFyIGltcG9ydHMgPSBFeHBvcnRzLmdldChkZWNsYXJhdGlvbi5zb3VyY2UudmFsdWUsIGNvbnRleHQpXG4gICAgICBpZiAoaW1wb3J0cyA9PSBudWxsKSByZXR1cm5cblxuICAgICAgaWYgKGltcG9ydHMuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICBpbXBvcnRzLnJlcG9ydEVycm9ycyhjb250ZXh0LCBkZWNsYXJhdGlvbilcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGlmIChpbXBvcnRzLmhhcygnZGVmYXVsdCcpICYmXG4gICAgICAgICAgaW1wb3J0cy5oYXMoZGVmYXVsdFNwZWNpZmllcltuYW1lS2V5XS5uYW1lKSkge1xuXG4gICAgICAgIGNvbnRleHQucmVwb3J0KGRlZmF1bHRTcGVjaWZpZXIsXG4gICAgICAgICAgJ1VzaW5nIGV4cG9ydGVkIG5hbWUgXFwnJyArIGRlZmF1bHRTcGVjaWZpZXJbbmFtZUtleV0ubmFtZSArXG4gICAgICAgICAgJ1xcJyBhcyBpZGVudGlmaWVyIGZvciBkZWZhdWx0IGV4cG9ydC4nKVxuXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAnSW1wb3J0RGVmYXVsdFNwZWNpZmllcic6IGNoZWNrRGVmYXVsdC5iaW5kKG51bGwsICdsb2NhbCcpLFxuICAgICAgJ0V4cG9ydERlZmF1bHRTcGVjaWZpZXInOiBjaGVja0RlZmF1bHQuYmluZChudWxsLCAnZXhwb3J0ZWQnKSxcbiAgICB9XG4gIH0sXG59XG4iXX0=