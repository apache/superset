'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('prefer-default-export')
    }
  },

  create: function (context) {
    let specifierExportCount = 0;
    let hasDefaultExport = false;
    let hasStarExport = false;
    let namedExportNode = null;

    function captureDeclaration(identifierOrPattern) {
      if (identifierOrPattern.type === 'ObjectPattern') {
        // recursively capture
        identifierOrPattern.properties.forEach(function (property) {
          captureDeclaration(property.value);
        });
      } else {
        // assume it's a single standard identifier
        specifierExportCount++;
      }
    }

    return {
      'ExportDefaultSpecifier': function () {
        hasDefaultExport = true;
      },

      'ExportSpecifier': function (node) {
        if (node.exported.name === 'default') {
          hasDefaultExport = true;
        } else {
          specifierExportCount++;
          namedExportNode = node;
        }
      },

      'ExportNamedDeclaration': function (node) {
        // if there are specifiers, node.declaration should be null
        if (!node.declaration) return;

        // don't count flow types exports
        if (node.exportKind === 'type') return;

        if (node.declaration.declarations) {
          node.declaration.declarations.forEach(function (declaration) {
            captureDeclaration(declaration.id);
          });
        } else {
          // captures 'export function foo() {}' syntax
          specifierExportCount++;
        }

        namedExportNode = node;
      },

      'ExportDefaultDeclaration': function () {
        hasDefaultExport = true;
      },

      'ExportAllDeclaration': function () {
        hasStarExport = true;
      },

      'Program:exit': function () {
        if (specifierExportCount === 1 && !hasDefaultExport && !hasStarExport) {
          context.report(namedExportNode, 'Prefer default export.');
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL3ByZWZlci1kZWZhdWx0LWV4cG9ydC5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJjb250ZXh0Iiwic3BlY2lmaWVyRXhwb3J0Q291bnQiLCJoYXNEZWZhdWx0RXhwb3J0IiwiaGFzU3RhckV4cG9ydCIsIm5hbWVkRXhwb3J0Tm9kZSIsImNhcHR1cmVEZWNsYXJhdGlvbiIsImlkZW50aWZpZXJPclBhdHRlcm4iLCJ0eXBlIiwicHJvcGVydGllcyIsImZvckVhY2giLCJwcm9wZXJ0eSIsInZhbHVlIiwibm9kZSIsImV4cG9ydGVkIiwibmFtZSIsImRlY2xhcmF0aW9uIiwiZXhwb3J0S2luZCIsImRlY2xhcmF0aW9ucyIsImlkIiwicmVwb3J0Il0sIm1hcHBpbmdzIjoiQUFBQTs7QUFFQTs7Ozs7O0FBRUFBLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKQyxVQUFNO0FBQ0pDLFdBQUssdUJBQVEsdUJBQVI7QUFERDtBQURGLEdBRFM7O0FBT2ZDLFVBQVEsVUFBU0MsT0FBVCxFQUFrQjtBQUN4QixRQUFJQyx1QkFBdUIsQ0FBM0I7QUFDQSxRQUFJQyxtQkFBbUIsS0FBdkI7QUFDQSxRQUFJQyxnQkFBZ0IsS0FBcEI7QUFDQSxRQUFJQyxrQkFBa0IsSUFBdEI7O0FBRUEsYUFBU0Msa0JBQVQsQ0FBNEJDLG1CQUE1QixFQUFpRDtBQUMvQyxVQUFJQSxvQkFBb0JDLElBQXBCLEtBQTZCLGVBQWpDLEVBQWtEO0FBQ2hEO0FBQ0FELDRCQUFvQkUsVUFBcEIsQ0FDR0MsT0FESCxDQUNXLFVBQVNDLFFBQVQsRUFBbUI7QUFDMUJMLDZCQUFtQkssU0FBU0MsS0FBNUI7QUFDRCxTQUhIO0FBSUQsT0FORCxNQU1PO0FBQ1A7QUFDRVY7QUFDRDtBQUNGOztBQUVELFdBQU87QUFDTCxnQ0FBMEIsWUFBVztBQUNuQ0MsMkJBQW1CLElBQW5CO0FBQ0QsT0FISTs7QUFLTCx5QkFBbUIsVUFBU1UsSUFBVCxFQUFlO0FBQ2hDLFlBQUlBLEtBQUtDLFFBQUwsQ0FBY0MsSUFBZCxLQUF1QixTQUEzQixFQUFzQztBQUNwQ1osNkJBQW1CLElBQW5CO0FBQ0QsU0FGRCxNQUVPO0FBQ0xEO0FBQ0FHLDRCQUFrQlEsSUFBbEI7QUFDRDtBQUNGLE9BWkk7O0FBY0wsZ0NBQTBCLFVBQVNBLElBQVQsRUFBZTtBQUN2QztBQUNBLFlBQUksQ0FBQ0EsS0FBS0csV0FBVixFQUF1Qjs7QUFFdkI7QUFDQSxZQUFJSCxLQUFLSSxVQUFMLEtBQW9CLE1BQXhCLEVBQWdDOztBQUVoQyxZQUFJSixLQUFLRyxXQUFMLENBQWlCRSxZQUFyQixFQUFtQztBQUNqQ0wsZUFBS0csV0FBTCxDQUFpQkUsWUFBakIsQ0FBOEJSLE9BQTlCLENBQXNDLFVBQVNNLFdBQVQsRUFBc0I7QUFDMURWLCtCQUFtQlUsWUFBWUcsRUFBL0I7QUFDRCxXQUZEO0FBR0QsU0FKRCxNQUtLO0FBQ0g7QUFDQWpCO0FBQ0Q7O0FBRURHLDBCQUFrQlEsSUFBbEI7QUFDRCxPQWhDSTs7QUFrQ0wsa0NBQTRCLFlBQVc7QUFDckNWLDJCQUFtQixJQUFuQjtBQUNELE9BcENJOztBQXNDTCw4QkFBd0IsWUFBVztBQUNqQ0Msd0JBQWdCLElBQWhCO0FBQ0QsT0F4Q0k7O0FBMENMLHNCQUFnQixZQUFXO0FBQ3pCLFlBQUlGLHlCQUF5QixDQUF6QixJQUE4QixDQUFDQyxnQkFBL0IsSUFBbUQsQ0FBQ0MsYUFBeEQsRUFBdUU7QUFDckVILGtCQUFRbUIsTUFBUixDQUFlZixlQUFmLEVBQWdDLHdCQUFoQztBQUNEO0FBQ0Y7QUE5Q0ksS0FBUDtBQWdERDtBQTFFYyxDQUFqQiIsImZpbGUiOiJydWxlcy9wcmVmZXItZGVmYXVsdC1leHBvcnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCdcblxuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ3ByZWZlci1kZWZhdWx0LWV4cG9ydCcpLFxuICAgIH0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbihjb250ZXh0KSB7XG4gICAgbGV0IHNwZWNpZmllckV4cG9ydENvdW50ID0gMFxuICAgIGxldCBoYXNEZWZhdWx0RXhwb3J0ID0gZmFsc2VcbiAgICBsZXQgaGFzU3RhckV4cG9ydCA9IGZhbHNlXG4gICAgbGV0IG5hbWVkRXhwb3J0Tm9kZSA9IG51bGxcblxuICAgIGZ1bmN0aW9uIGNhcHR1cmVEZWNsYXJhdGlvbihpZGVudGlmaWVyT3JQYXR0ZXJuKSB7XG4gICAgICBpZiAoaWRlbnRpZmllck9yUGF0dGVybi50eXBlID09PSAnT2JqZWN0UGF0dGVybicpIHtcbiAgICAgICAgLy8gcmVjdXJzaXZlbHkgY2FwdHVyZVxuICAgICAgICBpZGVudGlmaWVyT3JQYXR0ZXJuLnByb3BlcnRpZXNcbiAgICAgICAgICAuZm9yRWFjaChmdW5jdGlvbihwcm9wZXJ0eSkge1xuICAgICAgICAgICAgY2FwdHVyZURlY2xhcmF0aW9uKHByb3BlcnR5LnZhbHVlKVxuICAgICAgICAgIH0pXG4gICAgICB9IGVsc2Uge1xuICAgICAgLy8gYXNzdW1lIGl0J3MgYSBzaW5nbGUgc3RhbmRhcmQgaWRlbnRpZmllclxuICAgICAgICBzcGVjaWZpZXJFeHBvcnRDb3VudCsrXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICdFeHBvcnREZWZhdWx0U3BlY2lmaWVyJzogZnVuY3Rpb24oKSB7XG4gICAgICAgIGhhc0RlZmF1bHRFeHBvcnQgPSB0cnVlXG4gICAgICB9LFxuXG4gICAgICAnRXhwb3J0U3BlY2lmaWVyJzogZnVuY3Rpb24obm9kZSkge1xuICAgICAgICBpZiAobm9kZS5leHBvcnRlZC5uYW1lID09PSAnZGVmYXVsdCcpIHtcbiAgICAgICAgICBoYXNEZWZhdWx0RXhwb3J0ID0gdHJ1ZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNwZWNpZmllckV4cG9ydENvdW50KytcbiAgICAgICAgICBuYW1lZEV4cG9ydE5vZGUgPSBub2RlXG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJzogZnVuY3Rpb24obm9kZSkge1xuICAgICAgICAvLyBpZiB0aGVyZSBhcmUgc3BlY2lmaWVycywgbm9kZS5kZWNsYXJhdGlvbiBzaG91bGQgYmUgbnVsbFxuICAgICAgICBpZiAoIW5vZGUuZGVjbGFyYXRpb24pIHJldHVyblxuXG4gICAgICAgIC8vIGRvbid0IGNvdW50IGZsb3cgdHlwZXMgZXhwb3J0c1xuICAgICAgICBpZiAobm9kZS5leHBvcnRLaW5kID09PSAndHlwZScpIHJldHVyblxuXG4gICAgICAgIGlmIChub2RlLmRlY2xhcmF0aW9uLmRlY2xhcmF0aW9ucykge1xuICAgICAgICAgIG5vZGUuZGVjbGFyYXRpb24uZGVjbGFyYXRpb25zLmZvckVhY2goZnVuY3Rpb24oZGVjbGFyYXRpb24pIHtcbiAgICAgICAgICAgIGNhcHR1cmVEZWNsYXJhdGlvbihkZWNsYXJhdGlvbi5pZClcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIGNhcHR1cmVzICdleHBvcnQgZnVuY3Rpb24gZm9vKCkge30nIHN5bnRheFxuICAgICAgICAgIHNwZWNpZmllckV4cG9ydENvdW50KytcbiAgICAgICAgfVxuXG4gICAgICAgIG5hbWVkRXhwb3J0Tm9kZSA9IG5vZGVcbiAgICAgIH0sXG5cbiAgICAgICdFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24nOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaGFzRGVmYXVsdEV4cG9ydCA9IHRydWVcbiAgICAgIH0sXG5cbiAgICAgICdFeHBvcnRBbGxEZWNsYXJhdGlvbic6IGZ1bmN0aW9uKCkge1xuICAgICAgICBoYXNTdGFyRXhwb3J0ID0gdHJ1ZVxuICAgICAgfSxcblxuICAgICAgJ1Byb2dyYW06ZXhpdCc6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoc3BlY2lmaWVyRXhwb3J0Q291bnQgPT09IDEgJiYgIWhhc0RlZmF1bHRFeHBvcnQgJiYgIWhhc1N0YXJFeHBvcnQpIHtcbiAgICAgICAgICBjb250ZXh0LnJlcG9ydChuYW1lZEV4cG9ydE5vZGUsICdQcmVmZXIgZGVmYXVsdCBleHBvcnQuJylcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9XG4gIH0sXG59XG4iXX0=