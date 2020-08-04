'use strict';

var _moduleVisitor = require('eslint-module-utils/moduleVisitor');

var _moduleVisitor2 = _interopRequireDefault(_moduleVisitor);

var _importType = require('../core/importType');

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-absolute-path')
    },
    schema: [(0, _moduleVisitor.makeOptionsSchema)()]
  },

  create: function (context) {
    function reportIfAbsolute(source) {
      if ((0, _importType.isAbsolute)(source.value)) {
        context.report(source, 'Do not import modules using an absolute path');
      }
    }

    const options = Object.assign({ esmodule: true, commonjs: true }, context.options[0]);
    return (0, _moduleVisitor2.default)(reportIfAbsolute, options);
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLWFic29sdXRlLXBhdGguanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwic2NoZW1hIiwiY3JlYXRlIiwiY29udGV4dCIsInJlcG9ydElmQWJzb2x1dGUiLCJzb3VyY2UiLCJ2YWx1ZSIsInJlcG9ydCIsIm9wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJlc21vZHVsZSIsImNvbW1vbmpzIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7O0FBQ0E7O0FBQ0E7Ozs7OztBQUVBQSxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFFBQU07QUFDSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLGtCQUFSO0FBREQsS0FERjtBQUlKQyxZQUFRLENBQUUsdUNBQUY7QUFKSixHQURTOztBQVFmQyxVQUFRLFVBQVVDLE9BQVYsRUFBbUI7QUFDekIsYUFBU0MsZ0JBQVQsQ0FBMEJDLE1BQTFCLEVBQWtDO0FBQ2hDLFVBQUksNEJBQVdBLE9BQU9DLEtBQWxCLENBQUosRUFBOEI7QUFDNUJILGdCQUFRSSxNQUFSLENBQWVGLE1BQWYsRUFBdUIsOENBQXZCO0FBQ0Q7QUFDRjs7QUFFRCxVQUFNRyxVQUFVQyxPQUFPQyxNQUFQLENBQWMsRUFBRUMsVUFBVSxJQUFaLEVBQWtCQyxVQUFVLElBQTVCLEVBQWQsRUFBa0RULFFBQVFLLE9BQVIsQ0FBZ0IsQ0FBaEIsQ0FBbEQsQ0FBaEI7QUFDQSxXQUFPLDZCQUFjSixnQkFBZCxFQUFnQ0ksT0FBaEMsQ0FBUDtBQUNEO0FBakJjLENBQWpCIiwiZmlsZSI6InJ1bGVzL25vLWFic29sdXRlLXBhdGguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbW9kdWxlVmlzaXRvciwgeyBtYWtlT3B0aW9uc1NjaGVtYSB9IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvbW9kdWxlVmlzaXRvcidcbmltcG9ydCB7IGlzQWJzb2x1dGUgfSBmcm9tICcuLi9jb3JlL2ltcG9ydFR5cGUnXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIGRvY3M6IHtcbiAgICAgIHVybDogZG9jc1VybCgnbm8tYWJzb2x1dGUtcGF0aCcpLFxuICAgIH0sXG4gICAgc2NoZW1hOiBbIG1ha2VPcHRpb25zU2NoZW1hKCkgXSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgZnVuY3Rpb24gcmVwb3J0SWZBYnNvbHV0ZShzb3VyY2UpIHtcbiAgICAgIGlmIChpc0Fic29sdXRlKHNvdXJjZS52YWx1ZSkpIHtcbiAgICAgICAgY29udGV4dC5yZXBvcnQoc291cmNlLCAnRG8gbm90IGltcG9ydCBtb2R1bGVzIHVzaW5nIGFuIGFic29sdXRlIHBhdGgnKVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHsgZXNtb2R1bGU6IHRydWUsIGNvbW1vbmpzOiB0cnVlIH0sIGNvbnRleHQub3B0aW9uc1swXSlcbiAgICByZXR1cm4gbW9kdWxlVmlzaXRvcihyZXBvcnRJZkFic29sdXRlLCBvcHRpb25zKVxuICB9LFxufVxuIl19