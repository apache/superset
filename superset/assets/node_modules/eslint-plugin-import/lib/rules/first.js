'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('first')
    },
    fixable: 'code'
  },

  create: function (context) {
    function isPossibleDirective(node) {
      return node.type === 'ExpressionStatement' && node.expression.type === 'Literal' && typeof node.expression.value === 'string';
    }

    return {
      'Program': function (n) {
        const body = n.body,
              absoluteFirst = context.options[0] === 'absolute-first',
              message = 'Import in body of module; reorder to top.',
              sourceCode = context.getSourceCode(),
              originSourceCode = sourceCode.getText();
        let nonImportCount = 0,
            anyExpressions = false,
            anyRelative = false,
            lastLegalImp = null,
            errorInfos = [],
            shouldSort = true,
            lastSortNodesIndex = 0;
        body.forEach(function (node, index) {
          if (!anyExpressions && isPossibleDirective(node)) {
            return;
          }

          anyExpressions = true;

          if (node.type === 'ImportDeclaration') {
            if (absoluteFirst) {
              if (/^\./.test(node.source.value)) {
                anyRelative = true;
              } else if (anyRelative) {
                context.report({
                  node: node.source,
                  message: 'Absolute imports should come before relative imports.'
                });
              }
            }
            if (nonImportCount > 0) {
              for (let variable of context.getDeclaredVariables(node)) {
                if (!shouldSort) break;
                const references = variable.references;
                if (references.length) {
                  for (let reference of references) {
                    if (reference.identifier.range[0] < node.range[1]) {
                      shouldSort = false;
                      break;
                    }
                  }
                }
              }
              shouldSort && (lastSortNodesIndex = errorInfos.length);
              errorInfos.push({
                node,
                range: [body[index - 1].range[1], node.range[1]]
              });
            } else {
              lastLegalImp = node;
            }
          } else {
            nonImportCount++;
          }
        });
        if (!errorInfos.length) return;
        errorInfos.forEach(function (errorInfo, index) {
          const node = errorInfo.node,
                infos = {
            node,
            message
          };
          if (index < lastSortNodesIndex) {
            infos.fix = function (fixer) {
              return fixer.insertTextAfter(node, '');
            };
          } else if (index === lastSortNodesIndex) {
            const sortNodes = errorInfos.slice(0, lastSortNodesIndex + 1);
            infos.fix = function (fixer) {
              const removeFixers = sortNodes.map(function (_errorInfo) {
                return fixer.removeRange(_errorInfo.range);
              }),
                    range = [0, removeFixers[removeFixers.length - 1].range[1]];
              let insertSourceCode = sortNodes.map(function (_errorInfo) {
                const nodeSourceCode = String.prototype.slice.apply(originSourceCode, _errorInfo.range);
                if (/\S/.test(nodeSourceCode[0])) {
                  return '\n' + nodeSourceCode;
                }
                return nodeSourceCode;
              }).join(''),
                  insertFixer = null,
                  replaceSourceCode = '';
              if (!lastLegalImp) {
                insertSourceCode = insertSourceCode.trim() + insertSourceCode.match(/^(\s+)/)[0];
              }
              insertFixer = lastLegalImp ? fixer.insertTextAfter(lastLegalImp, insertSourceCode) : fixer.insertTextBefore(body[0], insertSourceCode);
              const fixers = [insertFixer].concat(removeFixers);
              fixers.forEach(function (computedFixer, i) {
                replaceSourceCode += originSourceCode.slice(fixers[i - 1] ? fixers[i - 1].range[1] : 0, computedFixer.range[0]) + computedFixer.text;
              });
              return fixer.replaceTextRange(range, replaceSourceCode);
            };
          }
          context.report(infos);
        });
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL2ZpcnN0LmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsInVybCIsImZpeGFibGUiLCJjcmVhdGUiLCJjb250ZXh0IiwiaXNQb3NzaWJsZURpcmVjdGl2ZSIsIm5vZGUiLCJ0eXBlIiwiZXhwcmVzc2lvbiIsInZhbHVlIiwibiIsImJvZHkiLCJhYnNvbHV0ZUZpcnN0Iiwib3B0aW9ucyIsIm1lc3NhZ2UiLCJzb3VyY2VDb2RlIiwiZ2V0U291cmNlQ29kZSIsIm9yaWdpblNvdXJjZUNvZGUiLCJnZXRUZXh0Iiwibm9uSW1wb3J0Q291bnQiLCJhbnlFeHByZXNzaW9ucyIsImFueVJlbGF0aXZlIiwibGFzdExlZ2FsSW1wIiwiZXJyb3JJbmZvcyIsInNob3VsZFNvcnQiLCJsYXN0U29ydE5vZGVzSW5kZXgiLCJmb3JFYWNoIiwiaW5kZXgiLCJ0ZXN0Iiwic291cmNlIiwicmVwb3J0IiwidmFyaWFibGUiLCJnZXREZWNsYXJlZFZhcmlhYmxlcyIsInJlZmVyZW5jZXMiLCJsZW5ndGgiLCJyZWZlcmVuY2UiLCJpZGVudGlmaWVyIiwicmFuZ2UiLCJwdXNoIiwiZXJyb3JJbmZvIiwiaW5mb3MiLCJmaXgiLCJmaXhlciIsImluc2VydFRleHRBZnRlciIsInNvcnROb2RlcyIsInNsaWNlIiwicmVtb3ZlRml4ZXJzIiwibWFwIiwiX2Vycm9ySW5mbyIsInJlbW92ZVJhbmdlIiwiaW5zZXJ0U291cmNlQ29kZSIsIm5vZGVTb3VyY2VDb2RlIiwiU3RyaW5nIiwicHJvdG90eXBlIiwiYXBwbHkiLCJqb2luIiwiaW5zZXJ0Rml4ZXIiLCJyZXBsYWNlU291cmNlQ29kZSIsInRyaW0iLCJtYXRjaCIsImluc2VydFRleHRCZWZvcmUiLCJmaXhlcnMiLCJjb25jYXQiLCJjb21wdXRlZEZpeGVyIiwiaSIsInRleHQiLCJyZXBsYWNlVGV4dFJhbmdlIl0sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7QUFFQUEsT0FBT0MsT0FBUCxHQUFp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QkFBSSxDQUFDbkMsWUFBTCxFQUFtQjtBQUNmNEIsbUNBQ0VBLGlCQUFpQlEsSUFBakIsS0FBMEJSLGlCQUFpQlMsS0FBakIsQ0FBdUIsUUFBdkIsRUFBaUMsQ0FBakMsQ0FENUI7QUFFSDtBQUNESCw0QkFBY2xDLGVBQ0FvQixNQUFNQyxlQUFOLENBQXNCckIsWUFBdEIsRUFBb0M0QixnQkFBcEMsQ0FEQSxHQUVBUixNQUFNa0IsZ0JBQU4sQ0FBdUJqRCxLQUFLLENBQUwsQ0FBdkIsRUFBZ0N1QyxnQkFBaEMsQ0FGZDtBQUdBLG9CQUFNVyxTQUFTLENBQUNMLFdBQUQsRUFBY00sTUFBZCxDQUFxQmhCLFlBQXJCLENBQWY7QUFDQWUscUJBQU9uQyxPQUFQLENBQWUsVUFBVXFDLGFBQVYsRUFBeUJDLENBQXpCLEVBQTRCO0FBQ3pDUCxxQ0FBc0J4QyxpQkFBaUI0QixLQUFqQixDQUNwQmdCLE9BQU9HLElBQUksQ0FBWCxJQUFnQkgsT0FBT0csSUFBSSxDQUFYLEVBQWMzQixLQUFkLENBQW9CLENBQXBCLENBQWhCLEdBQXlDLENBRHJCLEVBQ3dCMEIsY0FBYzFCLEtBQWQsQ0FBb0IsQ0FBcEIsQ0FEeEIsSUFFbEIwQixjQUFjRSxJQUZsQjtBQUdELGVBSkQ7QUFLQSxxQkFBT3ZCLE1BQU13QixnQkFBTixDQUF1QjdCLEtBQXZCLEVBQThCb0IsaUJBQTlCLENBQVA7QUFDRCxhQTlCRDtBQStCRDtBQUNEckQsa0JBQVEwQixNQUFSLENBQWVVLEtBQWY7QUFDRCxTQTdDRDtBQThDRDtBQXhHSSxLQUFQO0FBMEdEO0FBekhjLENBQWpCIiwiZmlsZSI6InJ1bGVzL2ZpcnN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ2ZpcnN0JyksXG4gICAgfSxcbiAgICBmaXhhYmxlOiAnY29kZScsXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIGZ1bmN0aW9uIGlzUG9zc2libGVEaXJlY3RpdmUgKG5vZGUpIHtcbiAgICAgIHJldHVybiBub2RlLnR5cGUgPT09ICdFeHByZXNzaW9uU3RhdGVtZW50JyAmJlxuICAgICAgICBub2RlLmV4cHJlc3Npb24udHlwZSA9PT0gJ0xpdGVyYWwnICYmXG4gICAgICAgIHR5cGVvZiBub2RlLmV4cHJlc3Npb24udmFsdWUgPT09ICdzdHJpbmcnXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICdQcm9ncmFtJzogZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgY29uc3QgYm9keSA9IG4uYm9keVxuICAgICAgICAgICAgLCBhYnNvbHV0ZUZpcnN0ID0gY29udGV4dC5vcHRpb25zWzBdID09PSAnYWJzb2x1dGUtZmlyc3QnXG4gICAgICAgICAgICAsIG1lc3NhZ2UgPSAnSW1wb3J0IGluIGJvZHkgb2YgbW9kdWxlOyByZW9yZGVyIHRvIHRvcC4nXG4gICAgICAgICAgICAsIHNvdXJjZUNvZGUgPSBjb250ZXh0LmdldFNvdXJjZUNvZGUoKVxuICAgICAgICAgICAgLCBvcmlnaW5Tb3VyY2VDb2RlID0gc291cmNlQ29kZS5nZXRUZXh0KClcbiAgICAgICAgbGV0IG5vbkltcG9ydENvdW50ID0gMFxuICAgICAgICAgICwgYW55RXhwcmVzc2lvbnMgPSBmYWxzZVxuICAgICAgICAgICwgYW55UmVsYXRpdmUgPSBmYWxzZVxuICAgICAgICAgICwgbGFzdExlZ2FsSW1wID0gbnVsbFxuICAgICAgICAgICwgZXJyb3JJbmZvcyA9IFtdXG4gICAgICAgICAgLCBzaG91bGRTb3J0ID0gdHJ1ZVxuICAgICAgICAgICwgbGFzdFNvcnROb2Rlc0luZGV4ID0gMFxuICAgICAgICBib2R5LmZvckVhY2goZnVuY3Rpb24gKG5vZGUsIGluZGV4KXtcbiAgICAgICAgICBpZiAoIWFueUV4cHJlc3Npb25zICYmIGlzUG9zc2libGVEaXJlY3RpdmUobm9kZSkpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cblxuICAgICAgICAgIGFueUV4cHJlc3Npb25zID0gdHJ1ZVxuXG4gICAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gJ0ltcG9ydERlY2xhcmF0aW9uJykge1xuICAgICAgICAgICAgaWYgKGFic29sdXRlRmlyc3QpIHtcbiAgICAgICAgICAgICAgaWYgKC9eXFwuLy50ZXN0KG5vZGUuc291cmNlLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGFueVJlbGF0aXZlID0gdHJ1ZVxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFueVJlbGF0aXZlKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgICAgICAgbm9kZTogbm9kZS5zb3VyY2UsXG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQWJzb2x1dGUgaW1wb3J0cyBzaG91bGQgY29tZSBiZWZvcmUgcmVsYXRpdmUgaW1wb3J0cy4nLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChub25JbXBvcnRDb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgZm9yIChsZXQgdmFyaWFibGUgb2YgY29udGV4dC5nZXREZWNsYXJlZFZhcmlhYmxlcyhub2RlKSkge1xuICAgICAgICAgICAgICAgIGlmICghc2hvdWxkU29ydCkgYnJlYWtcbiAgICAgICAgICAgICAgICBjb25zdCByZWZlcmVuY2VzID0gdmFyaWFibGUucmVmZXJlbmNlc1xuICAgICAgICAgICAgICAgIGlmIChyZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgZm9yIChsZXQgcmVmZXJlbmNlIG9mIHJlZmVyZW5jZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZmVyZW5jZS5pZGVudGlmaWVyLnJhbmdlWzBdIDwgbm9kZS5yYW5nZVsxXSkge1xuICAgICAgICAgICAgICAgICAgICAgIHNob3VsZFNvcnQgPSBmYWxzZVxuICAgICAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgc2hvdWxkU29ydCAmJiAobGFzdFNvcnROb2Rlc0luZGV4ID0gZXJyb3JJbmZvcy5sZW5ndGgpXG4gICAgICAgICAgICAgIGVycm9ySW5mb3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgICAgICByYW5nZTogW2JvZHlbaW5kZXggLSAxXS5yYW5nZVsxXSwgbm9kZS5yYW5nZVsxXV0sXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsYXN0TGVnYWxJbXAgPSBub2RlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vbkltcG9ydENvdW50KytcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIGlmICghZXJyb3JJbmZvcy5sZW5ndGgpIHJldHVyblxuICAgICAgICBlcnJvckluZm9zLmZvckVhY2goZnVuY3Rpb24gKGVycm9ySW5mbywgaW5kZXgpIHtcbiAgICAgICAgICBjb25zdCBub2RlID0gZXJyb3JJbmZvLm5vZGVcbiAgICAgICAgICAgICAgLCBpbmZvcyA9IHtcbiAgICAgICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaW5kZXggPCBsYXN0U29ydE5vZGVzSW5kZXgpIHtcbiAgICAgICAgICAgIGluZm9zLmZpeCA9IGZ1bmN0aW9uIChmaXhlcikge1xuICAgICAgICAgICAgICByZXR1cm4gZml4ZXIuaW5zZXJ0VGV4dEFmdGVyKG5vZGUsICcnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoaW5kZXggPT09IGxhc3RTb3J0Tm9kZXNJbmRleCkge1xuICAgICAgICAgICAgY29uc3Qgc29ydE5vZGVzID0gZXJyb3JJbmZvcy5zbGljZSgwLCBsYXN0U29ydE5vZGVzSW5kZXggKyAxKVxuICAgICAgICAgICAgaW5mb3MuZml4ID0gZnVuY3Rpb24gKGZpeGVyKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlbW92ZUZpeGVycyA9IHNvcnROb2Rlcy5tYXAoZnVuY3Rpb24gKF9lcnJvckluZm8pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpeGVyLnJlbW92ZVJhbmdlKF9lcnJvckluZm8ucmFuZ2UpXG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgLCByYW5nZSA9IFswLCByZW1vdmVGaXhlcnNbcmVtb3ZlRml4ZXJzLmxlbmd0aCAtIDFdLnJhbmdlWzFdXVxuICAgICAgICAgICAgICBsZXQgaW5zZXJ0U291cmNlQ29kZSA9IHNvcnROb2Rlcy5tYXAoZnVuY3Rpb24gKF9lcnJvckluZm8pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZVNvdXJjZUNvZGUgPSBTdHJpbmcucHJvdG90eXBlLnNsaWNlLmFwcGx5KFxuICAgICAgICAgICAgICAgICAgICAgIG9yaWdpblNvdXJjZUNvZGUsIF9lcnJvckluZm8ucmFuZ2VcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICBpZiAoL1xcUy8udGVzdChub2RlU291cmNlQ29kZVswXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ1xcbicgKyBub2RlU291cmNlQ29kZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBub2RlU291cmNlQ29kZVxuICAgICAgICAgICAgICAgICAgfSkuam9pbignJylcbiAgICAgICAgICAgICAgICAsIGluc2VydEZpeGVyID0gbnVsbFxuICAgICAgICAgICAgICAgICwgcmVwbGFjZVNvdXJjZUNvZGUgPSAnJ1xuICAgICAgICAgICAgICBpZiAoIWxhc3RMZWdhbEltcCkge1xuICAgICAgICAgICAgICAgICAgaW5zZXJ0U291cmNlQ29kZSA9XG4gICAgICAgICAgICAgICAgICAgIGluc2VydFNvdXJjZUNvZGUudHJpbSgpICsgaW5zZXJ0U291cmNlQ29kZS5tYXRjaCgvXihcXHMrKS8pWzBdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaW5zZXJ0Rml4ZXIgPSBsYXN0TGVnYWxJbXAgPyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaXhlci5pbnNlcnRUZXh0QWZ0ZXIobGFzdExlZ2FsSW1wLCBpbnNlcnRTb3VyY2VDb2RlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZml4ZXIuaW5zZXJ0VGV4dEJlZm9yZShib2R5WzBdLCBpbnNlcnRTb3VyY2VDb2RlKVxuICAgICAgICAgICAgICBjb25zdCBmaXhlcnMgPSBbaW5zZXJ0Rml4ZXJdLmNvbmNhdChyZW1vdmVGaXhlcnMpXG4gICAgICAgICAgICAgIGZpeGVycy5mb3JFYWNoKGZ1bmN0aW9uIChjb21wdXRlZEZpeGVyLCBpKSB7XG4gICAgICAgICAgICAgICAgcmVwbGFjZVNvdXJjZUNvZGUgKz0gKG9yaWdpblNvdXJjZUNvZGUuc2xpY2UoXG4gICAgICAgICAgICAgICAgICBmaXhlcnNbaSAtIDFdID8gZml4ZXJzW2kgLSAxXS5yYW5nZVsxXSA6IDAsIGNvbXB1dGVkRml4ZXIucmFuZ2VbMF1cbiAgICAgICAgICAgICAgICApICsgY29tcHV0ZWRGaXhlci50ZXh0KVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICByZXR1cm4gZml4ZXIucmVwbGFjZVRleHRSYW5nZShyYW5nZSwgcmVwbGFjZVNvdXJjZUNvZGUpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRleHQucmVwb3J0KGluZm9zKVxuICAgICAgICB9KVxuICAgICAgfSxcbiAgICB9XG4gIH0sXG59XG4iXX0=