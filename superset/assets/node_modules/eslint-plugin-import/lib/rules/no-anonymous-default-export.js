'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

var _has = require('has');

var _has2 = _interopRequireDefault(_has);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @fileoverview Rule to disallow anonymous default exports.
 * @author Duncan Beevers
 */

const defs = {
  ArrayExpression: {
    option: 'allowArray',
    description: 'If `false`, will report default export of an array',
    message: 'Assign array to a variable before exporting as module default'
  },
  ArrowFunctionExpression: {
    option: 'allowArrowFunction',
    description: 'If `false`, will report default export of an arrow function',
    message: 'Assign arrow function to a variable before exporting as module default'
  },
  CallExpression: {
    option: 'allowCallExpression',
    description: 'If `false`, will report default export of a function call',
    message: 'Assign call result to a variable before exporting as module default',
    default: true
  },
  ClassDeclaration: {
    option: 'allowAnonymousClass',
    description: 'If `false`, will report default export of an anonymous class',
    message: 'Unexpected default export of anonymous class',
    forbid: node => !node.declaration.id
  },
  FunctionDeclaration: {
    option: 'allowAnonymousFunction',
    description: 'If `false`, will report default export of an anonymous function',
    message: 'Unexpected default export of anonymous function',
    forbid: node => !node.declaration.id
  },
  Literal: {
    option: 'allowLiteral',
    description: 'If `false`, will report default export of a literal',
    message: 'Assign literal to a variable before exporting as module default'
  },
  ObjectExpression: {
    option: 'allowObject',
    description: 'If `false`, will report default export of an object expression',
    message: 'Assign object to a variable before exporting as module default'
  },
  TemplateLiteral: {
    option: 'allowLiteral',
    description: 'If `false`, will report default export of a literal',
    message: 'Assign literal to a variable before exporting as module default'
  }
};

const schemaProperties = Object.keys(defs).map(key => defs[key]).reduce((acc, def) => {
  acc[def.option] = {
    description: def.description,
    type: 'boolean'
  };

  return acc;
}, {});

