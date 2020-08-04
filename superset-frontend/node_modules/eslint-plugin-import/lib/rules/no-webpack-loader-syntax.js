'use strict';

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function reportIfNonStandard(context, node, name) {
  if (name.indexOf('!') !== -1) {
    context.report(node, `Unexpected '!' in '${name}'. ` + 'Do not use import syntax to configure webpack loaders.');
  }
}

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-webpack-loader-syntax')
    }
  },

  create: function (context) {
    return {
      ImportDeclaration: function handleImports(node) {
        reportIfNonStandard(context, node, node.source.value);
      },
      CallExpression: function handleRequires(node) {
        if ((0, _staticRequire2.default)(node)) {
          reportIfNonStandard(context, node, node.arguments[0].value);
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLXdlYnBhY2stbG9hZGVyLXN5bnRheC5qcyJdLCJuYW1lcyI6WyJyZXBvcnRJZk5vblN0YW5kYXJkIiwiY29udGV4dCIsIm5vZGUiLCJuYW1lIiwiaW5kZXhPZiIsInJlcG9ydCIsIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsInVybCIsImNyZWF0ZSIsIkltcG9ydERlY2xhcmF0aW9uIiwiaGFuZGxlSW1wb3J0cyIsInNvdXJjZSIsInZhbHVlIiwiQ2FsbEV4cHJlc3Npb24iLCJoYW5kbGVSZXF1aXJlcyIsImFyZ3VtZW50cyJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7OztBQUNBOzs7Ozs7QUFFQSxTQUFTQSxtQkFBVCxDQUE2QkMsT0FBN0IsRUFBc0NDLElBQXRDLEVBQTRDQyxJQUE1QyxFQUFrRDtBQUNoRCxNQUFJQSxLQUFLQyxPQUFMLENBQWEsR0FBYixNQUFzQixDQUFDLENBQTNCLEVBQThCO0FBQzVCSCxZQUFRSSxNQUFSLENBQWVILElBQWYsRUFBc0Isc0JBQXFCQyxJQUFLLEtBQTNCLEdBQ25CLHdEQURGO0FBR0Q7QUFDRjs7QUFFREcsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU07QUFDSkMsV0FBSyx1QkFBUSwwQkFBUjtBQUREO0FBREYsR0FEUzs7QUFPZkMsVUFBUSxVQUFVVixPQUFWLEVBQW1CO0FBQ3pCLFdBQU87QUFDTFcseUJBQW1CLFNBQVNDLGFBQVQsQ0FBdUJYLElBQXZCLEVBQTZCO0FBQzlDRiw0QkFBb0JDLE9BQXBCLEVBQTZCQyxJQUE3QixFQUFtQ0EsS0FBS1ksTUFBTCxDQUFZQyxLQUEvQztBQUNELE9BSEk7QUFJTEMsc0JBQWdCLFNBQVNDLGNBQVQsQ0FBd0JmLElBQXhCLEVBQThCO0FBQzVDLFlBQUksNkJBQWdCQSxJQUFoQixDQUFKLEVBQTJCO0FBQ3pCRiw4QkFBb0JDLE9BQXBCLEVBQTZCQyxJQUE3QixFQUFtQ0EsS0FBS2dCLFNBQUwsQ0FBZSxDQUFmLEVBQWtCSCxLQUFyRDtBQUNEO0FBQ0Y7QUFSSSxLQUFQO0FBVUQ7QUFsQmMsQ0FBakIiLCJmaWxlIjoicnVsZXMvbm8td2VicGFjay1sb2FkZXItc3ludGF4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGlzU3RhdGljUmVxdWlyZSBmcm9tICcuLi9jb3JlL3N0YXRpY1JlcXVpcmUnXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5mdW5jdGlvbiByZXBvcnRJZk5vblN0YW5kYXJkKGNvbnRleHQsIG5vZGUsIG5hbWUpIHtcbiAgaWYgKG5hbWUuaW5kZXhPZignIScpICE9PSAtMSkge1xuICAgIGNvbnRleHQucmVwb3J0KG5vZGUsIGBVbmV4cGVjdGVkICchJyBpbiAnJHtuYW1lfScuIGAgK1xuICAgICAgJ0RvIG5vdCB1c2UgaW1wb3J0IHN5bnRheCB0byBjb25maWd1cmUgd2VicGFjayBsb2FkZXJzLidcbiAgICApXG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ25vLXdlYnBhY2stbG9hZGVyLXN5bnRheCcpLFxuICAgIH0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIHJldHVybiB7XG4gICAgICBJbXBvcnREZWNsYXJhdGlvbjogZnVuY3Rpb24gaGFuZGxlSW1wb3J0cyhub2RlKSB7XG4gICAgICAgIHJlcG9ydElmTm9uU3RhbmRhcmQoY29udGV4dCwgbm9kZSwgbm9kZS5zb3VyY2UudmFsdWUpXG4gICAgICB9LFxuICAgICAgQ2FsbEV4cHJlc3Npb246IGZ1bmN0aW9uIGhhbmRsZVJlcXVpcmVzKG5vZGUpIHtcbiAgICAgICAgaWYgKGlzU3RhdGljUmVxdWlyZShub2RlKSkge1xuICAgICAgICAgIHJlcG9ydElmTm9uU3RhbmRhcmQoY29udGV4dCwgbm9kZSwgbm9kZS5hcmd1bWVudHNbMF0udmFsdWUpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfVxuICB9LFxufVxuIl19