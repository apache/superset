'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT_MAX = 10;

const countDependencies = (dependencies, lastNode, context) => {
  var _ref = context.options[0] || { max: DEFAULT_MAX };

  const max = _ref.max;


  if (dependencies.size > max) {
    context.report(lastNode, `Maximum number of dependencies (${max}) exceeded.`);
  }
};

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('max-dependencies')
    },

    schema: [{
      'type': 'object',
      'properties': {
        'max': { 'type': 'number' }
      },
      'additionalProperties': false
    }]
  },

  create: context => {
    const dependencies = new Set(); // keep track of dependencies
    let lastNode; // keep track of the last node to report on

    return {
      ImportDeclaration(node) {
        dependencies.add(node.source.value);
        lastNode = node.source;
      },

      CallExpression(node) {
        if ((0, _staticRequire2.default)(node)) {
          var _node$arguments = _slicedToArray(node.arguments, 1);

          const requirePath = _node$arguments[0];

          dependencies.add(requirePath.value);
          lastNode = node;
        }
      },

      'Program:exit': function () {
        countDependencies(dependencies, lastNode, context);
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL21heC1kZXBlbmRlbmNpZXMuanMiXSwibmFtZXMiOlsiREVGQVVMVF9NQVgiLCJjb3VudERlcGVuZGVuY2llcyIsImRlcGVuZGVuY2llcyIsImxhc3ROb2RlIiwiY29udGV4dCIsIm9wdGlvbnMiLCJtYXgiLCJzaXplIiwicmVwb3J0IiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwic2NoZW1hIiwiY3JlYXRlIiwiU2V0IiwiSW1wb3J0RGVjbGFyYXRpb24iLCJub2RlIiwiYWRkIiwic291cmNlIiwidmFsdWUiLCJDYWxsRXhwcmVzc2lvbiIsImFyZ3VtZW50cyIsInJlcXVpcmVQYXRoIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7Ozs7QUFDQTs7Ozs7O0FBRUEsTUFBTUEsY0FBYyxFQUFwQjs7QUFFQSxNQUFNQyxvQkFBb0IsQ0FBQ0MsWUFBRCxFQUFlQyxRQUFmLEVBQXlCQyxPQUF6QixLQUFxQztBQUFBLGFBQy9DQSxRQUFRQyxPQUFSLENBQWdCLENBQWhCLEtBQXNCLEVBQUVDLEtBQUtOLFdBQVAsRUFEeUI7O0FBQUEsUUFDdERNLEdBRHNELFFBQ3REQSxHQURzRDs7O0FBRzdELE1BQUlKLGFBQWFLLElBQWIsR0FBb0JELEdBQXhCLEVBQTZCO0FBQzNCRixZQUFRSSxNQUFSLENBQ0VMLFFBREYsRUFFRyxtQ0FBa0NHLEdBQUksYUFGekM7QUFJRDtBQUNGLENBVEQ7O0FBV0FHLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKQyxVQUFNO0FBQ0pDLFdBQUssdUJBQVEsa0JBQVI7QUFERCxLQURGOztBQUtKQyxZQUFRLENBQ047QUFDRSxjQUFRLFFBRFY7QUFFRSxvQkFBYztBQUNaLGVBQU8sRUFBRSxRQUFRLFFBQVY7QUFESyxPQUZoQjtBQUtFLDhCQUF3QjtBQUwxQixLQURNO0FBTEosR0FEUzs7QUFpQmZDLFVBQVFYLFdBQVc7QUFDakIsVUFBTUYsZUFBZSxJQUFJYyxHQUFKLEVBQXJCLENBRGlCLENBQ2M7QUFDL0IsUUFBSWIsUUFBSixDQUZpQixDQUVKOztBQUViLFdBQU87QUFDTGMsd0JBQWtCQyxJQUFsQixFQUF3QjtBQUN0QmhCLHFCQUFhaUIsR0FBYixDQUFpQkQsS0FBS0UsTUFBTCxDQUFZQyxLQUE3QjtBQUNBbEIsbUJBQVdlLEtBQUtFLE1BQWhCO0FBQ0QsT0FKSTs7QUFNTEUscUJBQWVKLElBQWYsRUFBcUI7QUFDbkIsWUFBSSw2QkFBZ0JBLElBQWhCLENBQUosRUFBMkI7QUFBQSwrQ0FDREEsS0FBS0ssU0FESjs7QUFBQSxnQkFDakJDLFdBRGlCOztBQUV6QnRCLHVCQUFhaUIsR0FBYixDQUFpQkssWUFBWUgsS0FBN0I7QUFDQWxCLHFCQUFXZSxJQUFYO0FBQ0Q7QUFDRixPQVpJOztBQWNMLHNCQUFnQixZQUFZO0FBQzFCakIsMEJBQWtCQyxZQUFsQixFQUFnQ0MsUUFBaEMsRUFBMENDLE9BQTFDO0FBQ0Q7QUFoQkksS0FBUDtBQWtCRDtBQXZDYyxDQUFqQiIsImZpbGUiOiJydWxlcy9tYXgtZGVwZW5kZW5jaWVzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGlzU3RhdGljUmVxdWlyZSBmcm9tICcuLi9jb3JlL3N0YXRpY1JlcXVpcmUnXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5jb25zdCBERUZBVUxUX01BWCA9IDEwXG5cbmNvbnN0IGNvdW50RGVwZW5kZW5jaWVzID0gKGRlcGVuZGVuY2llcywgbGFzdE5vZGUsIGNvbnRleHQpID0+IHtcbiAgY29uc3Qge21heH0gPSBjb250ZXh0Lm9wdGlvbnNbMF0gfHwgeyBtYXg6IERFRkFVTFRfTUFYIH1cblxuICBpZiAoZGVwZW5kZW5jaWVzLnNpemUgPiBtYXgpIHtcbiAgICBjb250ZXh0LnJlcG9ydChcbiAgICAgIGxhc3ROb2RlLFxuICAgICAgYE1heGltdW0gbnVtYmVyIG9mIGRlcGVuZGVuY2llcyAoJHttYXh9KSBleGNlZWRlZC5gXG4gICAgKVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCdtYXgtZGVwZW5kZW5jaWVzJyksXG4gICAgfSxcblxuICAgIHNjaGVtYTogW1xuICAgICAge1xuICAgICAgICAndHlwZSc6ICdvYmplY3QnLFxuICAgICAgICAncHJvcGVydGllcyc6IHtcbiAgICAgICAgICAnbWF4JzogeyAndHlwZSc6ICdudW1iZXInIH0sXG4gICAgICAgIH0sXG4gICAgICAgICdhZGRpdGlvbmFsUHJvcGVydGllcyc6IGZhbHNlLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxuXG4gIGNyZWF0ZTogY29udGV4dCA9PiB7XG4gICAgY29uc3QgZGVwZW5kZW5jaWVzID0gbmV3IFNldCgpIC8vIGtlZXAgdHJhY2sgb2YgZGVwZW5kZW5jaWVzXG4gICAgbGV0IGxhc3ROb2RlIC8vIGtlZXAgdHJhY2sgb2YgdGhlIGxhc3Qgbm9kZSB0byByZXBvcnQgb25cblxuICAgIHJldHVybiB7XG4gICAgICBJbXBvcnREZWNsYXJhdGlvbihub2RlKSB7XG4gICAgICAgIGRlcGVuZGVuY2llcy5hZGQobm9kZS5zb3VyY2UudmFsdWUpXG4gICAgICAgIGxhc3ROb2RlID0gbm9kZS5zb3VyY2VcbiAgICAgIH0sXG5cbiAgICAgIENhbGxFeHByZXNzaW9uKG5vZGUpIHtcbiAgICAgICAgaWYgKGlzU3RhdGljUmVxdWlyZShub2RlKSkge1xuICAgICAgICAgIGNvbnN0IFsgcmVxdWlyZVBhdGggXSA9IG5vZGUuYXJndW1lbnRzXG4gICAgICAgICAgZGVwZW5kZW5jaWVzLmFkZChyZXF1aXJlUGF0aC52YWx1ZSlcbiAgICAgICAgICBsYXN0Tm9kZSA9IG5vZGVcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgJ1Byb2dyYW06ZXhpdCc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY291bnREZXBlbmRlbmNpZXMoZGVwZW5kZW5jaWVzLCBsYXN0Tm9kZSwgY29udGV4dClcbiAgICAgIH0sXG4gICAgfVxuICB9LFxufVxuIl19