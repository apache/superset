'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('dynamic-import-chunkname')
    },
    schema: [{
      type: 'object',
      properties: {
        importFunctions: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string'
          }
        },
        webpackChunknameFormat: {
          type: 'string'
        }
      }
    }]
  },

  create: function (context) {
    const config = context.options[0];

    var _ref = config || {},
        _ref$importFunctions = _ref.importFunctions;

    const importFunctions = _ref$importFunctions === undefined ? [] : _ref$importFunctions;

    var _ref2 = config || {},
        _ref2$webpackChunknam = _ref2.webpackChunknameFormat;

    const webpackChunknameFormat = _ref2$webpackChunknam === undefined ? '[0-9a-zA-Z-_/.]+' : _ref2$webpackChunknam;


    const commentFormat = ` webpackChunkName: "${webpackChunknameFormat}" `;
    const commentRegex = new RegExp(commentFormat);

    return {
      CallExpression(node) {
        if (node.callee.type !== 'Import' && importFunctions.indexOf(node.callee.name) < 0) {
          return;
        }

        const sourceCode = context.getSourceCode();
        const arg = node.arguments[0];
        const leadingComments = sourceCode.getComments(arg).leading;

        if (!leadingComments || leadingComments.length !== 1) {
          context.report({
            node,
            message: 'dynamic imports require a leading comment with the webpack chunkname'
          });
          return;
        }

        const comment = leadingComments[0];
        if (comment.type !== 'Block') {
          context.report({
            node,
            message: 'dynamic imports require a /* foo */ style comment, not a // foo comment'
          });
          return;
        }

        const webpackChunkDefinition = comment.value;
        if (!webpackChunkDefinition.match(commentRegex)) {
          context.report({
            node,
            message: `dynamic imports require a leading comment in the form /*${commentFormat}*/`
          });
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL2R5bmFtaWMtaW1wb3J0LWNodW5rbmFtZS5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJzY2hlbWEiLCJ0eXBlIiwicHJvcGVydGllcyIsImltcG9ydEZ1bmN0aW9ucyIsInVuaXF1ZUl0ZW1zIiwiaXRlbXMiLCJ3ZWJwYWNrQ2h1bmtuYW1lRm9ybWF0IiwiY3JlYXRlIiwiY29udGV4dCIsImNvbmZpZyIsIm9wdGlvbnMiLCJjb21tZW50Rm9ybWF0IiwiY29tbWVudFJlZ2V4IiwiUmVnRXhwIiwiQ2FsbEV4cHJlc3Npb24iLCJub2RlIiwiY2FsbGVlIiwiaW5kZXhPZiIsIm5hbWUiLCJzb3VyY2VDb2RlIiwiZ2V0U291cmNlQ29kZSIsImFyZyIsImFyZ3VtZW50cyIsImxlYWRpbmdDb21tZW50cyIsImdldENvbW1lbnRzIiwibGVhZGluZyIsImxlbmd0aCIsInJlcG9ydCIsIm1lc3NhZ2UiLCJjb21tZW50Iiwid2VicGFja0NodW5rRGVmaW5pdGlvbiIsInZhbHVlIiwibWF0Y2giXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztBQUVBQSxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFFBQU07QUFDSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLDBCQUFSO0FBREQsS0FERjtBQUlKQyxZQUFRLENBQUM7QUFDUEMsWUFBTSxRQURDO0FBRVBDLGtCQUFZO0FBQ1ZDLHlCQUFpQjtBQUNmRixnQkFBTSxPQURTO0FBRWZHLHVCQUFhLElBRkU7QUFHZkMsaUJBQU87QUFDTEosa0JBQU07QUFERDtBQUhRLFNBRFA7QUFRVkssZ0NBQXdCO0FBQ3RCTCxnQkFBTTtBQURnQjtBQVJkO0FBRkwsS0FBRDtBQUpKLEdBRFM7O0FBc0JmTSxVQUFRLFVBQVVDLE9BQVYsRUFBbUI7QUFDekIsVUFBTUMsU0FBU0QsUUFBUUUsT0FBUixDQUFnQixDQUFoQixDQUFmOztBQUR5QixlQUVRRCxVQUFVLEVBRmxCO0FBQUEsb0NBRWpCTixlQUZpQjs7QUFBQSxVQUVqQkEsZUFGaUIsd0NBRUMsRUFGRDs7QUFBQSxnQkFHK0JNLFVBQVUsRUFIekM7QUFBQSxzQ0FHakJILHNCQUhpQjs7QUFBQSxVQUdqQkEsc0JBSGlCLHlDQUdRLGtCQUhSOzs7QUFLekIsVUFBTUssZ0JBQWlCLHVCQUFzQkwsc0JBQXVCLElBQXBFO0FBQ0EsVUFBTU0sZUFBZSxJQUFJQyxNQUFKLENBQVdGLGFBQVgsQ0FBckI7O0FBRUEsV0FBTztBQUNMRyxxQkFBZUMsSUFBZixFQUFxQjtBQUNuQixZQUFJQSxLQUFLQyxNQUFMLENBQVlmLElBQVosS0FBcUIsUUFBckIsSUFBaUNFLGdCQUFnQmMsT0FBaEIsQ0FBd0JGLEtBQUtDLE1BQUwsQ0FBWUUsSUFBcEMsSUFBNEMsQ0FBakYsRUFBb0Y7QUFDbEY7QUFDRDs7QUFFRCxjQUFNQyxhQUFhWCxRQUFRWSxhQUFSLEVBQW5CO0FBQ0EsY0FBTUMsTUFBTU4sS0FBS08sU0FBTCxDQUFlLENBQWYsQ0FBWjtBQUNBLGNBQU1DLGtCQUFrQkosV0FBV0ssV0FBWCxDQUF1QkgsR0FBdkIsRUFBNEJJLE9BQXBEOztBQUVBLFlBQUksQ0FBQ0YsZUFBRCxJQUFvQkEsZ0JBQWdCRyxNQUFoQixLQUEyQixDQUFuRCxFQUFzRDtBQUNwRGxCLGtCQUFRbUIsTUFBUixDQUFlO0FBQ2JaLGdCQURhO0FBRWJhLHFCQUFTO0FBRkksV0FBZjtBQUlBO0FBQ0Q7O0FBRUQsY0FBTUMsVUFBVU4sZ0JBQWdCLENBQWhCLENBQWhCO0FBQ0EsWUFBSU0sUUFBUTVCLElBQVIsS0FBaUIsT0FBckIsRUFBOEI7QUFDNUJPLGtCQUFRbUIsTUFBUixDQUFlO0FBQ2JaLGdCQURhO0FBRWJhLHFCQUFTO0FBRkksV0FBZjtBQUlBO0FBQ0Q7O0FBRUQsY0FBTUUseUJBQXlCRCxRQUFRRSxLQUF2QztBQUNBLFlBQUksQ0FBQ0QsdUJBQXVCRSxLQUF2QixDQUE2QnBCLFlBQTdCLENBQUwsRUFBaUQ7QUFDL0NKLGtCQUFRbUIsTUFBUixDQUFlO0FBQ2JaLGdCQURhO0FBRWJhLHFCQUFVLDJEQUEwRGpCLGFBQWM7QUFGckUsV0FBZjtBQUlEO0FBQ0Y7QUFsQ0ksS0FBUDtBQW9DRDtBQWxFYyxDQUFqQiIsImZpbGUiOiJydWxlcy9keW5hbWljLWltcG9ydC1jaHVua25hbWUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIGRvY3M6IHtcbiAgICAgIHVybDogZG9jc1VybCgnZHluYW1pYy1pbXBvcnQtY2h1bmtuYW1lJyksXG4gICAgfSxcbiAgICBzY2hlbWE6IFt7XG4gICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgaW1wb3J0RnVuY3Rpb25zOiB7XG4gICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICB1bmlxdWVJdGVtczogdHJ1ZSxcbiAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgd2VicGFja0NodW5rbmFtZUZvcm1hdDoge1xuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9XSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgY29uc3QgY29uZmlnID0gY29udGV4dC5vcHRpb25zWzBdXG4gICAgY29uc3QgeyBpbXBvcnRGdW5jdGlvbnMgPSBbXSB9ID0gY29uZmlnIHx8IHt9XG4gICAgY29uc3QgeyB3ZWJwYWNrQ2h1bmtuYW1lRm9ybWF0ID0gJ1swLTlhLXpBLVotXy8uXSsnIH0gPSBjb25maWcgfHwge31cblxuICAgIGNvbnN0IGNvbW1lbnRGb3JtYXQgPSBgIHdlYnBhY2tDaHVua05hbWU6IFwiJHt3ZWJwYWNrQ2h1bmtuYW1lRm9ybWF0fVwiIGBcbiAgICBjb25zdCBjb21tZW50UmVnZXggPSBuZXcgUmVnRXhwKGNvbW1lbnRGb3JtYXQpXG5cbiAgICByZXR1cm4ge1xuICAgICAgQ2FsbEV4cHJlc3Npb24obm9kZSkge1xuICAgICAgICBpZiAobm9kZS5jYWxsZWUudHlwZSAhPT0gJ0ltcG9ydCcgJiYgaW1wb3J0RnVuY3Rpb25zLmluZGV4T2Yobm9kZS5jYWxsZWUubmFtZSkgPCAwKSB7XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzb3VyY2VDb2RlID0gY29udGV4dC5nZXRTb3VyY2VDb2RlKClcbiAgICAgICAgY29uc3QgYXJnID0gbm9kZS5hcmd1bWVudHNbMF1cbiAgICAgICAgY29uc3QgbGVhZGluZ0NvbW1lbnRzID0gc291cmNlQ29kZS5nZXRDb21tZW50cyhhcmcpLmxlYWRpbmdcblxuICAgICAgICBpZiAoIWxlYWRpbmdDb21tZW50cyB8fCBsZWFkaW5nQ29tbWVudHMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdkeW5hbWljIGltcG9ydHMgcmVxdWlyZSBhIGxlYWRpbmcgY29tbWVudCB3aXRoIHRoZSB3ZWJwYWNrIGNodW5rbmFtZScsXG4gICAgICAgICAgfSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbW1lbnQgPSBsZWFkaW5nQ29tbWVudHNbMF1cbiAgICAgICAgaWYgKGNvbW1lbnQudHlwZSAhPT0gJ0Jsb2NrJykge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBtZXNzYWdlOiAnZHluYW1pYyBpbXBvcnRzIHJlcXVpcmUgYSAvKiBmb28gKi8gc3R5bGUgY29tbWVudCwgbm90IGEgLy8gZm9vIGNvbW1lbnQnLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3ZWJwYWNrQ2h1bmtEZWZpbml0aW9uID0gY29tbWVudC52YWx1ZVxuICAgICAgICBpZiAoIXdlYnBhY2tDaHVua0RlZmluaXRpb24ubWF0Y2goY29tbWVudFJlZ2V4KSkge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBtZXNzYWdlOiBgZHluYW1pYyBpbXBvcnRzIHJlcXVpcmUgYSBsZWFkaW5nIGNvbW1lbnQgaW4gdGhlIGZvcm0gLyoke2NvbW1lbnRGb3JtYXR9Ki9gLFxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfVxuICB9LFxufVxuIl19