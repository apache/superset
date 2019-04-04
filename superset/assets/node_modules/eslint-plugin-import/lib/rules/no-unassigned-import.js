'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _minimatch = require('minimatch');

var _minimatch2 = _interopRequireDefault(_minimatch);

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function report(context, node) {
  context.report({
    node,
    message: 'Imported module should be assigned'
  });
}

function testIsAllow(globs, filename, source) {
  if (!Array.isArray(globs)) {
    return false; // default doesn't allow any patterns
  }

  let filePath;

  if (source[0] !== '.' && source[0] !== '/') {
    // a node module
    filePath = source;
  } else {
    filePath = _path2.default.resolve(_path2.default.dirname(filename), source); // get source absolute path
  }

  return globs.find(glob => (0, _minimatch2.default)(filePath, glob) || (0, _minimatch2.default)(filePath, _path2.default.join(process.cwd(), glob))) !== undefined;
}

function create(context) {
  const options = context.options[0] || {};
  const filename = context.getFilename();
  const isAllow = source => testIsAllow(options.allow, filename, source);

  return {
    ImportDeclaration(node) {
      if (node.specifiers.length === 0 && !isAllow(node.source.value)) {
        report(context, node);
      }
    },
    ExpressionStatement(node) {
      if (node.expression.type === 'CallExpression' && (0, _staticRequire2.default)(node.expression) && !isAllow(node.expression.arguments[0].value)) {
        report(context, node.expression);
      }
    }
  };
}

