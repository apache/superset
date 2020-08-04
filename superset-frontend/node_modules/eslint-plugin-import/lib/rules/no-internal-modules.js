'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _minimatch = require('minimatch');

var _minimatch2 = _interopRequireDefault(_minimatch);

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _importType = require('../core/importType');

var _importType2 = _interopRequireDefault(_importType);

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-internal-modules')
    },

    schema: [{
      type: 'object',
      properties: {
        allow: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      },
      additionalProperties: false
    }]
  },

  create: function noReachingInside(context) {
    const options = context.options[0] || {};
    const allowRegexps = (options.allow || []).map(p => _minimatch2.default.makeRe(p));

    // test if reaching to this destination is allowed
    function reachingAllowed(importPath) {
      return allowRegexps.some(re => re.test(importPath));
    }

    // minimatch patterns are expected to use / path separators, like import
    // statements, so normalize paths to use the same
    function normalizeSep(somePath) {
      return somePath.split('\\').join('/');
    }

    // find a directory that is being reached into, but which shouldn't be
    function isReachViolation(importPath) {
      const steps = normalizeSep(importPath).split('/').reduce((acc, step) => {
        if (!step || step === '.') {
          return acc;
        } else if (step === '..') {
          return acc.slice(0, -1);
        } else {
          return acc.concat(step);
        }
      }, []);

      const nonScopeSteps = steps.filter(step => step.indexOf('@') !== 0);
      if (nonScopeSteps.length <= 1) return false;

      // before trying to resolve, see if the raw import (with relative
      // segments resolved) matches an allowed pattern
      const justSteps = steps.join('/');
      if (reachingAllowed(justSteps) || reachingAllowed(`/${justSteps}`)) return false;

      // if the import statement doesn't match directly, try to match the
      // resolved path if the import is resolvable
      const resolved = (0, _resolve2.default)(importPath, context);
      if (!resolved || reachingAllowed(normalizeSep(resolved))) return false;

      // this import was not allowed by the allowed paths, and reaches
      // so it is a violation
      return true;
    }

    function checkImportForReaching(importPath, node) {
      const potentialViolationTypes = ['parent', 'index', 'sibling', 'external', 'internal'];
      if (potentialViolationTypes.indexOf((0, _importType2.default)(importPath, context)) !== -1 && isReachViolation(importPath)) {
        context.report({
          node,
          message: `Reaching to "${importPath}" is not allowed.`
        });
      }
    }

    return {
      ImportDeclaration(node) {
        checkImportForReaching(node.source.value, node.source);
      },
      CallExpression(node) {
        if ((0, _staticRequire2.default)(node)) {
          var _node$arguments = _slicedToArray(node.arguments, 1);

          const firstArgument = _node$arguments[0];

          checkImportForReaching(firstArgument.value, firstArgument);
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLWludGVybmFsLW1vZHVsZXMuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwic2NoZW1hIiwidHlwZSIsInByb3BlcnRpZXMiLCJhbGxvdyIsIml0ZW1zIiwiYWRkaXRpb25hbFByb3BlcnRpZXMiLCJjcmVhdGUiLCJub1JlYWNoaW5nSW5zaWRlIiwiY29udGV4dCIsIm9wdGlvbnMiLCJhbGxvd1JlZ2V4cHMiLCJtYXAiLCJwIiwibWluaW1hdGNoIiwibWFrZVJlIiwicmVhY2hpbmdBbGxvd2VkIiwiaW1wb3J0UGF0aCIsInNvbWUiLCJyZSIsInRlc3QiLCJub3JtYWxpemVTZXAiLCJzb21lUGF0aCIsInNwbGl0Iiwiam9pbiIsImlzUmVhY2hWaW9sYXRpb24iLCJzdGVwcyIsInJlZHVjZSIsImFjYyIsInN0ZXAiLCJzbGljZSIsImNvbmNhdCIsIm5vblNjb3BlU3RlcHMiLCJmaWx0ZXIiLCJpbmRleE9mIiwibGVuZ3RoIiwianVzdFN0ZXBzIiwicmVzb2x2ZWQiLCJjaGVja0ltcG9ydEZvclJlYWNoaW5nIiwibm9kZSIsInBvdGVudGlhbFZpb2xhdGlvblR5cGVzIiwicmVwb3J0IiwibWVzc2FnZSIsIkltcG9ydERlY2xhcmF0aW9uIiwic291cmNlIiwidmFsdWUiLCJDYWxsRXhwcmVzc2lvbiIsImFyZ3VtZW50cyIsImZpcnN0QXJndW1lbnQiXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7OztBQUVBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7QUFFQUEsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU07QUFDSkMsV0FBSyx1QkFBUSxxQkFBUjtBQURELEtBREY7O0FBS0pDLFlBQVEsQ0FDTjtBQUNFQyxZQUFNLFFBRFI7QUFFRUMsa0JBQVk7QUFDVkMsZUFBTztBQUNMRixnQkFBTSxPQUREO0FBRUxHLGlCQUFPO0FBQ0xILGtCQUFNO0FBREQ7QUFGRjtBQURHLE9B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LGdCQUNqQkMsYUFEaUI7O0FBRXpCVixpQ0FBdUJVLGNBQWNILEtBQXJDLEVBQTRDRyxhQUE1QztBQUNEO0FBQ0Y7QUFUSSxLQUFQO0FBV0Q7QUE1RmMsQ0FBakIiLCJmaWxlIjoicnVsZXMvbm8taW50ZXJuYWwtbW9kdWxlcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtaW5pbWF0Y2ggZnJvbSAnbWluaW1hdGNoJ1xuXG5pbXBvcnQgcmVzb2x2ZSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL3Jlc29sdmUnXG5pbXBvcnQgaW1wb3J0VHlwZSBmcm9tICcuLi9jb3JlL2ltcG9ydFR5cGUnXG5pbXBvcnQgaXNTdGF0aWNSZXF1aXJlIGZyb20gJy4uL2NvcmUvc3RhdGljUmVxdWlyZSdcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduby1pbnRlcm5hbC1tb2R1bGVzJyksXG4gICAgfSxcblxuICAgIHNjaGVtYTogW1xuICAgICAge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIGFsbG93OiB7XG4gICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIG5vUmVhY2hpbmdJbnNpZGUoY29udGV4dCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBjb250ZXh0Lm9wdGlvbnNbMF0gfHwge31cbiAgICBjb25zdCBhbGxvd1JlZ2V4cHMgPSAob3B0aW9ucy5hbGxvdyB8fCBbXSkubWFwKHAgPT4gbWluaW1hdGNoLm1ha2VSZShwKSlcblxuICAgIC8vIHRlc3QgaWYgcmVhY2hpbmcgdG8gdGhpcyBkZXN0aW5hdGlvbiBpcyBhbGxvd2VkXG4gICAgZnVuY3Rpb24gcmVhY2hpbmdBbGxvd2VkKGltcG9ydFBhdGgpIHtcbiAgICAgIHJldHVybiBhbGxvd1JlZ2V4cHMuc29tZShyZSA9PiByZS50ZXN0KGltcG9ydFBhdGgpKVxuICAgIH1cblxuICAgIC8vIG1pbmltYXRjaCBwYXR0ZXJucyBhcmUgZXhwZWN0ZWQgdG8gdXNlIC8gcGF0aCBzZXBhcmF0b3JzLCBsaWtlIGltcG9ydFxuICAgIC8vIHN0YXRlbWVudHMsIHNvIG5vcm1hbGl6ZSBwYXRocyB0byB1c2UgdGhlIHNhbWVcbiAgICBmdW5jdGlvbiBub3JtYWxpemVTZXAoc29tZVBhdGgpIHtcbiAgICAgIHJldHVybiBzb21lUGF0aC5zcGxpdCgnXFxcXCcpLmpvaW4oJy8nKVxuICAgIH1cblxuICAgIC8vIGZpbmQgYSBkaXJlY3RvcnkgdGhhdCBpcyBiZWluZyByZWFjaGVkIGludG8sIGJ1dCB3aGljaCBzaG91bGRuJ3QgYmVcbiAgICBmdW5jdGlvbiBpc1JlYWNoVmlvbGF0aW9uKGltcG9ydFBhdGgpIHtcbiAgICAgIGNvbnN0IHN0ZXBzID0gbm9ybWFsaXplU2VwKGltcG9ydFBhdGgpXG4gICAgICAgIC5zcGxpdCgnLycpXG4gICAgICAgIC5yZWR1Y2UoKGFjYywgc3RlcCkgPT4ge1xuICAgICAgICAgIGlmICghc3RlcCB8fCBzdGVwID09PSAnLicpIHtcbiAgICAgICAgICAgIHJldHVybiBhY2NcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0ZXAgPT09ICcuLicpIHtcbiAgICAgICAgICAgIHJldHVybiBhY2Muc2xpY2UoMCwgLTEpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBhY2MuY29uY2F0KHN0ZXApXG4gICAgICAgICAgfVxuICAgICAgICB9LCBbXSlcblxuICAgICAgY29uc3Qgbm9uU2NvcGVTdGVwcyA9IHN0ZXBzLmZpbHRlcihzdGVwID0+IHN0ZXAuaW5kZXhPZignQCcpICE9PSAwKVxuICAgICAgaWYgKG5vblNjb3BlU3RlcHMubGVuZ3RoIDw9IDEpIHJldHVybiBmYWxzZVxuXG4gICAgICAvLyBiZWZvcmUgdHJ5aW5nIHRvIHJlc29sdmUsIHNlZSBpZiB0aGUgcmF3IGltcG9ydCAod2l0aCByZWxhdGl2ZVxuICAgICAgLy8gc2VnbWVudHMgcmVzb2x2ZWQpIG1hdGNoZXMgYW4gYWxsb3dlZCBwYXR0ZXJuXG4gICAgICBjb25zdCBqdXN0U3RlcHMgPSBzdGVwcy5qb2luKCcvJylcbiAgICAgIGlmIChyZWFjaGluZ0FsbG93ZWQoanVzdFN0ZXBzKSB8fCByZWFjaGluZ0FsbG93ZWQoYC8ke2p1c3RTdGVwc31gKSkgcmV0dXJuIGZhbHNlXG5cbiAgICAgIC8vIGlmIHRoZSBpbXBvcnQgc3RhdGVtZW50IGRvZXNuJ3QgbWF0Y2ggZGlyZWN0bHksIHRyeSB0byBtYXRjaCB0aGVcbiAgICAgIC8vIHJlc29sdmVkIHBhdGggaWYgdGhlIGltcG9ydCBpcyByZXNvbHZhYmxlXG4gICAgICBjb25zdCByZXNvbHZlZCA9IHJlc29sdmUoaW1wb3J0UGF0aCwgY29udGV4dClcbiAgICAgIGlmICghcmVzb2x2ZWQgfHwgcmVhY2hpbmdBbGxvd2VkKG5vcm1hbGl6ZVNlcChyZXNvbHZlZCkpKSByZXR1cm4gZmFsc2VcblxuICAgICAgLy8gdGhpcyBpbXBvcnQgd2FzIG5vdCBhbGxvd2VkIGJ5IHRoZSBhbGxvd2VkIHBhdGhzLCBhbmQgcmVhY2hlc1xuICAgICAgLy8gc28gaXQgaXMgYSB2aW9sYXRpb25cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2hlY2tJbXBvcnRGb3JSZWFjaGluZyhpbXBvcnRQYXRoLCBub2RlKSB7XG4gICAgICBjb25zdCBwb3RlbnRpYWxWaW9sYXRpb25UeXBlcyA9IFsncGFyZW50JywgJ2luZGV4JywgJ3NpYmxpbmcnLCAnZXh0ZXJuYWwnLCAnaW50ZXJuYWwnXVxuICAgICAgaWYgKHBvdGVudGlhbFZpb2xhdGlvblR5cGVzLmluZGV4T2YoaW1wb3J0VHlwZShpbXBvcnRQYXRoLCBjb250ZXh0KSkgIT09IC0xICYmXG4gICAgICAgIGlzUmVhY2hWaW9sYXRpb24oaW1wb3J0UGF0aClcbiAgICAgICkge1xuICAgICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgICAgbm9kZSxcbiAgICAgICAgICBtZXNzYWdlOiBgUmVhY2hpbmcgdG8gXCIke2ltcG9ydFBhdGh9XCIgaXMgbm90IGFsbG93ZWQuYCxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgSW1wb3J0RGVjbGFyYXRpb24obm9kZSkge1xuICAgICAgICBjaGVja0ltcG9ydEZvclJlYWNoaW5nKG5vZGUuc291cmNlLnZhbHVlLCBub2RlLnNvdXJjZSlcbiAgICAgIH0sXG4gICAgICBDYWxsRXhwcmVzc2lvbihub2RlKSB7XG4gICAgICAgIGlmIChpc1N0YXRpY1JlcXVpcmUobm9kZSkpIHtcbiAgICAgICAgICBjb25zdCBbIGZpcnN0QXJndW1lbnQgXSA9IG5vZGUuYXJndW1lbnRzXG4gICAgICAgICAgY2hlY2tJbXBvcnRGb3JSZWFjaGluZyhmaXJzdEFyZ3VtZW50LnZhbHVlLCBmaXJzdEFyZ3VtZW50KVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==