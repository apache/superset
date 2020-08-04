'use strict';

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = (0, _debug2.default)('eslint-plugin-import:rules:newline-after-import');

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/**
 * @fileoverview Rule to enforce new line after import not followed by another import.
 * @author Radek Benkel
 */

function containsNodeOrEqual(outerNode, innerNode) {
  return outerNode.range[0] <= innerNode.range[0] && outerNode.range[1] >= innerNode.range[1];
}

function getScopeBody(scope) {
  if (scope.block.type === 'SwitchStatement') {
    log('SwitchStatement scopes not supported');
    return null;
  }

  const body = scope.block.body;

  if (body && body.type === 'BlockStatement') {
    return body.body;
  }

  return body;
}

function findNodeIndexInScopeBody(body, nodeToFind) {
  return body.findIndex(node => containsNodeOrEqual(node, nodeToFind));
}

function getLineDifference(node, nextNode) {
  return nextNode.loc.start.line - node.loc.end.line;
}

function isClassWithDecorator(node) {
  return node.type === 'ClassDeclaration' && node.decorators && node.decorators.length;
}

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('newline-after-import')
    },
    schema: [{
      'type': 'object',
      'properties': {
        'count': {
          'type': 'integer',
          'minimum': 1
        }
      },
      'additionalProperties': false
    }],
    fixable: 'whitespace'
  },
  create: function (context) {
    let level = 0;
    const requireCalls = [];

    function checkForNewLine(node, nextNode, type) {
      if (isClassWithDecorator(nextNode)) {
        nextNode = nextNode.decorators[0];
      }

      const options = context.options[0] || { count: 1 };
      const lineDifference = getLineDifference(node, nextNode);
      const EXPECTED_LINE_DIFFERENCE = options.count + 1;

      if (lineDifference < EXPECTED_LINE_DIFFERENCE) {
        let column = node.loc.start.column;

        if (node.loc.start.line !== node.loc.end.line) {
          column = 0;
        }

        context.report({
          loc: {
            line: node.loc.end.line,
            column
          },
          message: `Expected ${options.count} empty line${options.count > 1 ? 's' : ''} \
after ${type} statement not followed by another ${type}.`,
          fix: fixer => fixer.insertTextAfter(node, '\n'.repeat(EXPECTED_LINE_DIFFERENCE - lineDifference))
        });
      }
    }

    function incrementLevel() {
      level++;
    }
    function decrementLevel() {
      level--;
    }

    return {
      ImportDeclaration: function (node) {
        const parent = node.parent;

        const nodePosition = parent.body.indexOf(node);
        const nextNode = parent.body[nodePosition + 1];

        if (nextNode && nextNode.type !== 'ImportDeclaration') {
          checkForNewLine(node, nextNode, 'import');
        }
      },
      CallExpression: function (node) {
        if ((0, _staticRequire2.default)(node) && level === 0) {
          requireCalls.push(node);
        }
      },
      'Program:exit': function () {
        log('exit processing for', context.getFilename());
        const scopeBody = getScopeBody(context.getScope());
        log('got scope:', scopeBody);

        requireCalls.forEach(function (node, index) {
          const nodePosition = findNodeIndexInScopeBody(scopeBody, node);
          log('node position in scope:', nodePosition);

          const statementWithRequireCall = scopeBody[nodePosition];
          const nextStatement = scopeBody[nodePosition + 1];
          const nextRequireCall = requireCalls[index + 1];

          if (nextRequireCall && containsNodeOrEqual(statementWithRequireCall, nextRequireCall)) {
            return;
          }

          if (nextStatement && (!nextRequireCall || !containsNodeOrEqual(nextStatement, nextRequireCall))) {

            checkForNewLine(statementWithRequireCall, nextStatement, 'require');
          }
        });
      },
      FunctionDeclaration: incrementLevel,
      FunctionExpression: incrementLevel,
      ArrowFunctionExpression: incrementLevel,
      BlockStatement: incrementLevel,
      ObjectExpression: incrementLevel,
      Decorator: incrementLevel,
      'FunctionDeclaration:exit': decrementLevel,
      'FunctionExpression:exit': decrementLevel,
      'ArrowFunctionExpression:exit': decrementLevel,
      'BlockStatement:exit': decrementLevel,
      'ObjectExpression:exit': decrementLevel,
      'Decorator:exit': decrementLevel
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25ld2xpbmUtYWZ0ZXItaW1wb3J0LmpzIl0sIm5hbWVzIjpbImxvZyIsImNvbnRhaW5zTm9kZU9yRXF1YWwiLCJvdXRlck5vZGUiLCJpbm5lck5vZGUiLCJyYW5nZSIsImdldFNjb3BlQm9keSIsInNjb3BlIiwiYmxvY2siLCJ0eXBlIiwiYm9keSIsImZpbmROb2RlSW5kZXhJblNjb3BlQm9keSIsIm5vZGVUb0ZpbmQiLCJmaW5kSW5kZXgiLCJub2RlIiwiZ2V0TGluZURpZmZlcmVuY2UiLCJuZXh0Tm9kZSIsImxvYyIsInN0YXJ0IiwibGluZSIsImVuZCIsImlzQ2xhc3NXaXRoRGVjb3JhdG9yIiwiZGVjb3JhdG9ycyIsImxlbmd0aCIsIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsInVybCIsInNjaGVtYSIsImZpeGFibGUiLCJjcmVhdGUiLCJjb250ZXh0IiwibGV2ZWwiLCJyZXF1aXJlQ2FsbHMiLCJjaGVja0Zvck5ld0xpbmUiLCJvcHRpb25zIiwiY291bnQiLCJsaW5lRGlmZmVyZW5jZSIsIkVYUEVDVEVEX0xJTkVfRElGRkVSRU5DRSIsImNvbHVtbiIsInJlcG9ydCIsIm1lc3NhZ2UiLCJmaXgiLCJmaXhlciIsImluc2VydFRleHRBZnRlciIsInJlcGVhdCIsImluY3JlbWVudExldmVsIiwiZGVjcmVtZW50TGV2ZWwiLCJJbXBvcnREZWNsYXJhdGlvbiIsInBhcmVudCIsIm5vZGVQb3NpdGlvbiIsImluZGV4T2YiLCJDYWxsRXhwcmVzc2lvbiIsInB1c2giLCJnZXRGaWxlbmFtZSIsInNjb3BlQm9keSIsImdldFNjb3BlIiwiZm9yRWFjaCIsImluZGV4Iiwic3RhdGVtZW50V2l0aFJlcXVpcmVDYWxsIiwibmV4dFN0YXRlbWVudCIsIm5leHRSZXF1aXJlQ2FsbCIsIkZ1bmN0aW9uRGVjbGFyYXRpb24iLCJGdW5jdGlvbkV4cHJlc3Npb24iLCJBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbiIsIkJsb2NrU3RhdGVtZW50IiwiT2Jq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ZS1hZnRlci1pbXBvcnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlb3ZlcnZpZXcgUnVsZSB0byBlbmZvcmNlIG5ldyBsaW5lIGFmdGVyIGltcG9ydCBub3QgZm9sbG93ZWQgYnkgYW5vdGhlciBpbXBvcnQuXG4gKiBAYXV0aG9yIFJhZGVrIEJlbmtlbFxuICovXG5cbmltcG9ydCBpc1N0YXRpY1JlcXVpcmUgZnJvbSAnLi4vY29yZS9zdGF0aWNSZXF1aXJlJ1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxuaW1wb3J0IGRlYnVnIGZyb20gJ2RlYnVnJ1xuY29uc3QgbG9nID0gZGVidWcoJ2VzbGludC1wbHVnaW4taW1wb3J0OnJ1bGVzOm5ld2xpbmUtYWZ0ZXItaW1wb3J0JylcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFJ1bGUgRGVmaW5pdGlvblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gY29udGFpbnNOb2RlT3JFcXVhbChvdXRlck5vZGUsIGlubmVyTm9kZSkge1xuICAgIHJldHVybiBvdXRlck5vZGUucmFuZ2VbMF0gPD0gaW5uZXJOb2RlLnJhbmdlWzBdICYmIG91dGVyTm9kZS5yYW5nZVsxXSA+PSBpbm5lck5vZGUucmFuZ2VbMV1cbn1cblxuZnVuY3Rpb24gZ2V0U2NvcGVCb2R5KHNjb3BlKSB7XG4gICAgaWYgKHNjb3BlLmJsb2NrLnR5cGUgPT09ICdTd2l0Y2hTdGF0ZW1lbnQnKSB7XG4gICAgICBsb2coJ1N3aXRjaFN0YXRlbWVudCBzY29wZXMgbm90IHN1cHBvcnRlZCcpXG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIGNvbnN0IHsgYm9keSB9ID0gc2NvcGUuYmxvY2tcbiAgICBpZiAoYm9keSAmJiBib2R5LnR5cGUgPT09ICdCbG9ja1N0YXRlbWVudCcpIHtcbiAgICAgICAgcmV0dXJuIGJvZHkuYm9keVxuICAgIH1cblxuICAgIHJldHVybiBib2R5XG59XG5cbmZ1bmN0aW9uIGZpbmROb2RlSW5kZXhJblNjb3BlQm9keShib2R5LCBub2RlVG9GaW5kKSB7XG4gICAgcmV0dXJuIGJvZHkuZmluZEluZGV4KChub2RlKSA9PiBjb250YWluc05vZGVPckVxdWFsKG5vZGUsIG5vZGVUb0ZpbmQpKVxufVxuXG5mdW5jdGlvbiBnZXRMaW5lRGlmZmVyZW5jZShub2RlLCBuZXh0Tm9kZSkge1xuICByZXR1cm4gbmV4dE5vZGUubG9jLnN0YXJ0LmxpbmUgLSBub2RlLmxvYy5lbmQubGluZVxufVxuXG5mdW5jdGlvbiBpc0NsYXNzV2l0aERlY29yYXRvcihub2RlKSB7XG4gIHJldHVybiBub2RlLnR5cGUgPT09ICdDbGFzc0RlY2xhcmF0aW9uJyAmJiBub2RlLmRlY29yYXRvcnMgJiYgbm9kZS5kZWNvcmF0b3JzLmxlbmd0aFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIGRvY3M6IHtcbiAgICAgIHVybDogZG9jc1VybCgnbmV3bGluZS1hZnRlci1pbXBvcnQnKSxcbiAgICB9LFxuICAgIHNjaGVtYTogW1xuICAgICAge1xuICAgICAgICAndHlwZSc6ICdvYmplY3QnLFxuICAgICAgICAncHJvcGVydGllcyc6IHtcbiAgICAgICAgICAnY291bnQnOiB7XG4gICAgICAgICAgICAndHlwZSc6ICdpbnRlZ2VyJyxcbiAgICAgICAgICAgICdtaW5pbXVtJzogMSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnYWRkaXRpb25hbFByb3BlcnRpZXMnOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICBmaXhhYmxlOiAnd2hpdGVzcGFjZScsXG4gIH0sXG4gIGNyZWF0ZTogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICBsZXQgbGV2ZWwgPSAwXG4gICAgY29uc3QgcmVxdWlyZUNhbGxzID0gW11cblxuICAgIGZ1bmN0aW9uIGNoZWNrRm9yTmV3TGluZShub2RlLCBuZXh0Tm9kZSwgdHlwZSkge1xuICAgICAgaWYgKGlzQ2xhc3NXaXRoRGVjb3JhdG9yKG5leHROb2RlKSkge1xuICAgICAgICBuZXh0Tm9kZSA9IG5leHROb2RlLmRlY29yYXRvcnNbMF1cbiAgICAgIH1cblxuICAgICAgY29uc3Qgb3B0aW9ucyA9IGNvbnRleHQub3B0aW9uc1swXSB8fCB7IGNvdW50OiAxIH1cbiAgICAgIGNvbnN0IGxpbmVEaWZmZXJlbmNlID0gZ2V0TGluZURpZmZlcmVuY2Uobm9kZSwgbmV4dE5vZGUpXG4gICAgICBjb25zdCBFWFBFQ1RFRF9MSU5FX0RJRkZFUkVOQ0UgPSBvcHRpb25zLmNvdW50ICsgMVxuXG4gICAgICBpZiAobGluZURpZmZlcmVuY2UgPCBFWFBFQ1RFRF9MSU5FX0RJRkZFUkVOQ0UpIHtcbiAgICAgICAgbGV0IGNvbHVtbiA9IG5vZGUubG9jLnN0YXJ0LmNvbHVtblxuXG4gICAgICAgIGlmIChub2RlLmxvYy5zdGFydC5saW5lICE9PSBub2RlLmxvYy5lbmQubGluZSkge1xuICAgICAgICAgIGNvbHVtbiA9IDBcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICBsb2M6IHtcbiAgICAgICAgICAgIGxpbmU6IG5vZGUubG9jLmVuZC5saW5lLFxuICAgICAgICAgICAgY29sdW1uLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbWVzc2FnZTogYEV4cGVjdGVkICR7b3B0aW9ucy5jb3VudH0gZW1wdHkgbGluZSR7b3B0aW9ucy5jb3VudCA+IDEgPyAncycgOiAnJ30gXFxcbmFmdGVyICR7dHlwZX0gc3RhdGVtZW50IG5vdCBmb2xsb3dlZCBieSBhbm90aGVyICR7dHlwZX0uYCxcbiAgICAgICAgICBmaXg6IGZpeGVyID0+IGZpeGVyLmluc2VydFRleHRBZnRlcihcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICAnXFxuJy5yZXBlYXQoRVhQRUNURURfTElORV9ESUZGRVJFTkNFIC0gbGluZURpZmZlcmVuY2UpXG4gICAgICAgICAgKSxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbmNyZW1lbnRMZXZlbCgpIHtcbiAgICAgIGxldmVsKytcbiAgICB9XG4gICAgZnVuY3Rpb24gZGVjcmVtZW50TGV2ZWwoKSB7XG4gICAgICBsZXZlbC0tXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIEltcG9ydERlY2xhcmF0aW9uOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICBjb25zdCB7IHBhcmVudCB9ID0gbm9kZVxuICAgICAgICBjb25zdCBub2RlUG9zaXRpb24gPSBwYXJlbnQuYm9keS5pbmRleE9mKG5vZGUpXG4gICAgICAgIGNvbnN0IG5leHROb2RlID0gcGFyZW50LmJvZHlbbm9kZVBvc2l0aW9uICsgMV1cblxuICAgICAgICBpZiAobmV4dE5vZGUgJiYgbmV4dE5vZGUudHlwZSAhPT0gJ0ltcG9ydERlY2xhcmF0aW9uJykge1xuICAgICAgICAgIGNoZWNrRm9yTmV3TGluZShub2RlLCBuZXh0Tm9kZSwgJ2ltcG9ydCcpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBDYWxsRXhwcmVzc2lvbjogZnVuY3Rpb24obm9kZSkge1xuICAgICAgICBpZiAoaXNTdGF0aWNSZXF1aXJlKG5vZGUpICYmIGxldmVsID09PSAwKSB7XG4gICAgICAgICAgcmVxdWlyZUNhbGxzLnB1c2gobm9kZSlcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICdQcm9ncmFtOmV4aXQnOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxvZygnZXhpdCBwcm9jZXNzaW5nIGZvcicsIGNvbnRleHQuZ2V0RmlsZW5hbWUoKSlcbiAgICAgICAgY29uc3Qgc2NvcGVCb2R5ID0gZ2V0U2NvcGVCb2R5KGNvbnRleHQuZ2V0U2NvcGUoKSlcbiAgICAgICAgbG9nKCdnb3Qgc2NvcGU6Jywgc2NvcGVCb2R5KVxuXG4gICAgICAgIHJlcXVpcmVDYWxscy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlLCBpbmRleCkge1xuICAgICAgICAgIGNvbnN0IG5vZGVQb3NpdGlvbiA9IGZpbmROb2RlSW5kZXhJblNjb3BlQm9keShzY29wZUJvZHksIG5vZGUpXG4gICAgICAgICAgbG9nKCdub2RlIHBvc2l0aW9uIGluIHNjb3BlOicsIG5vZGVQb3NpdGlvbilcblxuICAgICAgICAgIGNvbnN0IHN0YXRlbWVudFdpdGhSZXF1aXJlQ2FsbCA9IHNjb3BlQm9keVtub2RlUG9zaXRpb25dXG4gICAgICAgICAgY29uc3QgbmV4dFN0YXRlbWVudCA9IHNjb3BlQm9keVtub2RlUG9zaXRpb24gKyAxXVxuICAgICAgICAgIGNvbnN0IG5leHRSZXF1aXJlQ2FsbCA9IHJlcXVpcmVDYWxsc1tpbmRleCArIDFdXG5cbiAgICAgICAgICBpZiAobmV4dFJlcXVpcmVDYWxsICYmIGNvbnRhaW5zTm9kZU9yRXF1YWwoc3RhdGVtZW50V2l0aFJlcXVpcmVDYWxsLCBuZXh0UmVxdWlyZUNhbGwpKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobmV4dFN0YXRlbWVudCAmJlxuICAgICAgICAgICAgICghbmV4dFJlcXVpcmVDYWxsIHx8ICFjb250YWluc05vZGVPckVxdWFsKG5leHRTdGF0ZW1lbnQsIG5leHRSZXF1aXJlQ2FsbCkpKSB7XG5cbiAgICAgICAgICAgIGNoZWNrRm9yTmV3TGluZShzdGF0ZW1lbnRXaXRoUmVxdWlyZUNhbGwsIG5leHRTdGF0ZW1lbnQsICdyZXF1aXJlJylcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgICAgRnVuY3Rpb25EZWNsYXJhdGlvbjogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBGdW5jdGlvbkV4cHJlc3Npb246IGluY3JlbWVudExldmVsLFxuICAgICAgQXJyb3dGdW5jdGlvbkV4cHJlc3Npb246IGluY3JlbWVudExldmVsLFxuICAgICAgQmxvY2tTdGF0ZW1lbnQ6IGluY3JlbWVudExldmVsLFxuICAgICAgT2JqZWN0RXhwcmVzc2lvbjogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBEZWNvcmF0b3I6IGluY3JlbWVudExldmVsLFxuICAgICAgJ0Z1bmN0aW9uRGVjbGFyYXRpb246ZXhpdCc6IGRlY3JlbWVudExldmVsLFxuICAgICAgJ0Z1bmN0aW9uRXhwcmVzc2lvbjpleGl0JzogZGVjcmVtZW50TGV2ZWwsXG4gICAgICAnQXJyb3dGdW5jdGlvbkV4cHJlc3Npb246ZXhpdCc6IGRlY3JlbWVudExldmVsLFxuICAgICAgJ0Jsb2NrU3RhdGVtZW50OmV4aXQnOiBkZWNyZW1lbnRMZXZlbCxcbiAgICAgICdPYmplY3RFeHByZXNzaW9uOmV4aXQnOiBkZWNyZW1lbnRMZXZlbCxcbiAgICAgICdEZWNvcmF0b3I6ZXhpdCc6IGRlY3JlbWVudExldmVsLFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==