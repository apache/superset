'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-mutable-exports')
    }
  },

  create: function (context) {
    function checkDeclaration(node) {
      const kind = node.kind;

      if (kind === 'var' || kind === 'let') {
        context.report(node, `Exporting mutable '${kind}' binding, use 'const' instead.`);
      }
    }

    function checkDeclarationsInScope(_ref, name) {
      let variables = _ref.variables;

      for (let variable of variables) {
        if (variable.name === name) {
          for (let def of variable.defs) {
            if (def.type === 'Variable' && def.parent) {
              checkDeclaration(def.parent);
            }
          }
        }
      }
    }

    function handleExportDefault(node) {
      const scope = context.getScope();

      if (node.declaration.name) {
        checkDeclarationsInScope(scope, node.declaration.name);
      }
    }

    function handleExportNamed(node) {
      const scope = context.getScope();

      if (node.declaration) {
        checkDeclaration(node.declaration);
      } else if (!node.source) {
        for (let specifier of node.specifiers) {
          checkDeclarationsInScope(scope, specifier.local.name);
        }
      }
    }

    return {
      'ExportDefaultDeclaration': handleExportDefault,
      'ExportNamedDeclaration': handleExportNamed
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLW11dGFibGUtZXhwb3J0cy5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJjb250ZXh0IiwiY2hlY2tEZWNsYXJhdGlvbiIsIm5vZGUiLCJraW5kIiwicmVwb3J0IiwiY2hlY2tEZWNsYXJhdGlvbnNJblNjb3BlIiwibmFtZSIsInZhcmlhYmxlcyIsInZhcmlhYmxlIiwiZGVmIiwiZGVmcyIsInR5cGUiLCJwYXJlbnQiLCJoYW5kbGVFeHBvcnREZWZhdWx0Iiwic2NvcGUiLCJnZXRTY29wZSIsImRlY2xhcmF0aW9uIiwiaGFuZGxlRXhwb3J0TmFtZWQiLCJzb3VyY2UiLCJzcGVjaWZpZXIiLCJzcGVjaWZpZXJzIiwibG9jYWwiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztBQUVBQSxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFFBQU07QUFDSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLG9CQUFSO0FBREQ7QUFERixHQURTOztBQU9mQyxVQUFRLFVBQVVDLE9BQVYsRUFBbUI7QUFDekIsYUFBU0MsZ0JBQVQsQ0FBMEJDLElBQTFCLEVBQWdDO0FBQUEsWUFDdkJDLElBRHVCLEdBQ2ZELElBRGUsQ0FDdkJDLElBRHVCOztBQUU5QixVQUFJQSxTQUFTLEtBQVQsSUFBa0JBLFNBQVMsS0FBL0IsRUFBc0M7QUFDcENILGdCQUFRSSxNQUFSLENBQWVGLElBQWYsRUFBc0Isc0JBQXFCQyxJQUFLLGlDQUFoRDtBQUNEO0FBQ0Y7O0FBRUQsYUFBU0Usd0JBQVQsT0FBK0NDLElBQS9DLEVBQXFEO0FBQUEsVUFBbEJDLFNBQWtCLFFBQWxCQSxTQUFrQjs7QUFDbkQsV0FBSyxJQUFJQyxRQUFULElBQXFCRCxTQUFyQixFQUFnQztBQUM5QixZQUFJQyxTQUFTRixJQUFULEtBQWtCQSxJQUF0QixFQUE0QjtBQUMxQixlQUFLLElBQUlHLEdBQVQsSUFBZ0JELFNBQVNFLElBQXpCLEVBQStCO0FBQzdCLGdCQUFJRCxJQUFJRSxJQUFKLEtBQWEsVUFBYixJQUEyQkYsSUFBSUcsTUFBbkMsRUFBMkM7QUFDekNYLCtCQUFpQlEsSUFBSUcsTUFBckI7QUFDRDtBQUNGO0FBQ0Y7QUFDRjtBQUNGOztBQUVELGFBQVNDLG1CQUFULENBQTZCWCxJQUE3QixFQUFtQztBQUNqQyxZQUFNWSxRQUFRZCxRQUFRZSxRQUFSLEVBQWQ7O0FBRUEsVUFBSWIsS0FBS2MsV0FBTCxDQUFpQlYsSUFBckIsRUFBMkI7QUFDekJELGlDQUF5QlMsS0FBekIsRUFBZ0NaLEtBQUtjLFdBQUwsQ0FBaUJWLElBQWpEO0FBQ0Q7QUFDRjs7QUFFRCxhQUFTVyxpQkFBVCxDQUEyQmYsSUFBM0IsRUFBaUM7QUFDL0IsWUFBTVksUUFBUWQsUUFBUWUsUUFBUixFQUFkOztBQUVBLFVBQUliLEtBQUtjLFdBQVQsRUFBdUI7QUFDckJmLHlCQUFpQkMsS0FBS2MsV0FBdEI7QUFDRCxPQUZELE1BRU8sSUFBSSxDQUFDZCxLQUFLZ0IsTUFBVixFQUFrQjtBQUN2QixhQUFLLElBQUlDLFNBQVQsSUFBc0JqQixLQUFLa0IsVUFBM0IsRUFBdUM7QUFDckNmLG1DQUF5QlMsS0FBekIsRUFBZ0NLLFVBQVVFLEtBQVYsQ0FBZ0JmLElBQWhEO0FBQ0Q7QUFDRjtBQUNGOztBQUVELFdBQU87QUFDTCxrQ0FBNEJPLG1CQUR2QjtBQUVMLGdDQUEwQkk7QUFGckIsS0FBUDtBQUlEO0FBbkRjLENBQWpCIiwiZmlsZSI6InJ1bGVzL25vLW11dGFibGUtZXhwb3J0cy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduby1tdXRhYmxlLWV4cG9ydHMnKSxcbiAgICB9LFxuICB9LFxuXG4gIGNyZWF0ZTogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICBmdW5jdGlvbiBjaGVja0RlY2xhcmF0aW9uKG5vZGUpIHtcbiAgICAgIGNvbnN0IHtraW5kfSA9IG5vZGVcbiAgICAgIGlmIChraW5kID09PSAndmFyJyB8fCBraW5kID09PSAnbGV0Jykge1xuICAgICAgICBjb250ZXh0LnJlcG9ydChub2RlLCBgRXhwb3J0aW5nIG11dGFibGUgJyR7a2luZH0nIGJpbmRpbmcsIHVzZSAnY29uc3QnIGluc3RlYWQuYClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGVja0RlY2xhcmF0aW9uc0luU2NvcGUoe3ZhcmlhYmxlc30sIG5hbWUpIHtcbiAgICAgIGZvciAobGV0IHZhcmlhYmxlIG9mIHZhcmlhYmxlcykge1xuICAgICAgICBpZiAodmFyaWFibGUubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICAgIGZvciAobGV0IGRlZiBvZiB2YXJpYWJsZS5kZWZzKSB7XG4gICAgICAgICAgICBpZiAoZGVmLnR5cGUgPT09ICdWYXJpYWJsZScgJiYgZGVmLnBhcmVudCkge1xuICAgICAgICAgICAgICBjaGVja0RlY2xhcmF0aW9uKGRlZi5wYXJlbnQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFuZGxlRXhwb3J0RGVmYXVsdChub2RlKSB7XG4gICAgICBjb25zdCBzY29wZSA9IGNvbnRleHQuZ2V0U2NvcGUoKVxuXG4gICAgICBpZiAobm9kZS5kZWNsYXJhdGlvbi5uYW1lKSB7XG4gICAgICAgIGNoZWNrRGVjbGFyYXRpb25zSW5TY29wZShzY29wZSwgbm9kZS5kZWNsYXJhdGlvbi5uYW1lKVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZUV4cG9ydE5hbWVkKG5vZGUpIHtcbiAgICAgIGNvbnN0IHNjb3BlID0gY29udGV4dC5nZXRTY29wZSgpXG5cbiAgICAgIGlmIChub2RlLmRlY2xhcmF0aW9uKSAge1xuICAgICAgICBjaGVja0RlY2xhcmF0aW9uKG5vZGUuZGVjbGFyYXRpb24pXG4gICAgICB9IGVsc2UgaWYgKCFub2RlLnNvdXJjZSkge1xuICAgICAgICBmb3IgKGxldCBzcGVjaWZpZXIgb2Ygbm9kZS5zcGVjaWZpZXJzKSB7XG4gICAgICAgICAgY2hlY2tEZWNsYXJhdGlvbnNJblNjb3BlKHNjb3BlLCBzcGVjaWZpZXIubG9jYWwubmFtZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAnRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uJzogaGFuZGxlRXhwb3J0RGVmYXVsdCxcbiAgICAgICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJzogaGFuZGxlRXhwb3J0TmFtZWQsXG4gICAgfVxuICB9LFxufVxuIl19