'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const EXPORT_MESSAGE = 'Expected "export" or "export default"',
      IMPORT_MESSAGE = 'Expected "import" instead of "require()"'; /**
                                                                    * @fileoverview Rule to prefer ES6 to CJS
                                                                    * @author Jamund Ferguson
                                                                    */

function normalizeLegacyOptions(options) {
  if (options.indexOf('allow-primitive-modules') >= 0) {
    return { allowPrimitiveModules: true };
  }
  return options[0] || {};
}

function allowPrimitive(node, options) {
  if (!options.allowPrimitiveModules) return false;
  if (node.parent.type !== 'AssignmentExpression') return false;
  return node.parent.right.type !== 'ObjectExpression';
}

function allowRequire(node, options) {
  return options.allowRequire;
}

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

const schemaString = { enum: ['allow-primitive-modules'] };
const schemaObject = {
  type: 'object',
  properties: {
    allowPrimitiveModules: { 'type': 'boolean' },
    allowRequire: { 'type': 'boolean' }
  },
  additionalProperties: false
};

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-commonjs')
    },

    schema: {
      anyOf: [{
        type: 'array',
        items: [schemaString],
        additionalItems: false
      }, {
        type: 'array',
        items: [schemaObject],
        additionalItems: false
      }]
    }
  },

  create: function (context) {
    const options = normalizeLegacyOptions(context.options);

    return {

      'MemberExpression': function (node) {

        // module.exports
        if (node.object.name === 'module' && node.property.name === 'exports') {
          if (allowPrimitive(node, options)) return;
          context.report({ node, message: EXPORT_MESSAGE });
        }

        // exports.
        if (node.object.name === 'exports') {
          const isInScope = context.getScope().variables.some(variable => variable.name === 'exports');
          if (!isInScope) {
            context.report({ node, message: EXPORT_MESSAGE });
          }
        }
      },
      'CallExpression': function (call) {
        if (context.getScope().type !== 'module') return;
        if (call.parent.type !== 'ExpressionStatement' && call.parent.type !== 'VariableDeclarator') return;

        if (call.callee.type !== 'Identifier') return;
        if (call.callee.name !== 'require') return;

        if (call.arguments.length !== 1) return;
        var module = call.arguments[0];

        if (module.type !== 'Literal') return;
        if (typeof module.value !== 'string') return;

        if (allowRequire(call, options)) return;

        // keeping it simple: all 1-string-arg `require` calls are reported
        context.report({
          node: call.callee,
          message: IMPORT_MESSAGE
        });
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLWNvbW1vbmpzLmpzIl0sIm5hbWVzIjpbIkVYUE9SVF9NRVNTQUdFIiwiSU1QT1JUX01FU1NBR0UiLCJub3JtYWxpemVMZWdhY3lPcHRpb25zIiwib3B0aW9ucyIsImluZGV4T2YiLCJhbGxvd1ByaW1pdGl2ZU1vZHVsZXMiLCJhbGxvd1ByaW1pdGl2ZSIsIm5vZGUiLCJwYXJlbnQiLCJ0eXBlIiwicmlnaHQiLCJhbGxvd1JlcXVpcmUiLCJzY2hlbWFTdHJpbmciLCJlbnVtIiwic2NoZW1hT2JqZWN0IiwicHJvcGVydGllcyIsImFkZGl0aW9uYWxQcm9wZXJ0aWVzIiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwic2NoZW1hIiwiYW55T2YiLCJpdGVtcyIsImFkZGl0aW9uYWxJdGVtcyIsImNyZWF0ZSIsImNvbnRleHQiLCJvYmplY3QiLCJuYW1lIiwicHJvcGVydHkiLCJyZXBvcnQiLCJtZXNzYWdlIiwiaXNJblNjb3BlIiwiZ2V0U2NvcGUiLCJ2YXJpYWJsZXMiLCJzb21lIiwidmFyaWFibGUiLCJjYWxsIiwiY2FsbGVlIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidmFsdWUiXSwibWFwcGluZ3MiOiI7O0FBS0E7Ozs7OztBQUVBLE1BQU1BLGlCQUFpQix1Q0FBdkI7QUFBQSxNQUNNQyxpQkFBaUIsMENBRHZCLEMsQ0FQQTs7Ozs7QUFVQSxTQUFTQyxzQkFBVCxDQUFnQ0MsT0FBaEMsRUFBeUM7QUFDdkMsTUFBSUEsUUFBUUMsT0FBUixDQUFnQix5QkFBaEIsS0FBOEMsQ0FBbEQsRUFBcUQ7QUFDbkQsV0FBTyxFQUFFQyx1QkFBdUIsSUFBekIsRUFBUDtBQUNEO0FBQ0QsU0FBT0YsUUFBUSxDQUFSLEtBQWMsRUFBckI7QUFDRDs7QUFFRCxTQUFTRyxjQUFULENBQXdCQyxJQUF4QixFQUE4QkosT0FBOUIsRUFBdUM7QUFDckMsTUFBSSxDQUFDQSxRQUFRRSxxQkFBYixFQUFvQyxPQUFPLEtBQVA7QUFDcEMsTUFBSUUs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QVFJLE1BQVIsQ0FBZTtBQUNieEIsZ0JBQU0rQixLQUFLQyxNQURFO0FBRWJQLG1CQUFTL0I7QUFGSSxTQUFmO0FBSUQ7QUE1Q0ksS0FBUDtBQStDRDtBQXhFYyxDQUFqQiIsImZpbGUiOiJydWxlcy9uby1jb21tb25qcy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGVvdmVydmlldyBSdWxlIHRvIHByZWZlciBFUzYgdG8gQ0pTXG4gKiBAYXV0aG9yIEphbXVuZCBGZXJndXNvblxuICovXG5cbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbmNvbnN0IEVYUE9SVF9NRVNTQUdFID0gJ0V4cGVjdGVkIFwiZXhwb3J0XCIgb3IgXCJleHBvcnQgZGVmYXVsdFwiJ1xuICAgICwgSU1QT1JUX01FU1NBR0UgPSAnRXhwZWN0ZWQgXCJpbXBvcnRcIiBpbnN0ZWFkIG9mIFwicmVxdWlyZSgpXCInXG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUxlZ2FjeU9wdGlvbnMob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5pbmRleE9mKCdhbGxvdy1wcmltaXRpdmUtbW9kdWxlcycpID49IDApIHtcbiAgICByZXR1cm4geyBhbGxvd1ByaW1pdGl2ZU1vZHVsZXM6IHRydWUgfVxuICB9XG4gIHJldHVybiBvcHRpb25zWzBdIHx8IHt9XG59XG5cbmZ1bmN0aW9uIGFsbG93UHJpbWl0aXZlKG5vZGUsIG9wdGlvbnMpIHtcbiAgaWYgKCFvcHRpb25zLmFsbG93UHJpbWl0aXZlTW9kdWxlcykgcmV0dXJuIGZhbHNlXG4gIGlmIChub2RlLnBhcmVudC50eXBlICE9PSAnQXNzaWdubWVudEV4cHJlc3Npb24nKSByZXR1cm4gZmFsc2VcbiAgcmV0dXJuIChub2RlLnBhcmVudC5yaWdodC50eXBlICE9PSAnT2JqZWN0RXhwcmVzc2lvbicpXG59XG5cbmZ1bmN0aW9uIGFsbG93UmVxdWlyZShub2RlLCBvcHRpb25zKSB7XG4gIHJldHVybiBvcHRpb25zLmFsbG93UmVxdWlyZVxufVxuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gUnVsZSBEZWZpbml0aW9uXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5jb25zdCBzY2hlbWFTdHJpbmcgPSB7IGVudW06IFsnYWxsb3ctcHJpbWl0aXZlLW1vZHVsZXMnXSB9XG5jb25zdCBzY2hlbWFPYmplY3QgPSB7XG4gIHR5cGU6ICdvYmplY3QnLFxuICBwcm9wZXJ0aWVzOiB7XG4gICAgYWxsb3dQcmltaXRpdmVNb2R1bGVzOiB7ICd0eXBlJzogJ2Jvb2xlYW4nIH0sXG4gICAgYWxsb3dSZXF1aXJlOiB7ICd0eXBlJzogJ2Jvb2xlYW4nIH0sXG4gIH0sXG4gIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ25vLWNvbW1vbmpzJyksXG4gICAgfSxcblxuICAgIHNjaGVtYToge1xuICAgICAgYW55T2Y6IFtcbiAgICAgICAge1xuICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgaXRlbXM6IFtzY2hlbWFTdHJpbmddLFxuICAgICAgICAgIGFkZGl0aW9uYWxJdGVtczogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgIGl0ZW1zOiBbc2NoZW1hT2JqZWN0XSxcbiAgICAgICAgICBhZGRpdGlvbmFsSXRlbXM6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICB9LFxuXG4gIGNyZWF0ZTogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICBjb25zdCBvcHRpb25zID0gbm9ybWFsaXplTGVnYWN5T3B0aW9ucyhjb250ZXh0Lm9wdGlvbnMpXG5cbiAgICByZXR1cm4ge1xuXG4gICAgICAnTWVtYmVyRXhwcmVzc2lvbic6IGZ1bmN0aW9uIChub2RlKSB7XG5cbiAgICAgICAgLy8gbW9kdWxlLmV4cG9ydHNcbiAgICAgICAgaWYgKG5vZGUub2JqZWN0Lm5hbWUgPT09ICdtb2R1bGUnICYmIG5vZGUucHJvcGVydHkubmFtZSA9PT0gJ2V4cG9ydHMnKSB7XG4gICAgICAgICAgaWYgKGFsbG93UHJpbWl0aXZlKG5vZGUsIG9wdGlvbnMpKSByZXR1cm5cbiAgICAgICAgICBjb250ZXh0LnJlcG9ydCh7IG5vZGUsIG1lc3NhZ2U6IEVYUE9SVF9NRVNTQUdFIH0pXG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBvcnRzLlxuICAgICAgICBpZiAobm9kZS5vYmplY3QubmFtZSA9PT0gJ2V4cG9ydHMnKSB7XG4gICAgICAgICAgY29uc3QgaXNJblNjb3BlID0gY29udGV4dC5nZXRTY29wZSgpXG4gICAgICAgICAgICAudmFyaWFibGVzXG4gICAgICAgICAgICAuc29tZSh2YXJpYWJsZSA9PiB2YXJpYWJsZS5uYW1lID09PSAnZXhwb3J0cycpXG4gICAgICAgICAgaWYgKCEgaXNJblNjb3BlKSB7XG4gICAgICAgICAgICBjb250ZXh0LnJlcG9ydCh7IG5vZGUsIG1lc3NhZ2U6IEVYUE9SVF9NRVNTQUdFIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgIH0sXG4gICAgICAnQ2FsbEV4cHJlc3Npb24nOiBmdW5jdGlvbiAoY2FsbCkge1xuICAgICAgICBpZiAoY29udGV4dC5nZXRTY29wZSgpLnR5cGUgIT09ICdtb2R1bGUnKSByZXR1cm5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIGNhbGwucGFyZW50LnR5cGUgIT09ICdFeHByZXNzaW9uU3RhdGVtZW50J1xuICAgICAgICAgICYmIGNhbGwucGFyZW50LnR5cGUgIT09ICdWYXJpYWJsZURlY2xhcmF0b3InXG4gICAgICAgICkgcmV0dXJuXG5cbiAgICAgICAgaWYgKGNhbGwuY2FsbGVlLnR5cGUgIT09ICdJZGVudGlmaWVyJykgcmV0dXJuXG4gICAgICAgIGlmIChjYWxsLmNhbGxlZS5uYW1lICE9PSAncmVxdWlyZScpIHJldHVyblxuXG4gICAgICAgIGlmIChjYWxsLmFyZ3VtZW50cy5sZW5ndGggIT09IDEpIHJldHVyblxuICAgICAgICB2YXIgbW9kdWxlID0gY2FsbC5hcmd1bWVudHNbMF1cblxuICAgICAgICBpZiAobW9kdWxlLnR5cGUgIT09ICdMaXRlcmFsJykgcmV0dXJuXG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlLnZhbHVlICE9PSAnc3RyaW5nJykgcmV0dXJuXG5cbiAgICAgICAgaWYgKGFsbG93UmVxdWlyZShjYWxsLCBvcHRpb25zKSkgcmV0dXJuXG5cbiAgICAgICAgLy8ga2VlcGluZyBpdCBzaW1wbGU6IGFsbCAxLXN0cmluZy1hcmcgYHJlcXVpcmVgIGNhbGxzIGFyZSByZXBvcnRlZFxuICAgICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgICAgbm9kZTogY2FsbC5jYWxsZWUsXG4gICAgICAgICAgbWVzc2FnZTogSU1QT1JUX01FU1NBR0UsXG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgIH1cblxuICB9LFxufVxuIl19