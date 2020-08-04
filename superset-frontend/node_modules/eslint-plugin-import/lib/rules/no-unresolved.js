'use strict';

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _ModuleCache = require('eslint-module-utils/ModuleCache');

var _ModuleCache2 = _interopRequireDefault(_ModuleCache);

var _moduleVisitor = require('eslint-module-utils/moduleVisitor');

var _moduleVisitor2 = _interopRequireDefault(_moduleVisitor);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @fileOverview Ensures that an imported path exists, given resolution rules.
 * @author Ben Mosher
 */

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-unresolved')
    },

    schema: [(0, _moduleVisitor.makeOptionsSchema)({
      caseSensitive: { type: 'boolean', default: true }
    })]
  },

  create: function (context) {

    function checkSourceValue(source) {
      const shouldCheckCase = !_resolve.CASE_SENSITIVE_FS && (!context.options[0] || context.options[0].caseSensitive !== false);

      const resolvedPath = (0, _resolve2.default)(source.value, context);

      if (resolvedPath === undefined) {
        context.report(source, `Unable to resolve path to module '${source.value}'.`);
      } else if (shouldCheckCase) {
        const cacheSettings = _ModuleCache2.default.getSettings(context.settings);
        if (!(0, _resolve.fileExistsWithCaseSync)(resolvedPath, cacheSettings)) {
          context.report(source, `Casing of ${source.value} does not match the underlying filesystem.`);
        }
      }
    }

    return (0, _moduleVisitor2.default)(checkSourceValue, context.options[0]);
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLXVucmVzb2x2ZWQuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwic2NoZW1hIiwiY2FzZVNlbnNpdGl2ZSIsInR5cGUiLCJkZWZhdWx0IiwiY3JlYXRlIiwiY29udGV4dCIsImNoZWNrU291cmNlVmFsdWUiLCJzb3VyY2UiLCJzaG91bGRDaGVja0Nhc2UiLCJDQVNFX1NFTlNJVElWRV9GUyIsIm9wdGlvbnMiLCJyZXNvbHZlZFBhdGgiLCJ2YWx1ZSIsInVuZGVmaW5lZCIsInJlcG9ydCIsImNhY2hlU2V0dGluZ3MiLCJNb2R1bGVDYWNoZSIsImdldFNldHRpbmdzIiwic2V0dGluZ3MiXSwibWFwcGluZ3MiOiI7O0FBS0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztBQVJBOzs7OztBQVVBQSxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFFBQU07QUFDSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLGVBQVI7QUFERCxLQURGOztBQUtKQyxZQUFRLENBQUUsc0NBQWtCO0FBQzFCQyxxQkFBZSxFQUFFQyxNQUFNLFNBQVIsRUFBbUJDLFNBQVMsSUFBNUI7QUFEVyxLQUFsQixDQUFGO0FBTEosR0FEUzs7QUFXZkMsVUFBUSxVQUFVQyxPQUFWLEVBQW1COztBQUV6QixhQUFTQyxnQkFBVCxDQUEwQkMsTUFBMUIsRUFBa0M7QUFDaEMsWUFBTUMsa0JBQWtCLENBQUNDLDBCQUFELEtBQ3JCLENBQUNKLFFBQVFLLE9BQVIsQ0FBZ0IsQ0FBaEIsQ0FBRCxJQUF1QkwsUUFBUUssT0FBUixDQUFnQixDQUFoQixFQUFtQlQsYUFBbkIsS0FBcUMsS0FEdkMsQ0FBeEI7O0FBR0EsWUFBTVUsZUFBZSx1QkFBUUosT0FBT0ssS0FBZixFQUFzQlAsT0FBdEIsQ0FBckI7O0FBRUEsVUFBSU0saUJBQWlCRSxTQUFyQixFQUFnQztBQUM5QlIsZ0JBQVFTLE1BQVIsQ0FBZVAsTUFBZixFQUNHLHFDQUFvQ0EsT0FBT0ssS0FBTSxJQURwRDtBQUVELE9BSEQsTUFLSyxJQUFJSixlQUFKLEVBQXFCO0FBQ3hCLGNBQU1PLGdCQUFnQkMsc0JBQVlDLFdBQVosQ0FBd0JaLFFBQVFhLFFBQWhDLENBQXRCO0FBQ0EsWUFBSSxDQUFDLHFDQUF1QlAsWUFBdkIsRUFBcUNJLGFBQXJDLENBQUwsRUFBMEQ7QUFDeERWLGtCQUFRUyxNQUFSLENBQWVQLE1BQWYsRUFDRyxhQUFZQSxPQUFPSyxLQUFNLDRDQUQ1QjtBQUVEO0FBRUY7QUFDRjs7QUFFRCxXQUFPLDZCQUFjTixnQkFBZCxFQUFnQ0QsUUFBUUssT0FBUixDQUFnQixDQUFoQixDQUFoQyxDQUFQO0FBRUQ7QUFwQ2MsQ0FBakIiLCJmaWxlIjoicnVsZXMvbm8tdW5yZXNvbHZlZC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGVPdmVydmlldyBFbnN1cmVzIHRoYXQgYW4gaW1wb3J0ZWQgcGF0aCBleGlzdHMsIGdpdmVuIHJlc29sdXRpb24gcnVsZXMuXG4gKiBAYXV0aG9yIEJlbiBNb3NoZXJcbiAqL1xuXG5pbXBvcnQgcmVzb2x2ZSwgeyBDQVNFX1NFTlNJVElWRV9GUywgZmlsZUV4aXN0c1dpdGhDYXNlU3luYyB9IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvcmVzb2x2ZSdcbmltcG9ydCBNb2R1bGVDYWNoZSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL01vZHVsZUNhY2hlJ1xuaW1wb3J0IG1vZHVsZVZpc2l0b3IsIHsgbWFrZU9wdGlvbnNTY2hlbWEgfSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL21vZHVsZVZpc2l0b3InXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIGRvY3M6IHtcbiAgICAgIHVybDogZG9jc1VybCgnbm8tdW5yZXNvbHZlZCcpLFxuICAgIH0sXG5cbiAgICBzY2hlbWE6IFsgbWFrZU9wdGlvbnNTY2hlbWEoe1xuICAgICAgY2FzZVNlbnNpdGl2ZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICB9KV0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuXG4gICAgZnVuY3Rpb24gY2hlY2tTb3VyY2VWYWx1ZShzb3VyY2UpIHtcbiAgICAgIGNvbnN0IHNob3VsZENoZWNrQ2FzZSA9ICFDQVNFX1NFTlNJVElWRV9GUyAmJlxuICAgICAgICAoIWNvbnRleHQub3B0aW9uc1swXSB8fCBjb250ZXh0Lm9wdGlvbnNbMF0uY2FzZVNlbnNpdGl2ZSAhPT0gZmFsc2UpXG5cbiAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHJlc29sdmUoc291cmNlLnZhbHVlLCBjb250ZXh0KVxuXG4gICAgICBpZiAocmVzb2x2ZWRQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29udGV4dC5yZXBvcnQoc291cmNlLFxuICAgICAgICAgIGBVbmFibGUgdG8gcmVzb2x2ZSBwYXRoIHRvIG1vZHVsZSAnJHtzb3VyY2UudmFsdWV9Jy5gKVxuICAgICAgfVxuXG4gICAgICBlbHNlIGlmIChzaG91bGRDaGVja0Nhc2UpIHtcbiAgICAgICAgY29uc3QgY2FjaGVTZXR0aW5ncyA9IE1vZHVsZUNhY2hlLmdldFNldHRpbmdzKGNvbnRleHQuc2V0dGluZ3MpXG4gICAgICAgIGlmICghZmlsZUV4aXN0c1dpdGhDYXNlU3luYyhyZXNvbHZlZFBhdGgsIGNhY2hlU2V0dGluZ3MpKSB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQoc291cmNlLFxuICAgICAgICAgICAgYENhc2luZyBvZiAke3NvdXJjZS52YWx1ZX0gZG9lcyBub3QgbWF0Y2ggdGhlIHVuZGVybHlpbmcgZmlsZXN5c3RlbS5gKVxuICAgICAgICB9XG5cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kdWxlVmlzaXRvcihjaGVja1NvdXJjZVZhbHVlLCBjb250ZXh0Lm9wdGlvbnNbMF0pXG5cbiAgfSxcbn1cbiJdfQ==