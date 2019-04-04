'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isRequire(node) {
  return node && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'require' && node.arguments.length >= 1;
}

function isStaticValue(arg) {
  return arg.type === 'Literal' || arg.type === 'TemplateLiteral' && arg.expressions.length === 0;
}

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-dynamic-require')
    }
  },

  create: function (context) {
    return {
      CallExpression(node) {
        if (isRequire(node) && !isStaticValue(node.arguments[0])) {
          context.report({
            node,
            message: 'Calls to require() should use string literals'
          });
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLWR5bmFtaWMtcmVxdWlyZS5qcyJdLCJuYW1lcyI6WyJpc1JlcXVpcmUiLCJub2RlIiwiY2FsbGVlIiwidHlwZSIsIm5hbWUiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJpc1N0YXRpY1ZhbHVlIiwiYXJnIiwiZXhwcmVzc2lvbnMiLCJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJjb250ZXh0IiwiQ2FsbEV4cHJlc3Npb24iLCJyZXBvcnQiLCJtZXNzYWdlIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7QUFFQSxTQUFTQSxTQUFULENBQW1CQyxJQUFuQixFQUF5QjtBQUN2QixTQUFPQSxRQUNMQSxLQUFLQyxNQURBLElBRUxELEtBQUtDLE1BQUwsQ0FBWUMsSUFBWixLQUFxQixZQUZoQixJQUdMRixLQUFLQyxNQUFMLENBQVlFLElBQVosS0FBcUIsU0FIaEIsSUFJTEgsS0FBS0ksU0FBTCxDQUFlQyxNQUFmLElBQXlCLENBSjNCO0FBS0Q7O0FBRUQsU0FBU0MsYUFBVCxDQUF1QkMsR0FBdkIsRUFBNEI7QUFDMUIsU0FBT0EsSUFBSUwsSUFBSixLQUFhLFNBQWIsSUFDSkssSUFBSUwsSUFBSixLQUFhLGlCQUFiLElBQWtDSyxJQUFJQyxXQUFKLENBQWdCSCxNQUFoQixLQUEyQixDQURoRTtBQUVEOztBQUVESSxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFFBQU07QUFDSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLG9CQUFSO0FBREQ7QUFERixHQURTOztBQU9mQyxVQUFRLFVBQVVDLE9BQVYsRUFBbUI7QUFDekIsV0FBTztBQUNMQyxxQkFBZWhCLElBQWYsRUFBcUI7QUFDbkIsWUFBSUQsVUFBVUMsSUFBVixLQUFtQixDQUFDTSxjQUFjTixLQUFLSSxTQUFMLENBQWUsQ0FBZixDQUFkLENBQXhCLEVBQTBEO0FBQ3hEVyxrQkFBUUUsTUFBUixDQUFlO0FBQ2JqQixnQkFEYTtBQUVia0IscUJBQVM7QUFGSSxXQUFmO0FBSUQ7QUFDRjtBQVJJLEtBQVA7QUFVRDtBQWxCYyxDQUFqQiIsImZpbGUiOiJydWxlcy9uby1keW5hbWljLXJlcXVpcmUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5mdW5jdGlvbiBpc1JlcXVpcmUobm9kZSkge1xuICByZXR1cm4gbm9kZSAmJlxuICAgIG5vZGUuY2FsbGVlICYmXG4gICAgbm9kZS5jYWxsZWUudHlwZSA9PT0gJ0lkZW50aWZpZXInICYmXG4gICAgbm9kZS5jYWxsZWUubmFtZSA9PT0gJ3JlcXVpcmUnICYmXG4gICAgbm9kZS5hcmd1bWVudHMubGVuZ3RoID49IDFcbn1cblxuZnVuY3Rpb24gaXNTdGF0aWNWYWx1ZShhcmcpIHtcbiAgcmV0dXJuIGFyZy50eXBlID09PSAnTGl0ZXJhbCcgfHxcbiAgICAoYXJnLnR5cGUgPT09ICdUZW1wbGF0ZUxpdGVyYWwnICYmIGFyZy5leHByZXNzaW9ucy5sZW5ndGggPT09IDApXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduby1keW5hbWljLXJlcXVpcmUnKSxcbiAgICB9LFxuICB9LFxuXG4gIGNyZWF0ZTogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgQ2FsbEV4cHJlc3Npb24obm9kZSkge1xuICAgICAgICBpZiAoaXNSZXF1aXJlKG5vZGUpICYmICFpc1N0YXRpY1ZhbHVlKG5vZGUuYXJndW1lbnRzWzBdKSkge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBtZXNzYWdlOiAnQ2FsbHMgdG8gcmVxdWlyZSgpIHNob3VsZCB1c2Ugc3RyaW5nIGxpdGVyYWxzJyxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==