const defaults = Object.keys(defs).map(key => defs[key]).reduce((acc, def) => {
  acc[def.option] = (0, _has2.default)(def, 'default') ? def.default : false;
  return acc;
}, {});

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-anonymous-default-export')
    },

    schema: [{
      type: 'object',
      properties: schemaProperties,
      'additionalProperties': false
    }]
  },

  create: function (context) {
    const options = Object.assign({}, defaults, context.options[0]);

    return {
      'ExportDefaultDeclaration': node => {
        const def = defs[node.declaration.type];

        // Recognized node type and allowed by configuration,
        //   and has no forbid check, or forbid check return value is truthy
        if (def && !options[def.option] && (!def.forbid || def.forbid(node))) {
          context.report({ node, message: def.message });
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLWFub255bW91cy1kZWZhdWx0LWV4cG9ydC5qcyJdLCJuYW1lcyI6WyJkZWZzIiwiQXJyYXlFeHByZXNzaW9uIiwib3B0aW9uIiwiZGVzY3JpcHRpb24iLCJtZXNzYWdlIiwiQXJyb3dGdW5jdGlvbkV4cHJlc3Npb24iLCJDYWxsRXhwcmVzc2lvbiIsImRlZmF1bHQiLCJDbGFzc0RlY2xhcmF0aW9uIiwiZm9yYmlkIiwibm9kZSIsImRlY2xhcmF0aW9uIiwiaWQiLCJGdW5jdGlvbkRlY2xhcmF0aW9uIiwiTGl0ZXJhbCIsIk9iamVjdEV4cHJlc3Npb24iLCJUZW1wbGF0ZUxpdGVyYWwiLCJzY2hlbWFQcm9wZXJ0aWVzIiwiT2JqZWN0Iiwia2V5cyIsIm1hcCIsImtleSIsInJlZHVjZSIsImFjYyIsImRlZiIsInR5cGUiLCJkZWZhdWx0cyIsIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsInVybCIsInNjaGVtYSIsInByb3BlcnRpZXMiLCJjcmVhdGUiLCJjb250ZXh0Iiwib3B0aW9ucyIsImFzc2lnbiIsInJlcG9ydCJdLCJtYXBwaW5ncyI6Ijs7QUFLQTs7OztBQUNBOzs7Ozs7QUFOQTs7Ozs7QUFRQSxNQUFNQSxPQUFPO0FBQ1hDLG1CQUFpQjtBQUNmQyxZQUFRLFlBRE87QUFFZkMsaUJBQWEsb0RBRkU7QUFHZkMsYUFBUztBQUhNLEdBRE47QUFNWEMsMkJBQXlCO0FBQ3ZCSCxZQUFRLG9CQURlO0FBRXZCQyxpQkFBYSw2REFGVTtBQUd2QkMsYUFBUztBQUhjLEdBTmQ7QUFXWEUsa0JBQWdCO0FBQ2RKLFlBQVEscUJBRE07QUFFZEMsaUJBQWEsMkRBRkM7QUFHZEMsYUFBUyxxRUFISztBQUlkRyxhQUFTO0FBSkssR0FYTDtBQWlCWEMsb0JBQWtCO0FBQ2hCTixZQUFRLHFCQURRO0FBRWhCQyxpQkFBYSw4REFGRztBQUdoQkMsYUFBUyw4Q0FITztBQUloQkssWUFBU0MsSUFBRCxJQUFVLENBQUNBLEtBQUtDLFdBQUwsQ0FBaUJDO0FBSnBCLEdBakJQO0FBdUJYQyx1QkFBcUI7QUFDbkJYLFlBQVEsd0JBRFc7QUFFbkJDLGlCQUFhLGlFQUZNO0FBR25CQyxhQUFTLGlEQUhVO0FBSW5CSyxZQUFTQyxJQUFELElBQVUsQ0FBQ0EsS0FBS0MsV0FBTCxDQUFpQkM7QUFKakIsR0F2QlY7QUE2QlhFLFdBQVM7QUFDUFosWUFBUSxjQUREO0FBRVBDLGlCQUFhLHFEQUZOO0FBR1BDLGFBQVM7QUFIRixHQTdCRTtBQWtDWFcsb0JBQWtCO0FBQ2hCYixZQUFRLGFBRFE7QUFFaEJDLGlCQUFhLGdFQUZHO0FBR2hCQyxhQUFTO0FBSE8sR0FsQ1A7QUF1Q1hZLG1CQUFpQjtBQUNmZCxZQUFRLGNBRE87QUFFZkMsaUJBQWEscURBRkU7QUFHZkMsYUFBUztBQUhNO0FBdkNOLENBQWI7O0FBOENBLE1BQU1hLG1CQUFtQkMsT0FBT0MsSUFBUCxDQUFZbkIsSUFBWixFQUN0Qm9CLEdBRHNCLENBQ2pCQyxHQUFELElBQVNyQixLQUFLcUIsR0FBTCxDQURTLEVBRXRCQyxNQUZzQixDQUVmLENBQUNDLEdBQUQsRUFBTUMsR0FBTixLQUFjO0FBQ3BCRCxNQUFJQyxJQUFJdEIsTUFBUixJQUFrQjtBQUNoQkMsaUJBQWFxQixJQUFJckIsV0FERDtBQUVoQnNCLFVBQU07QUFGVSxHQUFsQjs7QUFLQSxTQUFPRixHQUFQO0FBQ0QsQ0FUc0IsRUFTcEIsRUFUb0IsQ0FBekI7O0FBV0EsTUFBTUcsV0FBV1IsT0FBT0MsSUFBUCxDQUFZbkIsSUFBWixFQUNkb0IsR0FEYyxDQUNUQyxHQUFELElBQVNyQixLQUFLcUIsR0FBTCxDQURDLEVBRWRDLE1BRmMsQ0FFUCxDQUFDQyxHQUFELEVBQU1DLEdBQU4sS0FBYztBQUNwQkQsTUFBSUMsSUFBSXRCLE1BQVIsSUFBa0IsbUJBQUlzQixHQUFKLEVBQVMsU0FBVCxJQUFzQkEsSUFBSWpCLE9BQTFCLEdBQW9DLEtBQXREO0FBQ0EsU0FBT2dCLEdBQVA7QUFDRCxDQUxjLEVBS1osRUFMWSxDQUFqQjs7QUFPQUksT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU07QUFDSkMsV0FBSyx1QkFBUSw2QkFBUjtBQURELEtBREY7O0FBS0pDLFlBQVEsQ0FDTjtBQUNFUCxZQUFNLFFBRFI7QUFFRVEsa0JBQVloQixnQkFGZDtBQUdFLDhCQUF3QjtBQUgxQixLQURNO0FBTEosR0FEUzs7QUFlZmlCLFVBQVEsVUFBVUMsT0FBVixFQUFtQjtBQUN6QixVQUFNQyxVQUFVbEIsT0FBT21CLE1BQVAsQ0FBYyxFQUFkLEVBQWtCWCxRQUFsQixFQUE0QlMsUUFBUUMsT0FBUixDQUFnQixDQUFoQixDQUE1QixDQUFoQjs7QUFFQSxXQUFPO0FBQ0wsa0NBQTZCMUIsSUFBRCxJQUFVO0FBQ3BDLGNBQU1jLE1BQU14QixLQUFLVSxLQUFLQyxXQUFMLENBQWlCYyxJQUF0QixDQUFaOztBQUVBO0FBQ0E7QUFDQSxZQUFJRCxPQUFPLENBQUNZLFFBQVFaLElBQUl0QixNQUFaLENBQVIsS0FBZ0MsQ0FBQ3NCLElBQUlmLE1BQUwsSUFBZWUsSUFBSWYsTUFBSixDQUFXQyxJQUFYLENBQS9DLENBQUosRUFBc0U7QUFDcEV5QixrQkFBUUcsTUFBUixDQUFlLEVBQUU1QixJQUFGLEVBQVFOLFNBQVNvQixJQUFJcEIsT0FBckIsRUFBZjtBQUNEO0FBQ0Y7QUFUSSxLQUFQO0FBV0Q7QUE3QmMsQ0FBakIiLCJmaWxlIjoicnVsZXMvbm8tYW5vbnltb3VzLWRlZmF1bHQtZXhwb3J0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IFJ1bGUgdG8gZGlzYWxsb3cgYW5vbnltb3VzIGRlZmF1bHQgZXhwb3J0cy5cbiAqIEBhdXRob3IgRHVuY2FuIEJlZXZlcnNcbiAqL1xuXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuaW1wb3J0IGhhcyBmcm9tICdoYXMnXG5cbmNvbnN0IGRlZnMgPSB7XG4gIEFycmF5RXhwcmVzc2lvbjoge1xuICAgIG9wdGlvbjogJ2FsbG93QXJyYXknLFxuICAgIGRlc2NyaXB0aW9uOiAnSWYgYGZhbHNlYCwgd2lsbCByZXBvcnQgZGVmYXVsdCBleHBvcnQgb2YgYW4gYXJyYXknLFxuICAgIG1lc3NhZ2U6ICdBc3NpZ24gYXJyYXkgdG8gYSB2YXJpYWJsZSBiZWZvcmUgZXhwb3J0aW5nIGFzIG1vZHVsZSBkZWZhdWx0JyxcbiAgfSxcbiAgQXJyb3dGdW5jdGlvbkV4cHJlc3Npb246IHtcbiAgICBvcHRpb246ICdhbGxvd0Fycm93RnVuY3Rpb24nLFxuICAgIGRlc2NyaXB0aW9uOiAnSWYgYGZhbHNlYCwgd2lsbCByZXBvcnQgZGVmYXVsdCBleHBvcnQgb2YgYW4gYXJyb3cgZnVuY3Rpb24nLFxuICAgIG1lc3NhZ2U6ICdBc3NpZ24gYXJyb3cgZnVuY3Rpb24gdG8gYSB2YXJpYWJsZSBiZWZvcmUgZXhwb3J0aW5nIGFzIG1vZHVsZSBkZWZhdWx0JyxcbiAgfSxcbiAgQ2FsbEV4cHJlc3Npb246IHtcbiAgICBvcHRpb246ICdhbGxvd0NhbGxFeHByZXNzaW9uJyxcbiAgICBkZXNjcmlwdGlvbjogJ0lmIGBmYWxzZWAsIHdpbGwgcmVwb3J0IGRlZmF1bHQgZXhwb3J0IG9mIGEgZnVuY3Rpb24gY2FsbCcsXG4gICAgbWVzc2FnZTogJ0Fzc2lnbiBjYWxsIHJlc3VsdCB0byBhIHZhcmlhYmxlIGJlZm9yZSBleHBvcnRpbmcgYXMgbW9kdWxlIGRlZmF1bHQnLFxuICAgIGRlZmF1bHQ6IHRydWUsXG4gIH0sXG4gIENsYXNzRGVjbGFyYXRpb246IHtcbiAgICBvcHRpb246ICdhbGxvd0Fub255bW91c0NsYXNzJyxcbiAgICBkZXNjcmlwdGlvbjogJ0lmIGBmYWxzZWAsIHdpbGwgcmVwb3J0IGRlZmF1bHQgZXhwb3J0IG9mIGFuIGFub255bW91cyBjbGFzcycsXG4gICAgbWVzc2FnZTogJ1VuZXhwZWN0ZWQgZGVmYXVsdCBleHBvcnQgb2YgYW5vbnltb3VzIGNsYXNzJyxcbiAgICBmb3JiaWQ6IChub2RlKSA9PiAhbm9kZS5kZWNsYXJhdGlvbi5pZCxcbiAgfSxcbiAgRnVuY3Rpb25EZWNsYXJhdGlvbjoge1xuICAgIG9wdGlvbjogJ2FsbG93QW5vbnltb3VzRnVuY3Rpb24nLFxuICAgIGRlc2NyaXB0aW9uOiAnSWYgYGZhbHNlYCwgd2lsbCByZXBvcnQgZGVmYXVsdCBleHBvcnQgb2YgYW4gYW5vbnltb3VzIGZ1bmN0aW9uJyxcbiAgICBtZXNzYWdlOiAnVW5leHBlY3RlZCBkZWZhdWx0IGV4cG9ydCBvZiBhbm9ueW1vdXMgZnVuY3Rpb24nLFxuICAgIGZvcmJpZDogKG5vZGUpID0+ICFub2RlLmRlY2xhcmF0aW9uLmlkLFxuICB9LFxuICBMaXRlcmFsOiB7XG4gICAgb3B0aW9uOiAnYWxsb3dMaXRlcmFsJyxcbiAgICBkZXNjcmlwdGlvbjogJ0lmIGBmYWxzZWAsIHdpbGwgcmVwb3J0IGRlZmF1bHQgZXhwb3J0IG9mIGEgbGl0ZXJhbCcsXG4gICAgbWVzc2FnZTogJ0Fzc2lnbiBsaXRlcmFsIHRvIGEgdmFyaWFibGUgYmVmb3JlIGV4cG9ydGluZyBhcyBtb2R1bGUgZGVmYXVsdCcsXG4gIH0sXG4gIE9iamVjdEV4cHJlc3Npb246IHtcbiAgICBvcHRpb246ICdhbGxvd09iamVjdCcsXG4gICAgZGVzY3JpcHRpb246ICdJZiBgZmFsc2VgLCB3aWxsIHJlcG9ydCBkZWZhdWx0IGV4cG9ydCBvZiBhbiBvYmplY3QgZXhwcmVzc2lvbicsXG4gICAgbWVzc2FnZTogJ0Fzc2lnbiBvYmplY3QgdG8gYSB2YXJpYWJsZSBiZWZvcmUgZXhwb3J0aW5nIGFzIG1vZHVsZSBkZWZhdWx0JyxcbiAgfSxcbiAgVGVtcGxhdGVMaXRlcmFsOiB7XG4gICAgb3B0aW9uOiAnYWxsb3dMaXRlcmFsJyxcbiAgICBkZXNjcmlwdGlvbjogJ0lmIGBmYWxzZWAsIHdpbGwgcmVwb3J0IGRlZmF1bHQgZXhwb3J0IG9mIGEgbGl0ZXJhbCcsXG4gICAgbWVzc2FnZTogJ0Fzc2lnbiBsaXRlcmFsIHRvIGEgdmFyaWFibGUgYmVmb3JlIGV4cG9ydGluZyBhcyBtb2R1bGUgZGVmYXVsdCcsXG4gIH0sXG59XG5cbmNvbnN0IHNjaGVtYVByb3BlcnRpZXMgPSBPYmplY3Qua2V5cyhkZWZzKVxuICAubWFwKChrZXkpID0+IGRlZnNba2V5XSlcbiAgLnJlZHVjZSgoYWNjLCBkZWYpID0+IHtcbiAgICBhY2NbZGVmLm9wdGlvbl0gPSB7XG4gICAgICBkZXNjcmlwdGlvbjogZGVmLmRlc2NyaXB0aW9uLFxuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgIH1cblxuICAgIHJldHVybiBhY2NcbiAgfSwge30pXG5cbmNvbnN0IGRlZmF1bHRzID0gT2JqZWN0LmtleXMoZGVmcylcbiAgLm1hcCgoa2V5KSA9PiBkZWZzW2tleV0pXG4gIC5yZWR1Y2UoKGFjYywgZGVmKSA9PiB7XG4gICAgYWNjW2RlZi5vcHRpb25dID0gaGFzKGRlZiwgJ2RlZmF1bHQnKSA/IGRlZi5kZWZhdWx0IDogZmFsc2VcbiAgICByZXR1cm4gYWNjXG4gIH0sIHt9KVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIGRvY3M6IHtcbiAgICAgIHVybDogZG9jc1VybCgnbm8tYW5vbnltb3VzLWRlZmF1bHQtZXhwb3J0JyksXG4gICAgfSxcblxuICAgIHNjaGVtYTogW1xuICAgICAge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczogc2NoZW1hUHJvcGVydGllcyxcbiAgICAgICAgJ2FkZGl0aW9uYWxQcm9wZXJ0aWVzJzogZmFsc2UsXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0cywgY29udGV4dC5vcHRpb25zWzBdKVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICdFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24nOiAobm9kZSkgPT4ge1xuICAgICAgICBjb25zdCBkZWYgPSBkZWZzW25vZGUuZGVjbGFyYXRpb24udHlwZV1cblxuICAgICAgICAvLyBSZWNvZ25pemVkIG5vZGUgdHlwZSBhbmQgYWxsb3dlZCBieSBjb25maWd1cmF0aW9uLFxuICAgICAgICAvLyAgIGFuZCBoYXMgbm8gZm9yYmlkIGNoZWNrLCBvciBmb3JiaWQgY2hlY2sgcmV0dXJuIHZhbHVlIGlzIHRydXRoeVxuICAgICAgICBpZiAoZGVmICYmICFvcHRpb25zW2RlZi5vcHRpb25dICYmICghZGVmLmZvcmJpZCB8fCBkZWYuZm9yYmlkKG5vZGUpKSkge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHsgbm9kZSwgbWVzc2FnZTogZGVmLm1lc3NhZ2UgfSlcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9XG4gIH0sXG59XG4iXX0=