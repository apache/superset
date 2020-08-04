'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function checkImports(imported, context) {
  for (let _ref of imported.entries()) {
    var _ref2 = _slicedToArray(_ref, 2);

    let module = _ref2[0];
    let nodes = _ref2[1];

    if (nodes.size > 1) {
      for (let node of nodes) {
        context.report(node, `'${module}' imported multiple times.`);
      }
    }
  }
}

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-duplicates')
    }
  },

  create: function (context) {
    const imported = new Map();
    const typesImported = new Map();
    return {
      'ImportDeclaration': function (n) {
        // resolved path will cover aliased duplicates
        const resolvedPath = (0, _resolve2.default)(n.source.value, context) || n.source.value;
        const importMap = n.importKind === 'type' ? typesImported : imported;

        if (importMap.has(resolvedPath)) {
          importMap.get(resolvedPath).add(n.source);
        } else {
          importMap.set(resolvedPath, new Set([n.source]));
        }
      },

      'Program:exit': function () {
        checkImports(imported, context);
        checkImports(typesImported, context);
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLWR1cGxpY2F0ZXMuanMiXSwibmFtZXMiOlsiY2hlY2tJbXBvcnRzIiwiaW1wb3J0ZWQiLCJjb250ZXh0IiwiZW50cmllcyIsIm1vZHVsZSIsIm5vZGVzIiwic2l6ZSIsIm5vZGUiLCJyZXBvcnQiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJNYXAiLCJ0eXBlc0ltcG9ydGVkIiwibiIsInJlc29sdmVkUGF0aCIsInNvdXJjZSIsInZhbHVlIiwiaW1wb3J0TWFwIiwiaW1wb3J0S2luZCIsImhhcyIsImdldCIsImFkZCIsInNldCIsIlNldCJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOzs7O0FBQ0E7Ozs7OztBQUVBLFNBQVNBLFlBQVQsQ0FBc0JDLFFBQXRCLEVBQWdDQyxPQUFoQyxFQUF5QztBQUN2QyxtQkFBNEJELFNBQVNFLE9BQVQsRUFBNUIsRUFBZ0Q7QUFBQTs7QUFBQSxRQUF0Q0MsTUFBc0M7QUFBQSxRQUE5QkMsS0FBOEI7O0FBQzlDLFFBQUlBLE1BQU1DLElBQU4sR0FBYSxDQUFqQixFQUFvQjtBQUNsQixXQUFLLElBQUlDLElBQVQsSUFBaUJGLEtBQWpCLEVBQXdCO0FBQ3RCSCxnQkFBUU0sTUFBUixDQUFlRCxJQUFmLEVBQXNCLElBQUdILE1BQU8sNEJBQWhDO0FBQ0Q7QUFDRjtBQUNGO0FBQ0Y7O0FBRURBLE9BQU9LLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKQyxVQUFNO0FBQ0pDLFdBQUssdUJBQVEsZUFBUjtBQUREO0FBREYsR0FEUzs7QUFPZkMsVUFBUSxVQUFVWCxPQUFWLEVBQW1CO0FBQ3pCLFVBQU1ELFdBQVcsSUFBSWEsR0FBSixFQUFqQjtBQUNBLFVBQU1DLGdCQUFnQixJQUFJRCxHQUFKLEVBQXRCO0FBQ0EsV0FBTztBQUNMLDJCQUFxQixVQUFVRSxDQUFWLEVBQWE7QUFDaEM7QUFDQSxjQUFNQyxlQUFlLHVCQUFRRCxFQUFFRSxNQUFGLENBQVNDLEtBQWpCLEVBQXdCakIsT0FBeEIsS0FBb0NjLEVBQUVFLE1BQUYsQ0FBU0MsS0FBbEU7QUFDQSxjQUFNQyxZQUFZSixFQUFFSyxVQUFGLEtBQWlCLE1BQWpCLEdBQTBCTixhQUExQixHQUEwQ2QsUUFBNUQ7O0FBRUEsWUFBSW1CLFVBQVVFLEdBQVYsQ0FBY0wsWUFBZCxDQUFKLEVBQWlDO0FBQy9CRyxvQkFBVUcsR0FBVixDQUFjTixZQUFkLEVBQTRCTyxHQUE1QixDQUFnQ1IsRUFBRUUsTUFBbEM7QUFDRCxTQUZELE1BRU87QUFDTEUsb0JBQVVLLEdBQVYsQ0FBY1IsWUFBZCxFQUE0QixJQUFJUyxHQUFKLENBQVEsQ0FBQ1YsRUFBRUUsTUFBSCxDQUFSLENBQTVCO0FBQ0Q7QUFDRixPQVhJOztBQWFMLHNCQUFnQixZQUFZO0FBQzFCbEIscUJBQWFDLFFBQWIsRUFBdUJDLE9BQXZCO0FBQ0FGLHFCQUFhZSxhQUFiLEVBQTRCYixPQUE1QjtBQUNEO0FBaEJJLEtBQVA7QUFrQkQ7QUE1QmMsQ0FBakIiLCJmaWxlIjoicnVsZXMvbm8tZHVwbGljYXRlcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCByZXNvbHZlIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvcmVzb2x2ZSdcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbmZ1bmN0aW9uIGNoZWNrSW1wb3J0cyhpbXBvcnRlZCwgY29udGV4dCkge1xuICBmb3IgKGxldCBbbW9kdWxlLCBub2Rlc10gb2YgaW1wb3J0ZWQuZW50cmllcygpKSB7XG4gICAgaWYgKG5vZGVzLnNpemUgPiAxKSB7XG4gICAgICBmb3IgKGxldCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICAgIGNvbnRleHQucmVwb3J0KG5vZGUsIGAnJHttb2R1bGV9JyBpbXBvcnRlZCBtdWx0aXBsZSB0aW1lcy5gKVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIGRvY3M6IHtcbiAgICAgIHVybDogZG9jc1VybCgnbm8tZHVwbGljYXRlcycpLFxuICAgIH0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIGNvbnN0IGltcG9ydGVkID0gbmV3IE1hcCgpXG4gICAgY29uc3QgdHlwZXNJbXBvcnRlZCA9IG5ldyBNYXAoKVxuICAgIHJldHVybiB7XG4gICAgICAnSW1wb3J0RGVjbGFyYXRpb24nOiBmdW5jdGlvbiAobikge1xuICAgICAgICAvLyByZXNvbHZlZCBwYXRoIHdpbGwgY292ZXIgYWxpYXNlZCBkdXBsaWNhdGVzXG4gICAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHJlc29sdmUobi5zb3VyY2UudmFsdWUsIGNvbnRleHQpIHx8IG4uc291cmNlLnZhbHVlXG4gICAgICAgIGNvbnN0IGltcG9ydE1hcCA9IG4uaW1wb3J0S2luZCA9PT0gJ3R5cGUnID8gdHlwZXNJbXBvcnRlZCA6IGltcG9ydGVkXG5cbiAgICAgICAgaWYgKGltcG9ydE1hcC5oYXMocmVzb2x2ZWRQYXRoKSkge1xuICAgICAgICAgIGltcG9ydE1hcC5nZXQocmVzb2x2ZWRQYXRoKS5hZGQobi5zb3VyY2UpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW1wb3J0TWFwLnNldChyZXNvbHZlZFBhdGgsIG5ldyBTZXQoW24uc291cmNlXSkpXG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgICdQcm9ncmFtOmV4aXQnOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNoZWNrSW1wb3J0cyhpbXBvcnRlZCwgY29udGV4dClcbiAgICAgICAgY2hlY2tJbXBvcnRzKHR5cGVzSW1wb3J0ZWQsIGNvbnRleHQpXG4gICAgICB9LFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==