'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _containsPath = require('contains-path');

var _containsPath2 = _interopRequireDefault(_containsPath);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-restricted-paths')
    },

    schema: [{
      type: 'object',
      properties: {
        zones: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              target: { type: 'string' },
              from: { type: 'string' }
            },
            additionalProperties: false
          }
        },
        basePath: { type: 'string' }
      },
      additionalProperties: false
    }]
  },

  create: function noRestrictedPaths(context) {
    const options = context.options[0] || {};
    const restrictedPaths = options.zones || [];
    const basePath = options.basePath || process.cwd();
    const currentFilename = context.getFilename();
    const matchingZones = restrictedPaths.filter(zone => {
      const targetPath = _path2.default.resolve(basePath, zone.target);

      return (0, _containsPath2.default)(currentFilename, targetPath);
    });

    function checkForRestrictedImportPath(importPath, node) {
      const absoluteImportPath = (0, _resolve2.default)(importPath, context);

      if (!absoluteImportPath) {
        return;
      }

      matchingZones.forEach(zone => {
        const absoluteFrom = _path2.default.resolve(basePath, zone.from);

        if ((0, _containsPath2.default)(absoluteImportPath, absoluteFrom)) {
          context.report({
            node,
            message: `Unexpected path "${importPath}" imported in restricted zone.`
          });
        }
      });
    }

    return {
      ImportDeclaration(node) {
        checkForRestrictedImportPath(node.source.value, node.source);
      },
      CallExpression(node) {
        if ((0, _staticRequire2.default)(node)) {
          var _node$arguments = _slicedToArray(node.arguments, 1);

          const firstArgument = _node$arguments[0];


          checkForRestrictedImportPath(firstArgument.value, firstArgument);
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLXJlc3RyaWN0ZWQtcGF0aHMuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwic2NoZW1hIiwidHlwZSIsInByb3BlcnRpZXMiLCJ6b25lcyIsIm1pbkl0ZW1zIiwiaXRlbXMiLCJ0YXJnZXQiLCJmcm9tIiwiYWRkaXRpb25hbFByb3BlcnRpZXMiLCJiYXNlUGF0aCIsImNyZWF0ZSIsIm5vUmVzdHJpY3RlZFBhdGhzIiwiY29udGV4dCIsIm9wdGlvbnMiLCJyZXN0cmljdGVkUGF0aHMiLCJwcm9jZXNzIiwiY3dkIiwiY3VycmVudEZpbGVuYW1lIiwiZ2V0RmlsZW5hbWUiLCJtYXRjaGluZ1pvbmVzIiwiZmlsdGVyIiwiem9uZSIsInRhcmdldFBhdGgiLCJwYXRoIiwicmVzb2x2ZSIsImNoZWNrRm9yUmVzdHJpY3RlZEltcG9ydFBhdGgiLCJpbXBvcnRQYXRoIiwibm9kZSIsImFic29sdXRlSW1wb3J0UGF0aCIsImZvckVhY2giLCJhYnNvbHV0ZUZyb20iLCJyZXBvcnQiLCJtZXNzYWdlIiwiSW1wb3J0RGVjbGFyYXRpb24iLCJzb3VyY2UiLCJ2YWx1ZSIsIkNhbGxFeHByZXNzaW9uIiwiYXJndW1lbnRzIiwiZmlyc3RBcmd1bWVudCJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFFQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztBQUVBQSxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFFBQU07QUFDSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLHFCQUFSO0FBREQsS0FERjs7QUFLSkMsWUFBUSxDQUNOO0FBQ0VDLFlBQU0sUUFEUjtBQUVFQyxrQkFBWTtBQUNWQyxlQUFPO0FBQ0xGLGdCQUFNLE9BREQ7QUFFTEcsb0JBQVUsQ0FGTDtBQUdMQyxpQkFBTztBQUNMSixrQkFBTSxRQUREO0FBRUxDLHdCQUFZO0FBQ1ZJLHNCQUFRLEVBQUVMLE1BQU0sUUFBUixFQURFO0FBRVZNLG9CQUFNLEVBQUVOLE1BQU0sUUFBUjtBQUZJLGFBRlA7QUFNTE8sa0NBQXNCO0FBTmpCO0FBSEYsU0FERztBQWFWQyxrQkFBVSxFQUFFUixNQUFNLFFBQVI7QUFiQSxPQUZkO0FBaUJFTyw0QkFBc0I7QUFqQnhCLEtBRE07QUFMSixHQURTOztBQTZCZkUsVUFBUSxTQUFTQyxpQkFBVCxDQUEyQkMsT0FBM0IsRUFBb0M7QUFDMUMsVUFBTUMsVUFBVUQsUUFBUUMsT0FBUixDQUFnQixDQUFoQixLQUFzQixFQUF0QztBQUNBLFVBQU1DLGtCQUFrQkQsUUFBUVYsS0FBUixJQUFpQixFQUF6QztBQUNBLFVBQU1NLFdBQVdJLFFBQVFKLFFBQVIsSUFBb0JNLFFBQVFDLEdBQVIsRUFBckM7QUFDQSxVQUFNQyxrQkFBa0JMLFFBQVFNLFdBQVIsRUFBeEI7QUFDQSxVQUFNQyxnQkFBZ0JMLGdCQUFnQk0sTUFBaEIsQ0FBd0JDLElBQUQsSUFBVTtBQUNyRCxZQUFNQyxhQUFhQyxlQUFLQyxPQUFMLENBQWFmLFFBQWIsRUFBdUJZLEtBQUtmLE1BQTVCLENBQW5COztBQUVBLGFBQU8sNEJBQWFXLGVBQWIsRUFBOEJLLFVBQTlCLENBQVA7QUFDRCxLQUpxQixDQUF0Qjs7QUFNQSxhQUFTRyw0QkFBVCxDQUFzQ0MsVUFBdEMsRUFBa0RDLElBQWxELEVBQXdEO0FBQ3BELFlBQU1DLHFCQUFxQix1QkFBUUYsVUFBUixFQUFvQmQsT0FBcEIsQ0FBM0I7O0FBRUEsVUFBSSxDQUFDZ0Isa0JBQUwsRUFBeUI7QUFDdkI7QUFDRDs7QUFFRFQsb0JBQWNVLE9BQWQsQ0FBdUJSLElBQUQsSUFBVTtBQUM5QixjQUFNUyxlQUFlUCxlQUFLQyxPQUFMLENBQWFmLFFBQWIsRUFBdUJZLEtBQUtkLElBQTVCLENBQXJCOztBQUVBLFlBQUksNEJBQWFxQixrQkFBYixFQUFpQ0UsWUFBakMsQ0FBSixFQUFvRDtBQUNsRGxCLGtCQUFRbUIsTUFBUixDQUFlO0FBQ2JKLGdCQURhO0FBRWJLLHFCQUFVLG9CQUFtQk4sVUFBVztBQUYzQixXQUFmO0FBSUQ7QUFDRixPQVREO0FBVUg7O0FBRUQsV0FBTztBQUNMTyx3QkFBa0JOLElBQWxCLEVBQXdCO0FBQ3RCRixxQ0FBNkJFLEtBQUtPLE1BQUwsQ0FBWUMsS0FBekMsRUFBZ0RSLEtBQUtPLE1BQXJEO0FBQ0QsT0FISTtBQUlMRSxxQkFBZVQsSUFBZixFQUFxQjtBQUNuQixZQUFJLDZCQUFnQkEsSUFBaEIsQ0FBSixFQUEyQjtBQUFBLCtDQUNDQSxLQUFLVSxTQUROOztBQUFBLGdCQUNqQkMsYUFEaUI7OztBQUd6QmIsdUNBQTZCYSxjQUFjSCxLQUEzQyxFQUFrREcsYUFBbEQ7QUFDRDtBQUNGO0FBVkksS0FBUDtBQVlEO0FBdkVjLENBQWpCIiwiZmlsZSI6InJ1bGVzL25vLXJlc3RyaWN0ZWQtcGF0aHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY29udGFpbnNQYXRoIGZyb20gJ2NvbnRhaW5zLXBhdGgnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuXG5pbXBvcnQgcmVzb2x2ZSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL3Jlc29sdmUnXG5pbXBvcnQgaXNTdGF0aWNSZXF1aXJlIGZyb20gJy4uL2NvcmUvc3RhdGljUmVxdWlyZSdcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduby1yZXN0cmljdGVkLXBhdGhzJyksXG4gICAgfSxcblxuICAgIHNjaGVtYTogW1xuICAgICAge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHpvbmVzOiB7XG4gICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgbWluSXRlbXM6IDEsXG4gICAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIHRhcmdldDogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgIGZyb206IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJhc2VQYXRoOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIG5vUmVzdHJpY3RlZFBhdGhzKGNvbnRleHQpIHtcbiAgICBjb25zdCBvcHRpb25zID0gY29udGV4dC5vcHRpb25zWzBdIHx8IHt9XG4gICAgY29uc3QgcmVzdHJpY3RlZFBhdGhzID0gb3B0aW9ucy56b25lcyB8fCBbXVxuICAgIGNvbnN0IGJhc2VQYXRoID0gb3B0aW9ucy5iYXNlUGF0aCB8fCBwcm9jZXNzLmN3ZCgpXG4gICAgY29uc3QgY3VycmVudEZpbGVuYW1lID0gY29udGV4dC5nZXRGaWxlbmFtZSgpXG4gICAgY29uc3QgbWF0Y2hpbmdab25lcyA9IHJlc3RyaWN0ZWRQYXRocy5maWx0ZXIoKHpvbmUpID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBwYXRoLnJlc29sdmUoYmFzZVBhdGgsIHpvbmUudGFyZ2V0KVxuXG4gICAgICByZXR1cm4gY29udGFpbnNQYXRoKGN1cnJlbnRGaWxlbmFtZSwgdGFyZ2V0UGF0aClcbiAgICB9KVxuXG4gICAgZnVuY3Rpb24gY2hlY2tGb3JSZXN0cmljdGVkSW1wb3J0UGF0aChpbXBvcnRQYXRoLCBub2RlKSB7XG4gICAgICAgIGNvbnN0IGFic29sdXRlSW1wb3J0UGF0aCA9IHJlc29sdmUoaW1wb3J0UGF0aCwgY29udGV4dClcblxuICAgICAgICBpZiAoIWFic29sdXRlSW1wb3J0UGF0aCkge1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgbWF0Y2hpbmdab25lcy5mb3JFYWNoKCh6b25lKSA9PiB7XG4gICAgICAgICAgY29uc3QgYWJzb2x1dGVGcm9tID0gcGF0aC5yZXNvbHZlKGJhc2VQYXRoLCB6b25lLmZyb20pXG5cbiAgICAgICAgICBpZiAoY29udGFpbnNQYXRoKGFic29sdXRlSW1wb3J0UGF0aCwgYWJzb2x1dGVGcm9tKSkge1xuICAgICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgICBtZXNzYWdlOiBgVW5leHBlY3RlZCBwYXRoIFwiJHtpbXBvcnRQYXRofVwiIGltcG9ydGVkIGluIHJlc3RyaWN0ZWQgem9uZS5gLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIEltcG9ydERlY2xhcmF0aW9uKG5vZGUpIHtcbiAgICAgICAgY2hlY2tGb3JSZXN0cmljdGVkSW1wb3J0UGF0aChub2RlLnNvdXJjZS52YWx1ZSwgbm9kZS5zb3VyY2UpXG4gICAgICB9LFxuICAgICAgQ2FsbEV4cHJlc3Npb24obm9kZSkge1xuICAgICAgICBpZiAoaXNTdGF0aWNSZXF1aXJlKG5vZGUpKSB7XG4gICAgICAgICAgY29uc3QgWyBmaXJzdEFyZ3VtZW50IF0gPSBub2RlLmFyZ3VtZW50c1xuXG4gICAgICAgICAgY2hlY2tGb3JSZXN0cmljdGVkSW1wb3J0UGF0aChmaXJzdEFyZ3VtZW50LnZhbHVlLCBmaXJzdEFyZ3VtZW50KVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==