'use strict';

var _importType = require('../core/importType');

var _importType2 = _interopRequireDefault(_importType);

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const defaultGroups = ['builtin', 'external', 'parent', 'sibling', 'index'];

// REPORTING AND FIXING

function reverse(array) {
  return array.map(function (v) {
    return {
      name: v.name,
      rank: -v.rank,
      node: v.node
    };
  }).reverse();
}

function getTokensOrCommentsAfter(sourceCode, node, count) {
  let currentNodeOrToken = node;
  const result = [];
  for (let i = 0; i < count; i++) {
    currentNodeOrToken = sourceCode.getTokenOrCommentAfter(currentNodeOrToken);
    if (currentNodeOrToken == null) {
      break;
    }
    result.push(currentNodeOrToken);
  }
  return result;
}

function getTokensOrCommentsBefore(sourceCode, node, count) {
  let currentNodeOrToken = node;
  const result = [];
  for (let i = 0; i < count; i++) {
    currentNodeOrToken = sourceCode.getTokenOrCommentBefore(currentNodeOrToken);
    if (currentNodeOrToken == null) {
      break;
    }
    result.push(currentNodeOrToken);
  }
  return result.reverse();
}

function takeTokensAfterWhile(sourceCode, node, condition) {
  const tokens = getTokensOrCommentsAfter(sourceCode, node, 100);
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    if (condition(tokens[i])) {
      result.push(tokens[i]);
    } else {
      break;
    }
  }
  return result;
}

function takeTokensBeforeWhile(sourceCode, node, condition) {
  const tokens = getTokensOrCommentsBefore(sourceCode, node, 100);
  const result = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (condition(tokens[i])) {
      result.push(tokens[i]);
    } else {
      break;
    }
  }
  return result.reverse();
}

function findOutOfOrder(imported) {
  if (imported.length === 0) {
    return [];
  }
  let maxSeenRankNode = imported[0];
  return imported.filter(function (importedModule) {
    const res = importedModule.rank < maxSeenRankNode.rank;
    if (maxSeenRankNode.rank < importedModule.rank) {
      maxSeenRankNode = importedModule;
    }
    return res;
  });
}

function findRootNode(node) {
  let parent = node;
  while (parent.parent != null && parent.parent.body == null) {
    parent = parent.parent;
  }
  return parent;
}

function findEndOfLineWithComments(sourceCode, node) {
  const tokensToEndOfLine = takeTokensAfterWhile(sourceCode, node, commentOnSameLineAs(node));
  let endOfTokens = tokensToEndOfLine.length > 0 ? tokensToEndOfLine[tokensToEndOfLine.length - 1].range[1] : node.range[1];
  let result = endOfTokens;
  for (let i = endOfTokens; i < sourceCode.text.length; i++) {
    if (sourceCode.text[i] === '\n') {
      result = i + 1;
      break;
    }
    if (sourceCode.text[i] !== ' ' && sourceCode.text[i] !== '\t' && sourceCode.text[i] !== '\r') {
      break;
    }
    result = i + 1;
  }
  return result;
}

function commentOnSameLineAs(node) {
  return token => (token.type === 'Block' || token.type === 'Line') && token.loc.start.line === token.loc.end.line && token.loc.end.line === node.loc.end.line;
}

function findStartOfLineWithComments(sourceCode, node) {
  const tokensToEndOfLine = takeTokensBeforeWhile(sourceCode, node, commentOnSameLineAs(node));
  let startOfTokens = tokensToEndOfLine.length > 0 ? tokensToEndOfLine[0].range[0] : node.range[0];
  let result = startOfTokens;
  for (let i = startOfTokens - 1; i > 0; i--) {
    if (sourceCode.text[i] !== ' ' && sourceCode.text[i] !== '\t') {
      break;
    }
    result = i;
  }
  return result;
}

function isPlainRequireModule(node) {
  if (node.type !== 'VariableDeclaration') {
    return false;
  }
  if (node.declarations.length !== 1) {
    return false;
  }
  const decl = node.declarations[0];
  const result = decl.id != null && decl.id.type === 'Identifier' && decl.init != null && decl.init.type === 'CallExpression' && decl.init.callee != null && decl.init.callee.name === 'require' && decl.init.arguments != null && decl.init.arguments.length === 1 && decl.init.arguments[0].type === 'Literal';
  return result;
}

function isPlainImportModule(node) {
  return node.type === 'ImportDeclaration' && node.specifiers != null && node.specifiers.length > 0;
}

function canCrossNodeWhileReorder(node) {
  return isPlainRequireModule(node) || isPlainImportModule(node);
}

function canReorderItems(firstNode, secondNode) {
  const parent = firstNode.parent;
  const firstIndex = parent.body.indexOf(firstNode);
  const secondIndex = parent.body.indexOf(secondNode);
  const nodesBetween = parent.body.slice(firstIndex, secondIndex + 1);
  for (var nodeBetween of nodesBetween) {
    if (!canCrossNodeWhileReorder(nodeBetween)) {
      return false;
    }
  }
  return true;
}

function fixOutOfOrder(context, firstNode, secondNode, order) {
  const sourceCode = context.getSourceCode();

  const firstRoot = findRootNode(firstNode.node);
  let firstRootStart = findStartOfLineWithComments(sourceCode, firstRoot);
  const firstRootEnd = findEndOfLineWithComments(sourceCode, firstRoot);

  const secondRoot = findRootNode(secondNode.node);
  let secondRootStart = findStartOfLineWithComments(sourceCode, secondRoot);
  let secondRootEnd = findEndOfLineWithComments(sourceCode, secondRoot);
  const canFix = canReorderItems(firstRoot, secondRoot);

  let newCode = sourceCode.text.substring(secondRootStart, secondRootEnd);
  if (newCode[newCode.length - 1] !== '\n') {
    newCode = newCode + '\n';
  }

  const message = '`' + secondNode.name + '` import should occur ' + order + ' import of `' + firstNode.name + '`';

  if (order === 'before') {
    context.report({
      node: secondNode.node,
      message: message,
      fix: canFix && (fixer => fixer.replaceTextRange([firstRootStart, secondRootEnd], newCode + sourceCode.text.substring(firstRootStart, secondRootStart)))
    });
  } else if (order === 'after') {
    context.report({
      node: secondNode.node,
      message: message,
      fix: canFix && (fixer => fixer.replaceTextRange([secondRootStart, firstRootEnd], sourceCode.text.substring(secondRootEnd, firstRootEnd) + newCode))
    });
  }
}

function reportOutOfOrder(context, imported, outOfOrder, order) {
  outOfOrder.forEach(function (imp) {
    const found = imported.find(function hasHigherRank(importedItem) {
      return importedItem.rank > imp.rank;
    });
    fixOutOfOrder(context, found, imp, order);
  });
}

function makeOutOfOrderReport(context, imported) {
  const outOfOrder = findOutOfOrder(imported);
  if (!outOfOrder.length) {
    return;
  }
  // There are things to report. Try to minimize the number of reported errors.
  const reversedImported = reverse(imported);
  const reversedOrder = findOutOfOrder(reversedImported);
  if (reversedOrder.length < outOfOrder.length) {
    reportOutOfOrder(context, reversedImported, reversedOrder, 'after');
    return;
  }
  reportOutOfOrder(context, imported, outOfOrder, 'before');
}

// DETECTING

function computeRank(context, ranks, name, type) {
  return ranks[(0, _importType2.default)(name, context)] + (type === 'import' ? 0 : 100);
}

function registerNode(context, node, name, type, ranks, imported) {
  const rank = computeRank(context, ranks, name, type);
  if (rank !== -1) {
    imported.push({ name, rank, node });
  }
}