module.exports = {
  create,
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-unassigned-import')
    },
    schema: [{
      'type': 'object',
      'properties': {
        'devDependencies': { 'type': ['boolean', 'array'] },
        'optionalDependencies': { 'type': ['boolean', 'array'] },
        'peerDependencies': { 'type': ['boolean', 'array'] },
        'allow': {
          'type': 'array',
          'items': {
            'type': 'string'
          }
        }
      },
      'additionalProperties': false
    }]
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLXVuYXNzaWduZWQtaW1wb3J0LmpzIl0sIm5hbWVzIjpbInJlcG9ydCIsImNvbnRleHQiLCJub2RlIiwibWVzc2FnZSIsInRlc3RJc0FsbG93IiwiZ2xvYnMiLCJmaWxlbmFtZSIsInNvdXJjZSIsIkFycmF5IiwiaXNBcnJheSIsImZpbGVQYXRoIiwicGF0aCIsInJlc29sdmUiLCJkaXJuYW1lIiwiZmluZCIsImdsb2IiLCJqb2luIiwicHJvY2VzcyIsImN3ZCIsInVuZGVmaW5lZCIsImNyZWF0ZSIsIm9wdGlvbnMiLCJnZXRGaWxlbmFtZSIsImlzQWxsb3ciLCJhbGxvdyIsIkltcG9ydERlY2xhcmF0aW9uIiwic3BlY2lmaWVycyIsImxlbmd0aCIsInZhbHVlIiwiRXhwcmVzc2lvblN0YXRlbWVudCIsImV4cHJlc3Npb24iLCJ0eXBlIiwiYXJndW1lbnRzIiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwic2NoZW1hIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7O0FBQ0E7Ozs7QUFFQTs7OztBQUNBOzs7Ozs7QUFFQSxTQUFTQSxNQUFULENBQWdCQyxPQUFoQixFQUF5QkMsSUFBekIsRUFBK0I7QUFDN0JELFVBQVFELE1BQVIsQ0FBZTtBQUNiRSxRQURhO0FBRWJDLGFBQVM7QUFGSSxHQUFmO0FBSUQ7O0FBRUQsU0FBU0MsV0FBVCxDQUFxQkMsS0FBckIsRUFBNEJDLFFBQTVCLEVBQXNDQyxNQUF0QyxFQUE4QztBQUM1QyxNQUFJLENBQUNDLE1BQU1DLE9BQU4sQ0FBY0osS0FBZCxDQUFMLEVBQTJCO0FBQ3pCLFdBQU8sS0FBUCxDQUR5QixDQUNaO0FBQ2Q7O0FBRUQsTUFBSUssUUFBSjs7QUFFQSxNQUFJSCxPQUFPLENBQVAsTUFBYyxHQUFkLElBQXFCQSxPQUFPLENBQVAsTUFBYyxHQUF2QyxFQUE0QztBQUFFO0FBQzVDRyxlQUFXSCxNQUFYO0FBQ0QsR0FGRCxNQUVPO0FBQ0xHLGVBQVdDLGVBQUtDLE9BQUwsQ0FBYUQsZUFBS0UsT0FBTCxDQUFhUCxRQUFiLENBQWIsRUFBcUNDLE1BQXJDLENBQVgsQ0FESyxDQUNtRDtBQUN6RDs7QUFFRCxTQUFPRixNQUFNUyxJQUFOLENBQVdDLFFBQ2hCLHlCQUFVTCxRQUFWLEVBQW9CSyxJQUFwQixLQUNBLHlCQUFVTCxRQUFWLEVBQW9CQyxlQUFLSyxJQUFMLENBQVVDLFFBQVFDLEdBQVIsRUFBVixFQUF5QkgsSUFBekIsQ0FBcEIsQ0FGSyxNQUdBSSxTQUhQO0FBSUQ7O0FBRUQsU0FBU0MsTUFBVCxDQUFnQm5CLE9BQWhCLEVBQXlCO0FBQ3ZCLFFBQU1vQixVQUFVcEIsUUFBUW9CLE9BQVIsQ0FBZ0IsQ0FBaEIsS0FBc0IsRUFBdEM7QUFDQSxRQUFNZixXQUFXTCxRQUFRcUIsV0FBUixFQUFqQjtBQUNBLFFBQU1DLFVBQVVoQixVQUFVSCxZQUFZaUIsUUFBUUcsS0FBcEIsRUFBMkJsQixRQUEzQixFQUFxQ0MsTUFBckMsQ0FBMUI7O0FBRUEsU0FBTztBQUNMa0Isc0JBQWtCdkIsSUFBbEIsRUFBd0I7QUFDdEIsVUFBSUEsS0FBS3dCLFVBQUwsQ0FBZ0JDLE1BQWhCLEtBQTJCLENBQTNCLElBQWdDLENBQUNKLFFBQVFyQixLQUFLSyxNQUFMLENBQVlxQixLQUFwQixDQUFyQyxFQUFpRTtBQUMvRDVCLGVBQU9DLE9BQVAsRUFBZ0JDLElBQWhCO0FBQ0Q7QUFDRixLQUxJO0FBTUwyQix3QkFBb0IzQixJQUFwQixFQUEwQjtBQUN4QixVQUFJQSxLQUFLNEIsVUFBTCxDQUFnQkMsSUFBaEIsS0FBeUIsZ0JBQXpCLElBQ0YsNkJBQWdCN0IsS0FBSzRCLFVBQXJCLENBREUsSUFFRixDQUFDUCxRQUFRckIsS0FBSzRCLFVBQUwsQ0FBZ0JFLFNBQWhCLENBQTBCLENBQTFCLEVBQTZCSixLQUFyQyxDQUZILEVBRWdEO0FBQzlDNUIsZUFBT0MsT0FBUCxFQUFnQkMsS0FBSzRCLFVBQXJCO0FBQ0Q7QUFDRjtBQVpJLEdBQVA7QUFjRDs7QUFFREcsT0FBT0MsT0FBUCxHQUFpQjtBQUNmZCxRQURlO0FBRWZlLFFBQU07QUFDSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLHNCQUFSO0FBREQsS0FERjtBQUlKQyxZQUFRLENBQ047QUFDRSxjQUFRLFFBRFY7QUFFRSxvQkFBYztBQUNaLDJCQUFtQixFQUFFLFFBQVEsQ0FBQyxTQUFELEVBQVksT0FBWixDQUFWLEVBRFA7QUFFWixnQ0FBd0IsRUFBRSxRQUFRLENBQUMsU0FBRCxFQUFZLE9BQVosQ0FBVixFQUZaO0FBR1osNEJBQW9CLEVBQUUsUUFBUSxDQUFDLFNBQUQsRUFBWSxPQUFaLENBQVYsRUFIUjtBQUlaLGlCQUFTO0FBQ1Asa0JBQVEsT0FERDtBQUVQLG1CQUFTO0FBQ1Asb0JBQVE7QUFERDtBQUZGO0FBSkcsT0FGaEI7QUFhRSw4QkFBd0I7QUFiMUIsS0FETTtBQUpKO0FBRlMsQ0FBakIiLCJmaWxlIjoicnVsZXMvbm8tdW5hc3NpZ25lZC1pbXBvcnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IG1pbmltYXRjaCBmcm9tICdtaW5pbWF0Y2gnXG5cbmltcG9ydCBpc1N0YXRpY1JlcXVpcmUgZnJvbSAnLi4vY29yZS9zdGF0aWNSZXF1aXJlJ1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxuZnVuY3Rpb24gcmVwb3J0KGNvbnRleHQsIG5vZGUpIHtcbiAgY29udGV4dC5yZXBvcnQoe1xuICAgIG5vZGUsXG4gICAgbWVzc2FnZTogJ0ltcG9ydGVkIG1vZHVsZSBzaG91bGQgYmUgYXNzaWduZWQnLFxuICB9KVxufVxuXG5mdW5jdGlvbiB0ZXN0SXNBbGxvdyhnbG9icywgZmlsZW5hbWUsIHNvdXJjZSkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkoZ2xvYnMpKSB7XG4gICAgcmV0dXJuIGZhbHNlIC8vIGRlZmF1bHQgZG9lc24ndCBhbGxvdyBhbnkgcGF0dGVybnNcbiAgfVxuXG4gIGxldCBmaWxlUGF0aFxuXG4gIGlmIChzb3VyY2VbMF0gIT09ICcuJyAmJiBzb3VyY2VbMF0gIT09ICcvJykgeyAvLyBhIG5vZGUgbW9kdWxlXG4gICAgZmlsZVBhdGggPSBzb3VyY2VcbiAgfSBlbHNlIHtcbiAgICBmaWxlUGF0aCA9IHBhdGgucmVzb2x2ZShwYXRoLmRpcm5hbWUoZmlsZW5hbWUpLCBzb3VyY2UpIC8vIGdldCBzb3VyY2UgYWJzb2x1dGUgcGF0aFxuICB9XG5cbiAgcmV0dXJuIGdsb2JzLmZpbmQoZ2xvYiA9PiAoXG4gICAgbWluaW1hdGNoKGZpbGVQYXRoLCBnbG9iKSB8fFxuICAgIG1pbmltYXRjaChmaWxlUGF0aCwgcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIGdsb2IpKVxuICApKSAhPT0gdW5kZWZpbmVkXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZShjb250ZXh0KSB7XG4gIGNvbnN0IG9wdGlvbnMgPSBjb250ZXh0Lm9wdGlvbnNbMF0gfHwge31cbiAgY29uc3QgZmlsZW5hbWUgPSBjb250ZXh0LmdldEZpbGVuYW1lKClcbiAgY29uc3QgaXNBbGxvdyA9IHNvdXJjZSA9PiB0ZXN0SXNBbGxvdyhvcHRpb25zLmFsbG93LCBmaWxlbmFtZSwgc291cmNlKVxuXG4gIHJldHVybiB7XG4gICAgSW1wb3J0RGVjbGFyYXRpb24obm9kZSkge1xuICAgICAgaWYgKG5vZGUuc3BlY2lmaWVycy5sZW5ndGggPT09IDAgJiYgIWlzQWxsb3cobm9kZS5zb3VyY2UudmFsdWUpKSB7XG4gICAgICAgIHJlcG9ydChjb250ZXh0LCBub2RlKVxuICAgICAgfVxuICAgIH0sXG4gICAgRXhwcmVzc2lvblN0YXRlbWVudChub2RlKSB7XG4gICAgICBpZiAobm9kZS5leHByZXNzaW9uLnR5cGUgPT09ICdDYWxsRXhwcmVzc2lvbicgJiZcbiAgICAgICAgaXNTdGF0aWNSZXF1aXJlKG5vZGUuZXhwcmVzc2lvbikgJiZcbiAgICAgICAgIWlzQWxsb3cobm9kZS5leHByZXNzaW9uLmFyZ3VtZW50c1swXS52YWx1ZSkpIHtcbiAgICAgICAgcmVwb3J0KGNvbnRleHQsIG5vZGUuZXhwcmVzc2lvbilcbiAgICAgIH1cbiAgICB9LFxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBjcmVhdGUsXG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ25vLXVuYXNzaWduZWQtaW1wb3J0JyksXG4gICAgfSxcbiAgICBzY2hlbWE6IFtcbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiAnb2JqZWN0JyxcbiAgICAgICAgJ3Byb3BlcnRpZXMnOiB7XG4gICAgICAgICAgJ2RldkRlcGVuZGVuY2llcyc6IHsgJ3R5cGUnOiBbJ2Jvb2xlYW4nLCAnYXJyYXknXSB9LFxuICAgICAgICAgICdvcHRpb25hbERlcGVuZGVuY2llcyc6IHsgJ3R5cGUnOiBbJ2Jvb2xlYW4nLCAnYXJyYXknXSB9LFxuICAgICAgICAgICdwZWVyRGVwZW5kZW5jaWVzJzogeyAndHlwZSc6IFsnYm9vbGVhbicsICdhcnJheSddIH0sXG4gICAgICAgICAgJ2FsbG93Jzoge1xuICAgICAgICAgICAgJ3R5cGUnOiAnYXJyYXknLFxuICAgICAgICAgICAgJ2l0ZW1zJzoge1xuICAgICAgICAgICAgICAndHlwZSc6ICdzdHJpbmcnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnYWRkaXRpb25hbFByb3BlcnRpZXMnOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcbn1cbiJdfQ==