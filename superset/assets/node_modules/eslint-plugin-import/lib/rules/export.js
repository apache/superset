'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _ExportMap = require('../ExportMap');

var _ExportMap2 = _interopRequireDefault(_ExportMap);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('export')
    }
  },

  create: function (context) {
    const named = new Map();

    function addNamed(name, node) {
      let nodes = named.get(name);

      if (nodes == null) {
        nodes = new Set();
        named.set(name, nodes);
      }

      nodes.add(node);
    }

    return {
      'ExportDefaultDeclaration': node => addNamed('default', node),

      'ExportSpecifier': function (node) {
        addNamed(node.exported.name, node.exported);
      },

      'ExportNamedDeclaration': function (node) {
        if (node.declaration == null) return;

        if (node.declaration.id != null) {
          addNamed(node.declaration.id.name, node.declaration.id);
        }

        if (node.declaration.declarations != null) {
          for (let declaration of node.declaration.declarations) {
            (0, _ExportMap.recursivePatternCapture)(declaration.id, v => addNamed(v.name, v));
          }
        }
      },

      'ExportAllDeclaration': function (node) {
        if (node.source == null) return; // not sure if this is ever true

        const remoteExports = _ExportMap2.default.get(node.source.value, context);
        if (remoteExports == null) return;

        if (remoteExports.errors.length) {
          remoteExports.reportErrors(context, node);
          return;
        }
        let any = false;
        remoteExports.forEach((v, name) => name !== 'default' && (any = true) && // poor man's filter
        addNamed(name, node));

        if (!any) {
          context.report(node.source, `No named exports found in module '${node.source.value}'.`);
        }
      },

      'Program:exit': function () {
        for (let _ref of named) {
          var _ref2 = _slicedToArray(_ref, 2);

          let name = _ref2[0];
          let nodes = _ref2[1];

          if (nodes.size <= 1) continue;

          for (let node of nodes) {
            if (name === 'default') {
              context.report(node, 'Multiple default exports.');
            } else context.report(node, `Multiple exports of name '${name}'.`);
          }
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL2V4cG9ydC5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJjb250ZXh0IiwibmFtZWQiLCJNYXAiLCJhZGROYW1lZCIsIm5hbWUiLCJub2RlIiwibm9kZXMiLCJnZXQiLCJTZXQiLCJzZXQiLCJhZGQiLCJleHBvcnRlZCIsImRlY2xhcmF0aW9uIiwiaWQiLCJkZWNsYXJhdGlvbnMiLCJ2Iiwic291cmNlIiwicmVtb3RlRXhwb3J0cyIsIkV4cG9ydE1hcCIsInZhbHVlIiwiZXJyb3JzIiwibGVuZ3RoIiwicmVwb3J0RXJyb3JzIiwiYW55IiwiZm9yRWFjaCIsInJlcG9ydCIsInNpemUiXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7OztBQUNBOzs7Ozs7QUFFQUEsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU07QUFDSkMsV0FBSyx1QkFBUSxRQUFSO0FBREQ7QUFERixHQURTOztBQU9mQyxVQUFRLFVBQVVDLE9BQVYsRUFBbUI7QUFDekIsVUFBTUMsUUFBUSxJQUFJQyxHQUFKLEVBQWQ7O0FBRUEsYUFBU0MsUUFBVCxDQUFrQkMsSUFBbEIsRUFBd0JDLElBQXhCLEVBQThCO0FBQzVCLFVBQUlDLFFBQVFMLE1BQU1NLEdBQU4sQ0FBVUgsSUFBVixDQUFaOztBQUVBLFVBQUlFLFNBQVMsSUFBYixFQUFtQjtBQUNqQkEsZ0JBQVEsSUFBSUUsR0FBSixFQUFSO0FBQ0FQLGNBQU1RLEdBQU4sQ0FBVUwsSUFBVixFQUFnQkUsS0FBaEI7QUFDRDs7QUFFREEsWUFBTUksR0FBTixDQUFVTCxJQUFWO0FBQ0Q7O0FBRUQsV0FBTztBQUNMLGtDQUE2QkEsSUFBRCxJQUFVRixTQUFTLFNBQVQsRUFBb0JFLElBQXBCLENBRGpDOztBQUdMLHlCQUFtQixVQUFVQSxJQUFWLEVBQWdCO0FBQ2pDRixpQkFBU0UsS0FBS00sUUFBTCxDQUFjUCxJQUF2QixFQUE2QkMsS0FBS00sUUFBbEM7QUFDRCxPQUxJOztBQU9MLGdDQUEwQixVQUFVTixJQUFWLEVBQWdCO0FBQ3hDLFlBQUlBLEtBQUtPLFdBQUwsSUFBb0IsSUFBeEIsRUFBOEI7O0FBRTlCLFlBQUlQLEtBQUtPLFdBQUwsQ0FBaUJDLEVBQWpCLElBQXVCLElBQTNCLEVBQWlDO0FBQy9CVixtQkFBU0UsS0FBS08sV0FBTCxDQUFpQkMsRUFBakIsQ0FBb0JULElBQTdCLEVBQW1DQyxLQUFLTyxXQUFMLENBQWlCQyxFQUFwRDtBQUNEOztBQUVELFlBQUlSLEtBQUtPLFdBQUwsQ0FBaUJFLFlBQWpCLElBQWlDLElBQXJDLEVBQTJDO0FBQ3pDLGVBQUssSUFBSUYsV0FBVCxJQUF3QlAsS0FBS08sV0FBTCxDQUFpQkUsWUFBekMsRUFBdUQ7QUFDckQsb0RBQXdCRixZQUFZQyxFQUFwQyxFQUF3Q0UsS0FBS1osU0FBU1ksRUFBRVgsSUFBWCxFQUFpQlcsQ0FBakIsQ0FBN0M7QUFDRDtBQUNGO0FBQ0YsT0FuQkk7O0FBcUJMLDhCQUF3QixVQUFVVixJQUFWLEVBQWdCO0FBQ3RDLFlBQUlBLEtBQUtXLE1BQUwsSUFBZSxJQUFuQixFQUF5QixPQURhLENBQ047O0FBRWhDLGNBQU1DLGdCQUFnQkMsb0JBQVVYLEdBQVYsQ0FBY0YsS0FBS1csTUFBTCxDQUFZRyxLQUExQixFQUFpQ25CLE9BQWpDLENBQXRCO0FBQ0EsWUFBSWlCLGlCQUFpQixJQUFyQixFQUEyQjs7QUFFM0IsWUFBSUEsY0FBY0csTUFBZCxDQUFxQkMsTUFBekIsRUFBaUM7QUFDL0JKLHdCQUFjSyxZQUFkLENBQTJCdEIsT0FBM0IsRUFBb0NLLElBQXBDO0FBQ0E7QUFDRDtBQUNELFlBQUlrQixNQUFNLEtBQVY7QUFDQU4sc0JBQWNPLE9BQWQsQ0FBc0IsQ0FBQ1QsQ0FBRCxFQUFJWCxJQUFKLEtBQ3BCQSxTQUFTLFNBQVQsS0FDQ21CLE1BQU0sSUFEUCxLQUNnQjtBQUNoQnBCLGlCQUFTQyxJQUFULEVBQWVDLElBQWYsQ0FIRjs7QUFLQSxZQUFJLENBQUNrQixHQUFMLEVBQVU7QUFDUnZCLGtCQUFReUIsTUFBUixDQUFlcEIsS0FBS1csTUFBcEIsRUFDRyxxQ0FBb0NYLEtBQUtXLE1BQUwsQ0FBWUcsS0FBTSxJQUR6RDtBQUVEO0FBQ0YsT0F6Q0k7O0FBMkNMLHNCQUFnQixZQUFZO0FBQzFCLHlCQUEwQmxCLEtBQTFCLEVBQWlDO0FBQUE7O0FBQUEsY0FBdkJHLElBQXVCO0FBQUEsY0FBakJFLEtBQWlCOztBQUMvQixjQUFJQSxNQUFNb0IsSUFBTixJQUFjLENBQWxCLEVBQXFCOztBQUVyQixlQUFLLElBQUlyQixJQUFULElBQWlCQyxLQUFqQixFQUF3QjtBQUN0QixnQkFBSUYsU0FBUyxTQUFiLEVBQXdCO0FBQ3RCSixzQkFBUXlCLE1BQVIsQ0FBZXBCLElBQWYsRUFBcUIsMkJBQXJCO0FBQ0QsYUFGRCxNQUVPTCxRQUFReUIsTUFBUixDQUFlcEIsSUFBZixFQUFzQiw2QkFBNEJELElBQUssSUFBdkQ7QUFDUjtBQUNGO0FBQ0Y7QUFyREksS0FBUDtBQXVERDtBQTVFYyxDQUFqQiIsImZpbGUiOiJydWxlcy9leHBvcnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgRXhwb3J0TWFwLCB7IHJlY3Vyc2l2ZVBhdHRlcm5DYXB0dXJlIH0gZnJvbSAnLi4vRXhwb3J0TWFwJ1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ2V4cG9ydCcpLFxuICAgIH0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIGNvbnN0IG5hbWVkID0gbmV3IE1hcCgpXG5cbiAgICBmdW5jdGlvbiBhZGROYW1lZChuYW1lLCBub2RlKSB7XG4gICAgICBsZXQgbm9kZXMgPSBuYW1lZC5nZXQobmFtZSlcblxuICAgICAgaWYgKG5vZGVzID09IG51bGwpIHtcbiAgICAgICAgbm9kZXMgPSBuZXcgU2V0KClcbiAgICAgICAgbmFtZWQuc2V0KG5hbWUsIG5vZGVzKVxuICAgICAgfVxuXG4gICAgICBub2Rlcy5hZGQobm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgJ0V4cG9ydERlZmF1bHREZWNsYXJhdGlvbic6IChub2RlKSA9PiBhZGROYW1lZCgnZGVmYXVsdCcsIG5vZGUpLFxuXG4gICAgICAnRXhwb3J0U3BlY2lmaWVyJzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgYWRkTmFtZWQobm9kZS5leHBvcnRlZC5uYW1lLCBub2RlLmV4cG9ydGVkKVxuICAgICAgfSxcblxuICAgICAgJ0V4cG9ydE5hbWVkRGVjbGFyYXRpb24nOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICBpZiAobm9kZS5kZWNsYXJhdGlvbiA9PSBudWxsKSByZXR1cm5cblxuICAgICAgICBpZiAobm9kZS5kZWNsYXJhdGlvbi5pZCAhPSBudWxsKSB7XG4gICAgICAgICAgYWRkTmFtZWQobm9kZS5kZWNsYXJhdGlvbi5pZC5uYW1lLCBub2RlLmRlY2xhcmF0aW9uLmlkKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuZGVjbGFyYXRpb24uZGVjbGFyYXRpb25zICE9IG51bGwpIHtcbiAgICAgICAgICBmb3IgKGxldCBkZWNsYXJhdGlvbiBvZiBub2RlLmRlY2xhcmF0aW9uLmRlY2xhcmF0aW9ucykge1xuICAgICAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUoZGVjbGFyYXRpb24uaWQsIHYgPT4gYWRkTmFtZWQodi5uYW1lLCB2KSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgICdFeHBvcnRBbGxEZWNsYXJhdGlvbic6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgIGlmIChub2RlLnNvdXJjZSA9PSBudWxsKSByZXR1cm4gLy8gbm90IHN1cmUgaWYgdGhpcyBpcyBldmVyIHRydWVcblxuICAgICAgICBjb25zdCByZW1vdGVFeHBvcnRzID0gRXhwb3J0TWFwLmdldChub2RlLnNvdXJjZS52YWx1ZSwgY29udGV4dClcbiAgICAgICAgaWYgKHJlbW90ZUV4cG9ydHMgPT0gbnVsbCkgcmV0dXJuXG5cbiAgICAgICAgaWYgKHJlbW90ZUV4cG9ydHMuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgIHJlbW90ZUV4cG9ydHMucmVwb3J0RXJyb3JzKGNvbnRleHQsIG5vZGUpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgbGV0IGFueSA9IGZhbHNlXG4gICAgICAgIHJlbW90ZUV4cG9ydHMuZm9yRWFjaCgodiwgbmFtZSkgPT5cbiAgICAgICAgICBuYW1lICE9PSAnZGVmYXVsdCcgJiZcbiAgICAgICAgICAoYW55ID0gdHJ1ZSkgJiYgLy8gcG9vciBtYW4ncyBmaWx0ZXJcbiAgICAgICAgICBhZGROYW1lZChuYW1lLCBub2RlKSlcblxuICAgICAgICBpZiAoIWFueSkge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KG5vZGUuc291cmNlLFxuICAgICAgICAgICAgYE5vIG5hbWVkIGV4cG9ydHMgZm91bmQgaW4gbW9kdWxlICcke25vZGUuc291cmNlLnZhbHVlfScuYClcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgJ1Byb2dyYW06ZXhpdCc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZm9yIChsZXQgW25hbWUsIG5vZGVzXSBvZiBuYW1lZCkge1xuICAgICAgICAgIGlmIChub2Rlcy5zaXplIDw9IDEpIGNvbnRpbnVlXG5cbiAgICAgICAgICBmb3IgKGxldCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICAgICAgICBpZiAobmFtZSA9PT0gJ2RlZmF1bHQnKSB7XG4gICAgICAgICAgICAgIGNvbnRleHQucmVwb3J0KG5vZGUsICdNdWx0aXBsZSBkZWZhdWx0IGV4cG9ydHMuJylcbiAgICAgICAgICAgIH0gZWxzZSBjb250ZXh0LnJlcG9ydChub2RlLCBgTXVsdGlwbGUgZXhwb3J0cyBvZiBuYW1lICcke25hbWV9Jy5gKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9XG4gIH0sXG59XG4iXX0=