function isInVariableDeclarator(node) {
  return node && (node.type === 'VariableDeclarator' || isInVariableDeclarator(node.parent));
}

const types = ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'];

// Creates an object with type-rank pairs.
// Example: { index: 0, sibling: 1, parent: 1, external: 1, builtin: 2, internal: 2 }
// Will throw an error if it contains a type that does not exist, or has a duplicate
function convertGroupsToRanks(groups) {
  const rankObject = groups.reduce(function (res, group, index) {
    if (typeof group === 'string') {
      group = [group];
    }
    group.forEach(function (groupItem) {
      if (types.indexOf(groupItem) === -1) {
        throw new Error('Incorrect configuration of the rule: Unknown type `' + JSON.stringify(groupItem) + '`');
      }
      if (res[groupItem] !== undefined) {
        throw new Error('Incorrect configuration of the rule: `' + groupItem + '` is duplicated');
      }
      res[groupItem] = index;
    });
    return res;
  }, {});

  const omittedTypes = types.filter(function (type) {
    return rankObject[type] === undefined;
  });

  return omittedTypes.reduce(function (res, type) {
    res[type] = groups.length;
    return res;
  }, rankObject);
}

function fixNewLineAfterImport(context, previousImport) {
  const prevRoot = findRootNode(previousImport.node);
  const tokensToEndOfLine = takeTokensAfterWhile(context.getSourceCode(), prevRoot, commentOnSameLineAs(prevRoot));

  let endOfLine = prevRoot.range[1];
  if (tokensToEndOfLine.length > 0) {
    endOfLine = tokensToEndOfLine[tokensToEndOfLine.length - 1].range[1];
  }
  return fixer => fixer.insertTextAfterRange([prevRoot.range[0], endOfLine], '\n');
}

function removeNewLineAfterImport(context, currentImport, previousImport) {
  const sourceCode = context.getSourceCode();
  const prevRoot = findRootNode(previousImport.node);
  const currRoot = findRootNode(currentImport.node);
  const rangeToRemove = [findEndOfLineWithComments(sourceCode, prevRoot), findStartOfLineWithComments(sourceCode, currRoot)];
  if (/^\s*$/.test(sourceCode.text.substring(rangeToRemove[0], rangeToRemove[1]))) {
    return fixer => fixer.removeRange(rangeToRemove);
  }
  return undefined;
}

