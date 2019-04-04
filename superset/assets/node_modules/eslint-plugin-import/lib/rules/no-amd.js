'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
    meta: {
        docs: {
            url: (0, _docsUrl2.default)('no-amd')
        }
    },

    create: function (context) {

        return {

            'CallExpression': function (node) {
                if (context.getScope().type !== 'module') return;

                if (node.callee.type !== 'Identifier') return;
                if (node.callee.name !== 'require' && node.callee.name !== 'define') return;

                // todo: capture define((require, module, exports) => {}) form?
                if (node.arguments.length !== 2) return;

                const modules = node.arguments[0];
                if (modules.type !== 'ArrayExpression') return;

                // todo: check second arg type? (identifier or callback)

                context.report(node, `Expected imports instead of AMD ${node.callee.name}().`);
            }
        };
    }
}; /**
    * @fileoverview Rule to prefer imports to AMD
    * @author Jamund Ferguson
    */
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLWFtZC5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJjb250ZXh0Iiwibm9kZSIsImdldFNjb3BlIiwidHlwZSIsImNhbGxlZSIsIm5hbWUiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJtb2R1bGVzIiwicmVwb3J0Il0sIm1hcHBpbmdzIjoiOztBQUtBOzs7Ozs7QUFFQTtBQUNBO0FBQ0E7O0FBRUFBLE9BQU9DLE9BQVAsR0FBaUI7QUFDYkMsVUFBTTtBQUNGQyxjQUFNO0FBQ0ZDLGlCQUFLLHVCQUFRLFFBQVI7QUFESDtBQURKLEtBRE87O0FBT2JDLFlBQVEsVUFBVUMsT0FBVixFQUFtQjs7QUFFdkIsZUFBTzs7QUFFSCw4QkFBa0IsVUFBVUMsSUFBVixFQUFnQjtBQUNwQyxvQkFBSUQsUUFBUUUsUUFBUixHQUFtQkMsSUFBbkIsS0FBNEIsUUFBaEMsRUFBMEM7O0FBRTFDLG9CQUFJRixLQUFLRyxNQUFMLENBQVlELElBQVosS0FBcUIsWUFBekIsRUFBdUM7QUFDdkMsb0JBQUlGLEtBQUtHLE1BQUwsQ0FBWUMsSUFBWixLQUFxQixTQUFyQixJQUNBSixLQUFLRyxNQUFMLENBQVlDLElBQVosS0FBcUIsUUFEekIsRUFDbUM7O0FBRW5DO0FBQ0Esb0JBQUlKLEtBQUtLLFNBQUwsQ0FBZUMsTUFBZixLQUEwQixDQUE5QixFQUFpQzs7QUFFakMsc0JBQU1DLFVBQVVQLEtBQUtLLFNBQUwsQ0FBZSxDQUFmLENBQWhCO0FBQ0Esb0JBQUlFLFFBQVFMLElBQVIsS0FBaUIsaUJBQXJCLEVBQXdDOztBQUV4Qzs7QUFFTUgsd0JBQVFTLE1BQVIsQ0FBZVIsSUFBZixFQUFzQixtQ0FBa0NBLEtBQUtHLE1BQUwsQ0FBWUMsSUFBSyxLQUF6RTtBQUNIO0FBbEJFLFNBQVA7QUFxQkg7QUE5QlksQ0FBakIsQyxDQVhBIiwiZmlsZSI6InJ1bGVzL25vLWFtZC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGVvdmVydmlldyBSdWxlIHRvIHByZWZlciBpbXBvcnRzIHRvIEFNRFxuICogQGF1dGhvciBKYW11bmQgRmVyZ3Vzb25cbiAqL1xuXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gUnVsZSBEZWZpbml0aW9uXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBtZXRhOiB7XG4gICAgICAgIGRvY3M6IHtcbiAgICAgICAgICAgIHVybDogZG9jc1VybCgnbm8tYW1kJyksXG4gICAgICAgIH0sXG4gICAgfSxcblxuICAgIGNyZWF0ZTogZnVuY3Rpb24gKGNvbnRleHQpIHtcblxuICAgICAgICByZXR1cm4ge1xuXG4gICAgICAgICAgICAnQ2FsbEV4cHJlc3Npb24nOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgIGlmIChjb250ZXh0LmdldFNjb3BlKCkudHlwZSAhPT0gJ21vZHVsZScpIHJldHVyblxuXG4gICAgICAgICAgaWYgKG5vZGUuY2FsbGVlLnR5cGUgIT09ICdJZGVudGlmaWVyJykgcmV0dXJuXG4gICAgICAgICAgaWYgKG5vZGUuY2FsbGVlLm5hbWUgIT09ICdyZXF1aXJlJyAmJlxuICAgICAgICAgICAgICBub2RlLmNhbGxlZS5uYW1lICE9PSAnZGVmaW5lJykgcmV0dXJuXG5cbiAgICAgICAgICAvLyB0b2RvOiBjYXB0dXJlIGRlZmluZSgocmVxdWlyZSwgbW9kdWxlLCBleHBvcnRzKSA9PiB7fSkgZm9ybT9cbiAgICAgICAgICBpZiAobm9kZS5hcmd1bWVudHMubGVuZ3RoICE9PSAyKSByZXR1cm5cblxuICAgICAgICAgIGNvbnN0IG1vZHVsZXMgPSBub2RlLmFyZ3VtZW50c1swXVxuICAgICAgICAgIGlmIChtb2R1bGVzLnR5cGUgIT09ICdBcnJheUV4cHJlc3Npb24nKSByZXR1cm5cblxuICAgICAgICAgIC8vIHRvZG86IGNoZWNrIHNlY29uZCBhcmcgdHlwZT8gKGlkZW50aWZpZXIgb3IgY2FsbGJhY2spXG5cbiAgICAgICAgICAgICAgICBjb250ZXh0LnJlcG9ydChub2RlLCBgRXhwZWN0ZWQgaW1wb3J0cyBpbnN0ZWFkIG9mIEFNRCAke25vZGUuY2FsbGVlLm5hbWV9KCkuYClcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH1cblxuICAgIH0sXG59XG4iXX0=