function makeNewlinesBetweenReport(context, imported, newlinesBetweenImports) {
  const getNumberOfEmptyLinesBetween = (currentImport, previousImport) => {
    const linesBetweenImports = context.getSourceCode().lines.slice(previousImport.node.loc.end.line, currentImport.node.loc.start.line - 1);

    return linesBetweenImports.filter(line => !line.trim().length).length;
  };
  let previousImport = imported[0];

  imported.slice(1).forEach(function (currentImport) {
    const emptyLinesBetween = getNumberOfEmptyLinesBetween(currentImport, previousImport);

    if (newlinesBetweenImports === 'always' || newlinesBetweenImports === 'always-and-inside-groups') {
      if (currentImport.rank !== previousImport.rank && emptyLinesBetween === 0) {
        context.report({
          node: previousImport.node,
          message: 'There should be at least one empty line between import groups',
          fix: fixNewLineAfterImport(context, previousImport, currentImport)
        });
      } else if (currentImport.rank === previousImport.rank && emptyLinesBetween > 0 && newlinesBetweenImports !== 'always-and-inside-groups') {
        context.report({
          node: previousImport.node,
          message: 'There should be no empty line within import group',
          fix: removeNewLineAfterImport(context, currentImport, previousImport)
        });
      }
    } else if (emptyLinesBetween > 0) {
      context.report({
        node: previousImport.node,
        message: 'There should be no empty line between import groups',
        fix: removeNewLineAfterImport(context, currentImport, previousImport)
      });
    }

    previousImport = currentImport;
  });
}

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('order')
    },

    fixable: 'code',
    schema: [{
      type: 'object',
      properties: {
        groups: {
          type: 'array'
        },
        'newlines-between': {
          enum: ['ignore', 'always', 'always-and-inside-groups', 'never']
        }
      },
      additionalProperties: false
    }]
  },

  create: function importOrderRule(context) {
    const options = context.options[0] || {};
    const newlinesBetweenImports = options['newlines-between'] || 'ignore';
    let ranks;

    try {
      ranks = convertGroupsToRanks(options.groups || defaultGroups);
    } catch (error) {
      // Malformed configuration
      return {
        Program: function (node) {
          context.report(node, error.message);
        }
      };
    }
    let imported = [];
    let level = 0;

    function incrementLevel() {
      level++;
    }
    function decrementLevel() {
      level--;
    }

    return {
      ImportDeclaration: function handleImports(node) {
        if (node.specifiers.length) {
          // Ignoring unassigned imports
          const name = node.source.value;
          registerNode(context, node, name, 'import', ranks, imported);
        }
      },
      CallExpression: function handleRequires(node) {
        if (level !== 0 || !(0, _staticRequire2.default)(node) || !isInVariableDeclarator(node.parent)) {
          return;
        }
        const name = node.arguments[0].value;
        registerNode(context, node, name, 'require', ranks, imported);
      },
      'Program:exit': function reportAndReset() {
        makeOutOfOrderReport(context, imported);

        if (newlinesBetweenImports !== 'ignore') {
          makeNewlinesBetweenReport(context, imported, newlinesBetweenImports);
        }

        imported = [];
      },
      FunctionDeclaration: incrementLevel,
      FunctionExpression: incrementLevel,
      ArrowFunctionExpression: incrementLevel,
      BlockStatement: incrementLevel,
      ObjectExpression: incrementLevel,
      'FunctionDeclaration:exit': decrementLevel,
      'FunctionExpression:exit': decrementLevel,
      'ArrowFunctionExpression:exit': decrementLevel,
      'BlockStatement:exit': decrementLevel,
      'ObjectExpression:exit': decrementLevel
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL29yZGVyLmpzIl0sIm5hbWVzIjpbImRlZmF1bHRHcm91cHMiLCJyZXZlcnNlIiwiYXJyYXkiLCJtYXAiLCJ2IiwibmFtZSIsInJhbmsiLCJub2RlIiwiZ2V0VG9rZW5zT3JDb21tZW50c0FmdGVyIiwic291cmNlQ29kZSIsImNvdW50IiwiY3VycmVudE5vZGVPclRva2VuIiwicmVzdWx0IiwiaSIsImdldFRva2VuT3JDb21tZW50QWZ0ZXIiLCJwdXNoIiwiZ2V0VG9rZW5zT3JDb21tZW50c0JlZm9yZSIsImdldFRva2VuT3JDb21tZW50QmVmb3JlIiwidGFrZVRva2Vuc0FmdGVyV2hpbGUiLCJjb25kaXRpb24iLCJ0b2tlbnMiLCJsZW5ndGgiLCJ0YWtlVG9rZW5zQmVmb3JlV2hpbGUiLCJmaW5kT3V0T2ZPcmRlciIsImltcG9ydGVkIiwibWF4U2VlblJhbmtOb2RlIiwiZmlsdGVyIiwiaW1wb3J0ZWRNb2R1bGUiLCJyZXMiLCJmaW5kUm9vdE5vZGUiLCJwYXJlbnQiLCJib2R5IiwiZmluZEVuZE9mTGluZVdpdGhDb21tZW50cyIsInRva2Vuc1RvRW5kT2ZMaW5lIiwiY29tbWVudE9uU2FtZUxpbmVBcyIsImVuZE9mVG9rZW5zIiwicmFuZ2UiLCJ0ZXh0IiwidG9rZW4iLCJ0eXBlIiwibG9jIiwic3RhcnQiLCJsaW5lIiwiZW5kIiwiZmluZFN0YXJ0T2ZMaW5lV2l0aENvbW1lbnRzIiwic3RhcnRPZlRva2VucyIsImlzUGxhaW5SZXF1aXJlTW9kdWxlIiwiZGVjbGFyYXRpb25zIiwiZGVjbCIsImlkIiwiaW5pdCIsImNhbGxlZSIsImFyZ3VtZW50cyIsImlzUGxhaW5JbXBvcnRNb2R1bGUiLCJzcGVjaWZpZXJzIiwiY2FuQ3Jvc3NOb2RlV2hpbGVSZW9yZGVyIiwiY2FuUmVvcmRlckl0ZW1zIiwiZmlyc3ROb2RlIiwic2Vjb25kTm9kZSIsImZpcnN0SW5kZXgiLCJpbmRleE9mIiwic2Vjb25kSW5kZXgiLCJub2Rlc0JldHdlZW4iLCJzbGljZSIsIm5vZGVCZXR3ZWVuIiwiZml4T3V0T2ZPcmRlciIsImNvbnRleHQiLCJvcmRlciIsImdldFNvdXJjZUNvZGUiLCJmaXJzdFJvb3QiLCJmaXJzdFJvb3RTdGFydCIsImZpcnN0Um9vdEVuZCIsInNlY29uZFJvb3QiLCJzZWNvbmRSb290U3RhcnQiLCJzZWNvbmRSb290RW5kIiwiY2FuRml4IiwibmV3Q29kZSIsInN1YnN0cmluZyIsIm1lc3NhZ2UiLCJyZXBvcnQiLCJmaXgiLCJmaXhlciIsInJlcGxhY2VUZXh0UmFuZ2UiLCJyZXBvcnRPdXRPZk9yZGVyIiwib3V0T2ZPcmRlciIsImZvckVhY2giLCJpbXAiLCJmb3VuZCIsImZpbmQiLCJoYXNIaWdoZXJSYW5rIiwiaW1wb3J0ZWRJdGVtIiwibWFrZU91dE9mT3JkZXJSZXBvcnQiLCJyZXZlcnNlZEltcG9ydGVkIiwicmV2ZXJzZWRPcmRlciIsImNvbXB1dGVSYW5rIiwicmFua3MiLCJyZWdpc3Rlck5vZGUiLCJpc0luVmFyaWFibGVEZWNsYXJhdG9yIiwidHlwZXMiLCJjb252ZXJ0R3JvdXBzVG9SYW5rcyIsImdyb3VwcyIsInJhbmtPYmplY3QiLCJyZWR1Y2UiLCJncm91cCIsImluZGV4IiwiZ3JvdXBJdGVtIiwiRXJyb3IiLCJKU09OIiwic3RyaW5naWZ5IiwidW5kZWZpbmVkIiwib21pdHRlZFR5cGVzIiwiZml4TmV3TGluZUFmdGVySW1wb3J0IiwicHJldmlvdXNJbXBvcnQiLCJwcmV2Um9vdCIsImVuZE9mTGluZSIsImluc2VydFRleHRBZnRlclJhbmdlIiwicmVtb3ZlTmV3TGluZUFmdGVySW1wb3J0IiwiY3VycmVudEltcG9ydCIsImN1cnJSb290IiwicmFuZ2VUb1JlbW92ZSIsInRlc3QiLCJyZW1vdmVSYW5nZSIsIm1ha2VOZXdsaW5lc0JldHdlZW5SZXBvcnQiLCJuZXdsaW5lc0JldHdlZW5JbXBvcnRzIiwiZ2V0TnVtYmVyT2ZFbXB0eUxpbmVzQmV0d2VlbiIsImxpbmVzQmV0d2VlbkltcG9ydHMiLCJsaW5lcyIsInRyaW0iLCJlbXB0eUxpbmVzQmV0d2VlbiIsIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsInVybCIsImZpeGFibGUiLCJzY2hlbWEiLCJwcm9wZXJ0aWVzIiwiZW51bSIsImFkZGl0aW9uYWxQcm9wZXJ0aWVzIiwiY3JlYXRlIiwiaW1wb3J0T3JkZXJSdWxlIiwib3B0aW9ucyIsImVycm9yIiwiUHJvZ3JhbSIsImxldmVsIiwiaW5jcmVtZW50TGV2ZWwiLCJkZWNyZW1lbnRMZXZlbCIsIkltcG9ydERlY2xhcmF0aW9uIiwiaGFuZGxlSW1wb3J0cyIsInNvdXJjZSIsInZhbHVlIiwiQ2FsbEV4cHJlc3Npb24iLCJoYW5kbGVSZXF1aXJlcyIsInJlcG9ydEFuZFJlc2V0IiwiRnVuY3Rpb25EZWNsYXJhdGlvbiIsIkZ1bmN0aW9uRXhwcmVzc2lvbiIsIkFycm93RnVuY3Rpb25FeHByZXNzaW9uIiwiQmxvY2tTdGF0ZW1lbnQiLCJPYmplY3RFeHByZXNzaW9uIl0sIm1hcHBpbmdzIjoiQUFBQTs7QUFFQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztBQUVBLE1BQU1BLGdCQUFnQixDQUFDLFNBQUQsRUFBWSxVQUFaLEVBQXdCLFFBQXhCLEVBQWtDLFNBQWxDLEVBQTZDLE9BQTdDLENBQXRCOztBQUVBOztBQUVBLFNBQVNDLE9BQVQsQ0FBaUJDLEtBQWpCLEVBQXdCO0FBQ3RCLFNBQU9BLE1BQU1DLEdBQU4sQ0FBVSxVQUFVQyxDQUFWLEVBQWE7QUFDNUIsV0FBTztBQUNMQyxZQUFNRCxFQUFFQyxJQURIO0FBRUxDLFlBQU0sQ0FBQ0YsRUFBRUUsSUFGSjtBQUdMQyxZQUFNSCxFQUFFRztBQUhILEtBQVA7QUFLRCxHQU5NLEVBTUpOLE9BTkksRUFBUDtBQU9EOztBQUVELFNBQVNPLHdCQUFULENBQWtDQyxVQUFsQyxFQUE4Q0YsSUFBOUMsRUFBb0RHLEtBQXBELEVBQTJEO0FBQ3pELE1BQUlDLHFCQUFxQkosSUFBekI7QUFDQSxRQUFNSyxTQUFTLEVBQWY7QUFDQSxPQUFLLElBQUlDLElBQUksQ0FBYixFQUFnQkEsSUFB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QWJJO0FBY0wsc0JBQWdCLFNBQVNpSSxjQUFULEdBQTBCO0FBQ3hDOUQsNkJBQXFCekIsT0FBckIsRUFBOEIxQyxRQUE5Qjs7QUFFQSxZQUFJbUcsMkJBQTJCLFFBQS9CLEVBQXlDO0FBQ3ZDRCxvQ0FBMEJ4RCxPQUExQixFQUFtQzFDLFFBQW5DLEVBQTZDbUcsc0JBQTdDO0FBQ0Q7O0FBRURuRyxtQkFBVyxFQUFYO0FBQ0QsT0F0Qkk7QUF1QkxrSSwyQkFBcUJULGNBdkJoQjtBQXdCTFUsMEJBQW9CVixjQXhCZjtBQXlCTFcsK0JBQXlCWCxjQXpCcEI7QUEwQkxZLHNCQUFnQlosY0ExQlg7QUEyQkxhLHdCQUFrQmIsY0EzQmI7QUE0Qkwsa0NBQTRCQyxjQTVCdkI7QUE2QkwsaUNBQTJCQSxjQTdCdEI7QUE4Qkwsc0NBQWdDQSxjQTlCM0I7QUErQkwsNkJBQXVCQSxjQS9CbEI7QUFnQ0wsK0JBQXlCQTtBQWhDcEIsS0FBUDtBQWtDRDtBQXZGYyxDQUFqQiIsImZpbGUiOiJydWxlcy9vcmRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0J1xuXG5pbXBvcnQgaW1wb3J0VHlwZSBmcm9tICcuLi9jb3JlL2ltcG9ydFR5cGUnXG5pbXBvcnQgaXNTdGF0aWNSZXF1aXJlIGZyb20gJy4uL2NvcmUvc3RhdGljUmVxdWlyZSdcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbmNvbnN0IGRlZmF1bHRHcm91cHMgPSBbJ2J1aWx0aW4nLCAnZXh0ZXJuYWwnLCAncGFyZW50JywgJ3NpYmxpbmcnLCAnaW5kZXgnXVxuXG4vLyBSRVBPUlRJTkcgQU5EIEZJWElOR1xuXG5mdW5jdGlvbiByZXZlcnNlKGFycmF5KSB7XG4gIHJldHVybiBhcnJheS5tYXAoZnVuY3Rpb24gKHYpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogdi5uYW1lLFxuICAgICAgcmFuazogLXYucmFuayxcbiAgICAgIG5vZGU6IHYubm9kZSxcbiAgICB9XG4gIH0pLnJldmVyc2UoKVxufVxuXG5mdW5jdGlvbiBnZXRUb2tlbnNPckNvbW1lbnRzQWZ0ZXIoc291cmNlQ29kZSwgbm9kZSwgY291bnQpIHtcbiAgbGV0IGN1cnJlbnROb2RlT3JUb2tlbiA9IG5vZGVcbiAgY29uc3QgcmVzdWx0ID0gW11cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgY3VycmVudE5vZGVPclRva2VuID0gc291cmNlQ29kZS5nZXRUb2tlbk9yQ29tbWVudEFmdGVyKGN1cnJlbnROb2RlT3JUb2tlbilcbiAgICBpZiAoY3VycmVudE5vZGVPclRva2VuID09IG51bGwpIHtcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIHJlc3VsdC5wdXNoKGN1cnJlbnROb2RlT3JUb2tlbilcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIGdldFRva2Vuc09yQ29tbWVudHNCZWZvcmUoc291cmNlQ29kZSwgbm9kZSwgY291bnQpIHtcbiAgbGV0IGN1cnJlbnROb2RlT3JUb2tlbiA9IG5vZGVcbiAgY29uc3QgcmVzdWx0ID0gW11cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgY3VycmVudE5vZGVPclRva2VuID0gc291cmNlQ29kZS5nZXRUb2tlbk9yQ29tbWVudEJlZm9yZShjdXJyZW50Tm9kZU9yVG9rZW4pXG4gICAgaWYgKGN1cnJlbnROb2RlT3JUb2tlbiA9PSBudWxsKSB7XG4gICAgICBicmVha1xuICAgIH1cbiAgICByZXN1bHQucHVzaChjdXJyZW50Tm9kZU9yVG9rZW4pXG4gIH1cbiAgcmV0dXJuIHJlc3VsdC5yZXZlcnNlKClcbn1cblxuZnVuY3Rpb24gdGFrZVRva2Vuc0FmdGVyV2hpbGUoc291cmNlQ29kZSwgbm9kZSwgY29uZGl0aW9uKSB7XG4gIGNvbnN0IHRva2VucyA9IGdldFRva2Vuc09yQ29tbWVudHNBZnRlcihzb3VyY2VDb2RlLCBub2RlLCAxMDApXG4gIGNvbnN0IHJlc3VsdCA9IFtdXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGNvbmRpdGlvbih0b2tlbnNbaV0pKSB7XG4gICAgICByZXN1bHQucHVzaCh0b2tlbnNbaV0pXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiB0YWtlVG9rZW5zQmVmb3JlV2hpbGUoc291cmNlQ29kZSwgbm9kZSwgY29uZGl0aW9uKSB7XG4gIGNvbnN0IHRva2VucyA9IGdldFRva2Vuc09yQ29tbWVudHNCZWZvcmUoc291cmNlQ29kZSwgbm9kZSwgMTAwKVxuICBjb25zdCByZXN1bHQgPSBbXVxuICBmb3IgKGxldCBpID0gdG9rZW5zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGNvbmRpdGlvbih0b2tlbnNbaV0pKSB7XG4gICAgICByZXN1bHQucHVzaCh0b2tlbnNbaV0pXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdC5yZXZlcnNlKClcbn1cblxuZnVuY3Rpb24gZmluZE91dE9mT3JkZXIoaW1wb3J0ZWQpIHtcbiAgaWYgKGltcG9ydGVkLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBbXVxuICB9XG4gIGxldCBtYXhTZWVuUmFua05vZGUgPSBpbXBvcnRlZFswXVxuICByZXR1cm4gaW1wb3J0ZWQuZmlsdGVyKGZ1bmN0aW9uIChpbXBvcnRlZE1vZHVsZSkge1xuICAgIGNvbnN0IHJlcyA9IGltcG9ydGVkTW9kdWxlLnJhbmsgPCBtYXhTZWVuUmFua05vZGUucmFua1xuICAgIGlmIChtYXhTZWVuUmFua05vZGUucmFuayA8IGltcG9ydGVkTW9kdWxlLnJhbmspIHtcbiAgICAgIG1heFNlZW5SYW5rTm9kZSA9IGltcG9ydGVkTW9kdWxlXG4gICAgfVxuICAgIHJldHVybiByZXNcbiAgfSlcbn1cblxuZnVuY3Rpb24gZmluZFJvb3ROb2RlKG5vZGUpIHtcbiAgbGV0IHBhcmVudCA9IG5vZGVcbiAgd2hpbGUgKHBhcmVudC5wYXJlbnQgIT0gbnVsbCAmJiBwYXJlbnQucGFyZW50LmJvZHkgPT0gbnVsbCkge1xuICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnRcbiAgfVxuICByZXR1cm4gcGFyZW50XG59XG5cbmZ1bmN0aW9uIGZpbmRFbmRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgbm9kZSkge1xuICBjb25zdCB0b2tlbnNUb0VuZE9mTGluZSA9IHRha2VUb2tlbnNBZnRlcldoaWxlKHNvdXJjZUNvZGUsIG5vZGUsIGNvbW1lbnRPblNhbWVMaW5lQXMobm9kZSkpXG4gIGxldCBlbmRPZlRva2VucyA9IHRva2Vuc1RvRW5kT2ZMaW5lLmxlbmd0aCA+IDBcbiAgICA/IHRva2Vuc1RvRW5kT2ZMaW5lW3Rva2Vuc1RvRW5kT2ZMaW5lLmxlbmd0aCAtIDFdLnJhbmdlWzFdXG4gICAgOiBub2RlLnJhbmdlWzFdXG4gIGxldCByZXN1bHQgPSBlbmRPZlRva2Vuc1xuICBmb3IgKGxldCBpID0gZW5kT2ZUb2tlbnM7IGkgPCBzb3VyY2VDb2RlLnRleHQubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoc291cmNlQ29kZS50ZXh0W2ldID09PSAnXFxuJykge1xuICAgICAgcmVzdWx0ID0gaSArIDFcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGlmIChzb3VyY2VDb2RlLnRleHRbaV0gIT09ICcgJyAmJiBzb3VyY2VDb2RlLnRleHRbaV0gIT09ICdcXHQnICYmIHNvdXJjZUNvZGUudGV4dFtpXSAhPT0gJ1xccicpIHtcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIHJlc3VsdCA9IGkgKyAxXG4gIH1cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiBjb21tZW50T25TYW1lTGluZUFzKG5vZGUpIHtcbiAgcmV0dXJuIHRva2VuID0+ICh0b2tlbi50eXBlID09PSAnQmxvY2snIHx8ICB0b2tlbi50eXBlID09PSAnTGluZScpICYmXG4gICAgICB0b2tlbi5sb2Muc3RhcnQubGluZSA9PT0gdG9rZW4ubG9jLmVuZC5saW5lICYmXG4gICAgICB0b2tlbi5sb2MuZW5kLmxpbmUgPT09IG5vZGUubG9jLmVuZC5saW5lXG59XG5cbmZ1bmN0aW9uIGZpbmRTdGFydE9mTGluZVdpdGhDb21tZW50cyhzb3VyY2VDb2RlLCBub2RlKSB7XG4gIGNvbnN0IHRva2Vuc1RvRW5kT2ZMaW5lID0gdGFrZVRva2Vuc0JlZm9yZVdoaWxlKHNvdXJjZUNvZGUsIG5vZGUsIGNvbW1lbnRPblNhbWVMaW5lQXMobm9kZSkpXG4gIGxldCBzdGFydE9mVG9rZW5zID0gdG9rZW5zVG9FbmRPZkxpbmUubGVuZ3RoID4gMCA/IHRva2Vuc1RvRW5kT2ZMaW5lWzBdLnJhbmdlWzBdIDogbm9kZS5yYW5nZVswXVxuICBsZXQgcmVzdWx0ID0gc3RhcnRPZlRva2Vuc1xuICBmb3IgKGxldCBpID0gc3RhcnRPZlRva2VucyAtIDE7IGkgPiAwOyBpLS0pIHtcbiAgICBpZiAoc291cmNlQ29kZS50ZXh0W2ldICE9PSAnICcgJiYgc291cmNlQ29kZS50ZXh0W2ldICE9PSAnXFx0Jykge1xuICAgICAgYnJlYWtcbiAgICB9XG4gICAgcmVzdWx0ID0gaVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gaXNQbGFpblJlcXVpcmVNb2R1bGUobm9kZSkge1xuICBpZiAobm9kZS50eXBlICE9PSAnVmFyaWFibGVEZWNsYXJhdGlvbicpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICBpZiAobm9kZS5kZWNsYXJhdGlvbnMubGVuZ3RoICE9PSAxKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgY29uc3QgZGVjbCA9IG5vZGUuZGVjbGFyYXRpb25zWzBdXG4gIGNvbnN0IHJlc3VsdCA9IChkZWNsLmlkICE9IG51bGwgJiYgIGRlY2wuaWQudHlwZSA9PT0gJ0lkZW50aWZpZXInKSAmJlxuICAgIGRlY2wuaW5pdCAhPSBudWxsICYmXG4gICAgZGVjbC5pbml0LnR5cGUgPT09ICdDYWxsRXhwcmVzc2lvbicgJiZcbiAgICBkZWNsLmluaXQuY2FsbGVlICE9IG51bGwgJiZcbiAgICBkZWNsLmluaXQuY2FsbGVlLm5hbWUgPT09ICdyZXF1aXJlJyAmJlxuICAgIGRlY2wuaW5pdC5hcmd1bWVudHMgIT0gbnVsbCAmJlxuICAgIGRlY2wuaW5pdC5hcmd1bWVudHMubGVuZ3RoID09PSAxICYmXG4gICAgZGVjbC5pbml0LmFyZ3VtZW50c1swXS50eXBlID09PSAnTGl0ZXJhbCdcbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiBpc1BsYWluSW1wb3J0TW9kdWxlKG5vZGUpIHtcbiAgcmV0dXJuIG5vZGUudHlwZSA9PT0gJ0ltcG9ydERlY2xhcmF0aW9uJyAmJiBub2RlLnNwZWNpZmllcnMgIT0gbnVsbCAmJiBub2RlLnNwZWNpZmllcnMubGVuZ3RoID4gMFxufVxuXG5mdW5jdGlvbiBjYW5Dcm9zc05vZGVXaGlsZVJlb3JkZXIobm9kZSkge1xuICByZXR1cm4gaXNQbGFpblJlcXVpcmVNb2R1bGUobm9kZSkgfHwgaXNQbGFpbkltcG9ydE1vZHVsZShub2RlKVxufVxuXG5mdW5jdGlvbiBjYW5SZW9yZGVySXRlbXMoZmlyc3ROb2RlLCBzZWNvbmROb2RlKSB7XG4gIGNvbnN0IHBhcmVudCA9IGZpcnN0Tm9kZS5wYXJlbnRcbiAgY29uc3QgZmlyc3RJbmRleCA9IHBhcmVudC5ib2R5LmluZGV4T2YoZmlyc3ROb2RlKVxuICBjb25zdCBzZWNvbmRJbmRleCA9IHBhcmVudC5ib2R5LmluZGV4T2Yoc2Vjb25kTm9kZSlcbiAgY29uc3Qgbm9kZXNCZXR3ZWVuID0gcGFyZW50LmJvZHkuc2xpY2UoZmlyc3RJbmRleCwgc2Vjb25kSW5kZXggKyAxKVxuICBmb3IgKHZhciBub2RlQmV0d2VlbiBvZiBub2Rlc0JldHdlZW4pIHtcbiAgICBpZiAoIWNhbkNyb3NzTm9kZVdoaWxlUmVvcmRlcihub2RlQmV0d2VlbikpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZVxufVxuXG5mdW5jdGlvbiBmaXhPdXRPZk9yZGVyKGNvbnRleHQsIGZpcnN0Tm9kZSwgc2Vjb25kTm9kZSwgb3JkZXIpIHtcbiAgY29uc3Qgc291cmNlQ29kZSA9IGNvbnRleHQuZ2V0U291cmNlQ29kZSgpXG5cbiAgY29uc3QgZmlyc3RSb290ID0gZmluZFJvb3ROb2RlKGZpcnN0Tm9kZS5ub2RlKVxuICBsZXQgZmlyc3RSb290U3RhcnQgPSBmaW5kU3RhcnRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgZmlyc3RSb290KVxuICBjb25zdCBmaXJzdFJvb3RFbmQgPSBmaW5kRW5kT2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIGZpcnN0Um9vdClcblxuICBjb25zdCBzZWNvbmRSb290ID0gZmluZFJvb3ROb2RlKHNlY29uZE5vZGUubm9kZSlcbiAgbGV0IHNlY29uZFJvb3RTdGFydCA9IGZpbmRTdGFydE9mTGluZVdpdGhDb21tZW50cyhzb3VyY2VDb2RlLCBzZWNvbmRSb290KVxuICBsZXQgc2Vjb25kUm9vdEVuZCA9IGZpbmRFbmRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgc2Vjb25kUm9vdClcbiAgY29uc3QgY2FuRml4ID0gY2FuUmVvcmRlckl0ZW1zKGZpcnN0Um9vdCwgc2Vjb25kUm9vdClcblxuICBsZXQgbmV3Q29kZSA9IHNvdXJjZUNvZGUudGV4dC5zdWJzdHJpbmcoc2Vjb25kUm9vdFN0YXJ0LCBzZWNvbmRSb290RW5kKVxuICBpZiAobmV3Q29kZVtuZXdDb2RlLmxlbmd0aCAtIDFdICE9PSAnXFxuJykge1xuICAgIG5ld0NvZGUgPSBuZXdDb2RlICsgJ1xcbidcbiAgfVxuXG4gIGNvbnN0IG1lc3NhZ2UgPSAnYCcgKyBzZWNvbmROb2RlLm5hbWUgKyAnYCBpbXBvcnQgc2hvdWxkIG9jY3VyICcgKyBvcmRlciArXG4gICAgICAnIGltcG9ydCBvZiBgJyArIGZpcnN0Tm9kZS5uYW1lICsgJ2AnXG5cbiAgaWYgKG9yZGVyID09PSAnYmVmb3JlJykge1xuICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgIG5vZGU6IHNlY29uZE5vZGUubm9kZSxcbiAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICBmaXg6IGNhbkZpeCAmJiAoZml4ZXIgPT5cbiAgICAgICAgZml4ZXIucmVwbGFjZVRleHRSYW5nZShcbiAgICAgICAgICBbZmlyc3RSb290U3RhcnQsIHNlY29uZFJvb3RFbmRdLFxuICAgICAgICAgIG5ld0NvZGUgKyBzb3VyY2VDb2RlLnRleHQuc3Vic3RyaW5nKGZpcnN0Um9vdFN0YXJ0LCBzZWNvbmRSb290U3RhcnQpXG4gICAgICAgICkpLFxuICAgIH0pXG4gIH0gZWxzZSBpZiAob3JkZXIgPT09ICdhZnRlcicpIHtcbiAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICBub2RlOiBzZWNvbmROb2RlLm5vZGUsXG4gICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgZml4OiBjYW5GaXggJiYgKGZpeGVyID0+XG4gICAgICAgIGZpeGVyLnJlcGxhY2VUZXh0UmFuZ2UoXG4gICAgICAgICAgW3NlY29uZFJvb3RTdGFydCwgZmlyc3RSb290RW5kXSxcbiAgICAgICAgICBzb3VyY2VDb2RlLnRleHQuc3Vic3RyaW5nKHNlY29uZFJvb3RFbmQsIGZpcnN0Um9vdEVuZCkgKyBuZXdDb2RlXG4gICAgICAgICkpLFxuICAgIH0pXG4gIH1cbn1cblxuZnVuY3Rpb24gcmVwb3J0T3V0T2ZPcmRlcihjb250ZXh0LCBpbXBvcnRlZCwgb3V0T2ZPcmRlciwgb3JkZXIpIHtcbiAgb3V0T2ZPcmRlci5mb3JFYWNoKGZ1bmN0aW9uIChpbXApIHtcbiAgICBjb25zdCBmb3VuZCA9IGltcG9ydGVkLmZpbmQoZnVuY3Rpb24gaGFzSGlnaGVyUmFuayhpbXBvcnRlZEl0ZW0pIHtcbiAgICAgIHJldHVybiBpbXBvcnRlZEl0ZW0ucmFuayA+IGltcC5yYW5rXG4gICAgfSlcbiAgICBmaXhPdXRPZk9yZGVyKGNvbnRleHQsIGZvdW5kLCBpbXAsIG9yZGVyKVxuICB9KVxufVxuXG5mdW5jdGlvbiBtYWtlT3V0T2ZPcmRlclJlcG9ydChjb250ZXh0LCBpbXBvcnRlZCkge1xuICBjb25zdCBvdXRPZk9yZGVyID0gZmluZE91dE9mT3JkZXIoaW1wb3J0ZWQpXG4gIGlmICghb3V0T2ZPcmRlci5sZW5ndGgpIHtcbiAgICByZXR1cm5cbiAgfVxuICAvLyBUaGVyZSBhcmUgdGhpbmdzIHRvIHJlcG9ydC4gVHJ5IHRvIG1pbmltaXplIHRoZSBudW1iZXIgb2YgcmVwb3J0ZWQgZXJyb3JzLlxuICBjb25zdCByZXZlcnNlZEltcG9ydGVkID0gcmV2ZXJzZShpbXBvcnRlZClcbiAgY29uc3QgcmV2ZXJzZWRPcmRlciA9IGZpbmRPdXRPZk9yZGVyKHJldmVyc2VkSW1wb3J0ZWQpXG4gIGlmIChyZXZlcnNlZE9yZGVyLmxlbmd0aCA8IG91dE9mT3JkZXIubGVuZ3RoKSB7XG4gICAgcmVwb3J0T3V0T2ZPcmRlcihjb250ZXh0LCByZXZlcnNlZEltcG9ydGVkLCByZXZlcnNlZE9yZGVyLCAnYWZ0ZXInKVxuICAgIHJldHVyblxuICB9XG4gIHJlcG9ydE91dE9mT3JkZXIoY29udGV4dCwgaW1wb3J0ZWQsIG91dE9mT3JkZXIsICdiZWZvcmUnKVxufVxuXG4vLyBERVRFQ1RJTkdcblxuZnVuY3Rpb24gY29tcHV0ZVJhbmsoY29udGV4dCwgcmFua3MsIG5hbWUsIHR5cGUpIHtcbiAgcmV0dXJuIHJhbmtzW2ltcG9ydFR5cGUobmFtZSwgY29udGV4dCldICtcbiAgICAodHlwZSA9PT0gJ2ltcG9ydCcgPyAwIDogMTAwKVxufVxuXG5mdW5jdGlvbiByZWdpc3Rlck5vZGUoY29udGV4dCwgbm9kZSwgbmFtZSwgdHlwZSwgcmFua3MsIGltcG9ydGVkKSB7XG4gIGNvbnN0IHJhbmsgPSBjb21wdXRlUmFuayhjb250ZXh0LCByYW5rcywgbmFtZSwgdHlwZSlcbiAgaWYgKHJhbmsgIT09IC0xKSB7XG4gICAgaW1wb3J0ZWQucHVzaCh7bmFtZSwgcmFuaywgbm9kZX0pXG4gIH1cbn1cblxuZnVuY3Rpb24gaXNJblZhcmlhYmxlRGVjbGFyYXRvcihub2RlKSB7XG4gIHJldHVybiBub2RlICYmXG4gICAgKG5vZGUudHlwZSA9PT0gJ1ZhcmlhYmxlRGVjbGFyYXRvcicgfHwgaXNJblZhcmlhYmxlRGVjbGFyYXRvcihub2RlLnBhcmVudCkpXG59XG5cbmNvbnN0IHR5cGVzID0gWydidWlsdGluJywgJ2V4dGVybmFsJywgJ2ludGVybmFsJywgJ3BhcmVudCcsICdzaWJsaW5nJywgJ2luZGV4J11cblxuLy8gQ3JlYXRlcyBhbiBvYmplY3Qgd2l0aCB0eXBlLXJhbmsgcGFpcnMuXG4vLyBFeGFtcGxlOiB7IGluZGV4OiAwLCBzaWJsaW5nOiAxLCBwYXJlbnQ6IDEsIGV4dGVybmFsOiAxLCBidWlsdGluOiAyLCBpbnRlcm5hbDogMiB9XG4vLyBXaWxsIHRocm93IGFuIGVycm9yIGlmIGl0IGNvbnRhaW5zIGEgdHlwZSB0aGF0IGRvZXMgbm90IGV4aXN0LCBvciBoYXMgYSBkdXBsaWNhdGVcbmZ1bmN0aW9uIGNvbnZlcnRHcm91cHNUb1JhbmtzKGdyb3Vwcykge1xuICBjb25zdCByYW5rT2JqZWN0ID0gZ3JvdXBzLnJlZHVjZShmdW5jdGlvbihyZXMsIGdyb3VwLCBpbmRleCkge1xuICAgIGlmICh0eXBlb2YgZ3JvdXAgPT09ICdzdHJpbmcnKSB7XG4gICAgICBncm91cCA9IFtncm91cF1cbiAgICB9XG4gICAgZ3JvdXAuZm9yRWFjaChmdW5jdGlvbihncm91cEl0ZW0pIHtcbiAgICAgIGlmICh0eXBlcy5pbmRleE9mKGdyb3VwSXRlbSkgPT09IC0xKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW5jb3JyZWN0IGNvbmZpZ3VyYXRpb24gb2YgdGhlIHJ1bGU6IFVua25vd24gdHlwZSBgJyArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkoZ3JvdXBJdGVtKSArICdgJylcbiAgICAgIH1cbiAgICAgIGlmIChyZXNbZ3JvdXBJdGVtXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW5jb3JyZWN0IGNvbmZpZ3VyYXRpb24gb2YgdGhlIHJ1bGU6IGAnICsgZ3JvdXBJdGVtICsgJ2AgaXMgZHVwbGljYXRlZCcpXG4gICAgICB9XG4gICAgICByZXNbZ3JvdXBJdGVtXSA9IGluZGV4XG4gICAgfSlcbiAgICByZXR1cm4gcmVzXG4gIH0sIHt9KVxuXG4gIGNvbnN0IG9taXR0ZWRUeXBlcyA9IHR5cGVzLmZpbHRlcihmdW5jdGlvbih0eXBlKSB7XG4gICAgcmV0dXJuIHJhbmtPYmplY3RbdHlwZV0gPT09IHVuZGVmaW5lZFxuICB9KVxuXG4gIHJldHVybiBvbWl0dGVkVHlwZXMucmVkdWNlKGZ1bmN0aW9uKHJlcywgdHlwZSkge1xuICAgIHJlc1t0eXBlXSA9IGdyb3Vwcy5sZW5ndGhcbiAgICByZXR1cm4gcmVzXG4gIH0sIHJhbmtPYmplY3QpXG59XG5cbmZ1bmN0aW9uIGZpeE5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBwcmV2aW91c0ltcG9ydCkge1xuICBjb25zdCBwcmV2Um9vdCA9IGZpbmRSb290Tm9kZShwcmV2aW91c0ltcG9ydC5ub2RlKVxuICBjb25zdCB0b2tlbnNUb0VuZE9mTGluZSA9IHRha2VUb2tlbnNBZnRlcldoaWxlKFxuICAgIGNvbnRleHQuZ2V0U291cmNlQ29kZSgpLCBwcmV2Um9vdCwgY29tbWVudE9uU2FtZUxpbmVBcyhwcmV2Um9vdCkpXG5cbiAgbGV0IGVuZE9mTGluZSA9IHByZXZSb290LnJhbmdlWzFdXG4gIGlmICh0b2tlbnNUb0VuZE9mTGluZS5sZW5ndGggPiAwKSB7XG4gICAgZW5kT2ZMaW5lID0gdG9rZW5zVG9FbmRPZkxpbmVbdG9rZW5zVG9FbmRPZkxpbmUubGVuZ3RoIC0gMV0ucmFuZ2VbMV1cbiAgfVxuICByZXR1cm4gKGZpeGVyKSA9PiBmaXhlci5pbnNlcnRUZXh0QWZ0ZXJSYW5nZShbcHJldlJvb3QucmFuZ2VbMF0sIGVuZE9mTGluZV0sICdcXG4nKVxufVxuXG5mdW5jdGlvbiByZW1vdmVOZXdMaW5lQWZ0ZXJJbXBvcnQoY29udGV4dCwgY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpIHtcbiAgY29uc3Qgc291cmNlQ29kZSA9IGNvbnRleHQuZ2V0U291cmNlQ29kZSgpXG4gIGNvbnN0IHByZXZSb290ID0gZmluZFJvb3ROb2RlKHByZXZpb3VzSW1wb3J0Lm5vZGUpXG4gIGNvbnN0IGN1cnJSb290ID0gZmluZFJvb3ROb2RlKGN1cnJlbnRJbXBvcnQubm9kZSlcbiAgY29uc3QgcmFuZ2VUb1JlbW92ZSA9IFtcbiAgICBmaW5kRW5kT2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIHByZXZSb290KSxcbiAgICBmaW5kU3RhcnRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgY3VyclJvb3QpLFxuICBdXG4gIGlmICgvXlxccyokLy50ZXN0KHNvdXJjZUNvZGUudGV4dC5zdWJzdHJpbmcocmFuZ2VUb1JlbW92ZVswXSwgcmFuZ2VUb1JlbW92ZVsxXSkpKSB7XG4gICAgcmV0dXJuIChmaXhlcikgPT4gZml4ZXIucmVtb3ZlUmFuZ2UocmFuZ2VUb1JlbW92ZSlcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkXG59XG5cbmZ1bmN0aW9uIG1ha2VOZXdsaW5lc0JldHdlZW5SZXBvcnQgKGNvbnRleHQsIGltcG9ydGVkLCBuZXdsaW5lc0JldHdlZW5JbXBvcnRzKSB7XG4gIGNvbnN0IGdldE51bWJlck9mRW1wdHlMaW5lc0JldHdlZW4gPSAoY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpID0+IHtcbiAgICBjb25zdCBsaW5lc0JldHdlZW5JbXBvcnRzID0gY29udGV4dC5nZXRTb3VyY2VDb2RlKCkubGluZXMuc2xpY2UoXG4gICAgICBwcmV2aW91c0ltcG9ydC5ub2RlLmxvYy5lbmQubGluZSxcbiAgICAgIGN1cnJlbnRJbXBvcnQubm9kZS5sb2Muc3RhcnQubGluZSAtIDFcbiAgICApXG5cbiAgICByZXR1cm4gbGluZXNCZXR3ZWVuSW1wb3J0cy5maWx0ZXIoKGxpbmUpID0+ICFsaW5lLnRyaW0oKS5sZW5ndGgpLmxlbmd0aFxuICB9XG4gIGxldCBwcmV2aW91c0ltcG9ydCA9IGltcG9ydGVkWzBdXG5cbiAgaW1wb3J0ZWQuc2xpY2UoMSkuZm9yRWFjaChmdW5jdGlvbihjdXJyZW50SW1wb3J0KSB7XG4gICAgY29uc3QgZW1wdHlMaW5lc0JldHdlZW4gPSBnZXROdW1iZXJPZkVtcHR5TGluZXNCZXR3ZWVuKGN1cnJlbnRJbXBvcnQsIHByZXZpb3VzSW1wb3J0KVxuXG4gICAgaWYgKG5ld2xpbmVzQmV0d2VlbkltcG9ydHMgPT09ICdhbHdheXMnXG4gICAgICAgIHx8IG5ld2xpbmVzQmV0d2VlbkltcG9ydHMgPT09ICdhbHdheXMtYW5kLWluc2lkZS1ncm91cHMnKSB7XG4gICAgICBpZiAoY3VycmVudEltcG9ydC5yYW5rICE9PSBwcmV2aW91c0ltcG9ydC5yYW5rICYmIGVtcHR5TGluZXNCZXR3ZWVuID09PSAwKSB7XG4gICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICBub2RlOiBwcmV2aW91c0ltcG9ydC5ub2RlLFxuICAgICAgICAgIG1lc3NhZ2U6ICdUaGVyZSBzaG91bGQgYmUgYXQgbGVhc3Qgb25lIGVtcHR5IGxpbmUgYmV0d2VlbiBpbXBvcnQgZ3JvdXBzJyxcbiAgICAgICAgICBmaXg6IGZpeE5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBwcmV2aW91c0ltcG9ydCwgY3VycmVudEltcG9ydCksXG4gICAgICAgIH0pXG4gICAgICB9IGVsc2UgaWYgKGN1cnJlbnRJbXBvcnQucmFuayA9PT0gcHJldmlvdXNJbXBvcnQucmFua1xuICAgICAgICAmJiBlbXB0eUxpbmVzQmV0d2VlbiA+IDBcbiAgICAgICAgJiYgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cyAhPT0gJ2Fsd2F5cy1hbmQtaW5zaWRlLWdyb3VwcycpIHtcbiAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgIG5vZGU6IHByZXZpb3VzSW1wb3J0Lm5vZGUsXG4gICAgICAgICAgbWVzc2FnZTogJ1RoZXJlIHNob3VsZCBiZSBubyBlbXB0eSBsaW5lIHdpdGhpbiBpbXBvcnQgZ3JvdXAnLFxuICAgICAgICAgIGZpeDogcmVtb3ZlTmV3TGluZUFmdGVySW1wb3J0KGNvbnRleHQsIGN1cnJlbnRJbXBvcnQsIHByZXZpb3VzSW1wb3J0KSxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVtcHR5TGluZXNCZXR3ZWVuID4gMCkge1xuICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICBub2RlOiBwcmV2aW91c0ltcG9ydC5ub2RlLFxuICAgICAgICBtZXNzYWdlOiAnVGhlcmUgc2hvdWxkIGJlIG5vIGVtcHR5IGxpbmUgYmV0d2VlbiBpbXBvcnQgZ3JvdXBzJyxcbiAgICAgICAgZml4OiByZW1vdmVOZXdMaW5lQWZ0ZXJJbXBvcnQoY29udGV4dCwgY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpLFxuICAgICAgfSlcbiAgICB9XG5cbiAgICBwcmV2aW91c0ltcG9ydCA9IGN1cnJlbnRJbXBvcnRcbiAgfSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ29yZGVyJyksXG4gICAgfSxcblxuICAgIGZpeGFibGU6ICdjb2RlJyxcbiAgICBzY2hlbWE6IFtcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICBncm91cHM6IHtcbiAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnbmV3bGluZXMtYmV0d2Vlbic6IHtcbiAgICAgICAgICAgIGVudW06IFtcbiAgICAgICAgICAgICAgJ2lnbm9yZScsXG4gICAgICAgICAgICAgICdhbHdheXMnLFxuICAgICAgICAgICAgICAnYWx3YXlzLWFuZC1pbnNpZGUtZ3JvdXBzJyxcbiAgICAgICAgICAgICAgJ25ldmVyJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxuXG4gIGNyZWF0ZTogZnVuY3Rpb24gaW1wb3J0T3JkZXJSdWxlIChjb250ZXh0KSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGNvbnRleHQub3B0aW9uc1swXSB8fCB7fVxuICAgIGNvbnN0IG5ld2xpbmVzQmV0d2VlbkltcG9ydHMgPSBvcHRpb25zWyduZXdsaW5lcy1iZXR3ZWVuJ10gfHwgJ2lnbm9yZSdcbiAgICBsZXQgcmFua3NcblxuICAgIHRyeSB7XG4gICAgICByYW5rcyA9IGNvbnZlcnRHcm91cHNUb1JhbmtzKG9wdGlvbnMuZ3JvdXBzIHx8IGRlZmF1bHRHcm91cHMpXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIE1hbGZvcm1lZCBjb25maWd1cmF0aW9uXG4gICAgICByZXR1cm4ge1xuICAgICAgICBQcm9ncmFtOiBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQobm9kZSwgZXJyb3IubWVzc2FnZSlcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IGltcG9ydGVkID0gW11cbiAgICBsZXQgbGV2ZWwgPSAwXG5cbiAgICBmdW5jdGlvbiBpbmNyZW1lbnRMZXZlbCgpIHtcbiAgICAgIGxldmVsKytcbiAgICB9XG4gICAgZnVuY3Rpb24gZGVjcmVtZW50TGV2ZWwoKSB7XG4gICAgICBsZXZlbC0tXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIEltcG9ydERlY2xhcmF0aW9uOiBmdW5jdGlvbiBoYW5kbGVJbXBvcnRzKG5vZGUpIHtcbiAgICAgICAgaWYgKG5vZGUuc3BlY2lmaWVycy5sZW5ndGgpIHsgLy8gSWdub3JpbmcgdW5hc3NpZ25lZCBpbXBvcnRzXG4gICAgICAgICAgY29uc3QgbmFtZSA9IG5vZGUuc291cmNlLnZhbHVlXG4gICAgICAgICAgcmVnaXN0ZXJOb2RlKGNvbnRleHQsIG5vZGUsIG5hbWUsICdpbXBvcnQnLCByYW5rcywgaW1wb3J0ZWQpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBDYWxsRXhwcmVzc2lvbjogZnVuY3Rpb24gaGFuZGxlUmVxdWlyZXMobm9kZSkge1xuICAgICAgICBpZiAobGV2ZWwgIT09IDAgfHwgIWlzU3RhdGljUmVxdWlyZShub2RlKSB8fCAhaXNJblZhcmlhYmxlRGVjbGFyYXRvcihub2RlLnBhcmVudCkpIHtcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBuYW1lID0gbm9kZS5hcmd1bWVudHNbMF0udmFsdWVcbiAgICAgICAgcmVnaXN0ZXJOb2RlKGNvbnRleHQsIG5vZGUsIG5hbWUsICdyZXF1aXJlJywgcmFua3MsIGltcG9ydGVkKVxuICAgICAgfSxcbiAgICAgICdQcm9ncmFtOmV4aXQnOiBmdW5jdGlvbiByZXBvcnRBbmRSZXNldCgpIHtcbiAgICAgICAgbWFrZU91dE9mT3JkZXJSZXBvcnQoY29udGV4dCwgaW1wb3J0ZWQpXG5cbiAgICAgICAgaWYgKG5ld2xpbmVzQmV0d2VlbkltcG9ydHMgIT09ICdpZ25vcmUnKSB7XG4gICAgICAgICAgbWFrZU5ld2xpbmVzQmV0d2VlblJlcG9ydChjb250ZXh0LCBpbXBvcnRlZCwgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cylcbiAgICAgICAgfVxuXG4gICAgICAgIGltcG9ydGVkID0gW11cbiAgICAgIH0sXG4gICAgICBGdW5jdGlvbkRlY2xhcmF0aW9uOiBpbmNyZW1lbnRMZXZlbCxcbiAgICAgIEZ1bmN0aW9uRXhwcmVzc2lvbjogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbjogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBCbG9ja1N0YXRlbWVudDogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBPYmplY3RFeHByZXNzaW9uOiBpbmNyZW1lbnRMZXZlbCxcbiAgICAgICdGdW5jdGlvbkRlY2xhcmF0aW9uOmV4aXQnOiBkZWNyZW1lbnRMZXZlbCxcbiAgICAgICdGdW5jdGlvbkV4cHJlc3Npb246ZXhpdCc6IGRlY3JlbWVudExldmVsLFxuICAgICAgJ0Fycm93RnVuY3Rpb25FeHByZXNzaW9uOmV4aXQnOiBkZWNyZW1lbnRMZXZlbCxcbiAgICAgICdCbG9ja1N0YXRlbWVudDpleGl0JzogZGVjcmVtZW50TGV2ZWwsXG4gICAgICAnT2JqZWN0RXhwcmVzc2lvbjpleGl0JzogZGVjcmVtZW50TGV2ZWwsXG4gICAgfVxuICB9LFxufVxuIl19