'use strict';

var _ExportMap = require('../ExportMap');

var _ExportMap2 = _interopRequireDefault(_ExportMap);

var _importDeclaration = require('../importDeclaration');

var _importDeclaration2 = _interopRequireDefault(_importDeclaration);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-named-as-default-member')
    }
  },

  create: function (context) {

    const fileImports = new Map();
    const allPropertyLookups = new Map();

    function handleImportDefault(node) {
      const declaration = (0, _importDeclaration2.default)(context);
      const exportMap = _ExportMap2.default.get(declaration.source.value, context);
      if (exportMap == null) return;

      if (exportMap.errors.length) {
        exportMap.reportErrors(context, declaration);
        return;
      }

      fileImports.set(node.local.name, {
        exportMap,
        sourcePath: declaration.source.value
      });
    }

    function storePropertyLookup(objectName, propName, node) {
      const lookups = allPropertyLookups.get(objectName) || [];
      lookups.push({ node, propName });
      allPropertyLookups.set(objectName, lookups);
    }

    function handlePropLookup(node) {
      const objectName = node.object.name;
      const propName = node.property.name;
      storePropertyLookup(objectName, propName, node);
    }

    function handleDestructuringAssignment(node) {
      const isDestructure = node.id.type === 'ObjectPattern' && node.init != null && node.init.type === 'Identifier';
      if (!isDestructure) return;

      const objectName = node.init.name;
      for (const _ref of node.id.properties) {
        const key = _ref.key;

        if (key == null) continue; // true for rest properties
        storePropertyLookup(objectName, key.name, key);
      }
    }

    function handleProgramExit() {
      allPropertyLookups.forEach((lookups, objectName) => {
        const fileImport = fileImports.get(objectName);
        if (fileImport == null) return;

        for (const _ref2 of lookups) {
          const propName = _ref2.propName;
          const node = _ref2.node;

          // the default import can have a "default" property
          if (propName === 'default') continue;
          if (!fileImport.exportMap.namespace.has(propName)) continue;

          context.report({
            node,
            message: `Caution: \`${objectName}\` also has a named export ` + `\`${propName}\`. Check if you meant to write ` + `\`import {${propName}} from '${fileImport.sourcePath}'\` ` + 'instead.'
          });
        }
      });
    }

    return {
      'ImportDefaultSpecifier': handleImportDefault,
      'MemberExpression': handlePropLookup,
      'VariableDeclarator': handleDestructuringAssignment,
      'Program:exit': handleProgramExit
    };
  }
}; /**
    * @fileoverview Rule to warn about potentially confused use of name exports
    * @author Desmond Brand
    * @copyright 2016 Desmond Brand. All rights reserved.
    * See LICENSE in root directory for full license.
    */
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLW5hbWVkLWFzLWRlZmF1bHQtbWVtYmVyLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsInVybCIsImNyZWF0ZSIsImNvbnRleHQiLCJmaWxlSW1wb3J0cyIsIk1hcCIsImFsbFByb3BlcnR5TG9va3VwcyIsImhhbmRsZUltcG9ydERlZmF1bHQiLCJub2RlIiwiZGVjbGFyYXRpb24iLCJleHBvcnRNYXAiLCJFeHBvcnRzIiwiZ2V0Iiwic291cmNlIiwidmFsdWUiLCJlcnJvcnMiLCJsZW5ndGgiLCJyZXBvcnRFcnJvcnMiLCJzZXQiLCJsb2NhbCIsIm5hbWUiLCJzb3VyY2VQYXRoIiwic3RvcmVQcm9wZXJ0eUxvb2t1cCIsIm9iamVjdE5hbWUiLCJwcm9wTmFtZSIsImxvb2t1cHMiLCJwdXNoIiwiaGFuZGxlUHJvcExvb2t1cCIsIm9iamVjdCIsInByb3BlcnR5IiwiaGFuZGxlRGVzdHJ1Y3R1cmluZ0Fzc2lnbm1lbnQiLCJpc0Rlc3RydWN0dXJlIiwiaWQiLCJ0eXBlIiwiaW5pdCIsInByb3BlcnRpZXMiLCJrZXkiLCJoYW5kbGVQcm9ncmFtRXhpdCIsImZvckVhY2giLCJmaWxlSW1wb3J0IiwibmFtZXNwYWNlIiwiaGFzIiwicmVwb3J0IiwibWVzc2FnZSJdLCJtYXBwaW5ncyI6Ijs7QUFNQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztBQUVBO0FBQ0E7QUFDQTs7QUFFQUEsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU07QUFDSkMsV0FBSyx1QkFBUSw0QkFBUjtBQUREO0FBREYsR0FEUzs7QUFPZkMsVUFBUSxVQUFTQyxPQUFULEVBQWtCOztBQUV4QixVQUFNQyxjQUFjLElBQUlDLEdBQUosRUFBcEI7QUFDQSxVQUFNQyxxQkFBcUIsSUFBSUQsR0FBSixFQUEzQjs7QUFFQSxhQUFTRSxtQkFBVCxDQUE2QkMsSUFBN0IsRUFBbUM7QUFDakMsWUFBTUMsY0FBYyxpQ0FBa0JOLE9BQWxC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IiwiZmlsZSI6InJ1bGVzL25vLW5hbWVkLWFzLWRlZmF1bHQtbWVtYmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IFJ1bGUgdG8gd2FybiBhYm91dCBwb3RlbnRpYWxseSBjb25mdXNlZCB1c2Ugb2YgbmFtZSBleHBvcnRzXG4gKiBAYXV0aG9yIERlc21vbmQgQnJhbmRcbiAqIEBjb3B5cmlnaHQgMjAxNiBEZXNtb25kIEJyYW5kLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogU2VlIExJQ0VOU0UgaW4gcm9vdCBkaXJlY3RvcnkgZm9yIGZ1bGwgbGljZW5zZS5cbiAqL1xuaW1wb3J0IEV4cG9ydHMgZnJvbSAnLi4vRXhwb3J0TWFwJ1xuaW1wb3J0IGltcG9ydERlY2xhcmF0aW9uIGZyb20gJy4uL2ltcG9ydERlY2xhcmF0aW9uJ1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFJ1bGUgRGVmaW5pdGlvblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ25vLW5hbWVkLWFzLWRlZmF1bHQtbWVtYmVyJyksXG4gICAgfSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uKGNvbnRleHQpIHtcblxuICAgIGNvbnN0IGZpbGVJbXBvcnRzID0gbmV3IE1hcCgpXG4gICAgY29uc3QgYWxsUHJvcGVydHlMb29rdXBzID0gbmV3IE1hcCgpXG5cbiAgICBmdW5jdGlvbiBoYW5kbGVJbXBvcnREZWZhdWx0KG5vZGUpIHtcbiAgICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gaW1wb3J0RGVjbGFyYXRpb24oY29udGV4dClcbiAgICAgIGNvbnN0IGV4cG9ydE1hcCA9IEV4cG9ydHMuZ2V0KGRlY2xhcmF0aW9uLnNvdXJjZS52YWx1ZSwgY29udGV4dClcbiAgICAgIGlmIChleHBvcnRNYXAgPT0gbnVsbCkgcmV0dXJuXG5cbiAgICAgIGlmIChleHBvcnRNYXAuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICBleHBvcnRNYXAucmVwb3J0RXJyb3JzKGNvbnRleHQsIGRlY2xhcmF0aW9uKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgZmlsZUltcG9ydHMuc2V0KG5vZGUubG9jYWwubmFtZSwge1xuICAgICAgICBleHBvcnRNYXAsXG4gICAgICAgIHNvdXJjZVBhdGg6IGRlY2xhcmF0aW9uLnNvdXJjZS52YWx1ZSxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3RvcmVQcm9wZXJ0eUxvb2t1cChvYmplY3ROYW1lLCBwcm9wTmFtZSwgbm9kZSkge1xuICAgICAgY29uc3QgbG9va3VwcyA9IGFsbFByb3BlcnR5TG9va3Vwcy5nZXQob2JqZWN0TmFtZSkgfHwgW11cbiAgICAgIGxvb2t1cHMucHVzaCh7bm9kZSwgcHJvcE5hbWV9KVxuICAgICAgYWxsUHJvcGVydHlMb29rdXBzLnNldChvYmplY3ROYW1lLCBsb29rdXBzKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZVByb3BMb29rdXAobm9kZSkge1xuICAgICAgY29uc3Qgb2JqZWN0TmFtZSA9IG5vZGUub2JqZWN0Lm5hbWVcbiAgICAgIGNvbnN0IHByb3BOYW1lID0gbm9kZS5wcm9wZXJ0eS5uYW1lXG4gICAgICBzdG9yZVByb3BlcnR5TG9va3VwKG9iamVjdE5hbWUsIHByb3BOYW1lLCBub2RlKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZURlc3RydWN0dXJpbmdBc3NpZ25tZW50KG5vZGUpIHtcbiAgICAgIGNvbnN0IGlzRGVzdHJ1Y3R1cmUgPSAoXG4gICAgICAgIG5vZGUuaWQudHlwZSA9PT0gJ09iamVjdFBhdHRlcm4nICYmXG4gICAgICAgIG5vZGUuaW5pdCAhPSBudWxsICYmXG4gICAgICAgIG5vZGUuaW5pdC50eXBlID09PSAnSWRlbnRpZmllcidcbiAgICAgIClcbiAgICAgIGlmICghaXNEZXN0cnVjdHVyZSkgcmV0dXJuXG5cbiAgICAgIGNvbnN0IG9iamVjdE5hbWUgPSBub2RlLmluaXQubmFtZVxuICAgICAgZm9yIChjb25zdCB7IGtleSB9IG9mIG5vZGUuaWQucHJvcGVydGllcykge1xuICAgICAgICBpZiAoa2V5ID09IG51bGwpIGNvbnRpbnVlICAvLyB0cnVlIGZvciByZXN0IHByb3BlcnRpZXNcbiAgICAgICAgc3RvcmVQcm9wZXJ0eUxvb2t1cChvYmplY3ROYW1lLCBrZXkubmFtZSwga2V5KVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZVByb2dyYW1FeGl0KCkge1xuICAgICAgYWxsUHJvcGVydHlMb29rdXBzLmZvckVhY2goKGxvb2t1cHMsIG9iamVjdE5hbWUpID0+IHtcbiAgICAgICAgY29uc3QgZmlsZUltcG9ydCA9IGZpbGVJbXBvcnRzLmdldChvYmplY3ROYW1lKVxuICAgICAgICBpZiAoZmlsZUltcG9ydCA9PSBudWxsKSByZXR1cm5cblxuICAgICAgICBmb3IgKGNvbnN0IHtwcm9wTmFtZSwgbm9kZX0gb2YgbG9va3Vwcykge1xuICAgICAgICAgIC8vIHRoZSBkZWZhdWx0IGltcG9ydCBjYW4gaGF2ZSBhIFwiZGVmYXVsdFwiIHByb3BlcnR5XG4gICAgICAgICAgaWYgKHByb3BOYW1lID09PSAnZGVmYXVsdCcpIGNvbnRpbnVlXG4gICAgICAgICAgaWYgKCFmaWxlSW1wb3J0LmV4cG9ydE1hcC5uYW1lc3BhY2UuaGFzKHByb3BOYW1lKSkgY29udGludWVcblxuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBtZXNzYWdlOiAoXG4gICAgICAgICAgICAgIGBDYXV0aW9uOiBcXGAke29iamVjdE5hbWV9XFxgIGFsc28gaGFzIGEgbmFtZWQgZXhwb3J0IGAgK1xuICAgICAgICAgICAgICBgXFxgJHtwcm9wTmFtZX1cXGAuIENoZWNrIGlmIHlvdSBtZWFudCB0byB3cml0ZSBgICtcbiAgICAgICAgICAgICAgYFxcYGltcG9ydCB7JHtwcm9wTmFtZX19IGZyb20gJyR7ZmlsZUltcG9ydC5zb3VyY2VQYXRofSdcXGAgYCArXG4gICAgICAgICAgICAgICdpbnN0ZWFkLidcbiAgICAgICAgICAgICksXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgJ0ltcG9ydERlZmF1bHRTcGVjaWZpZXInOiBoYW5kbGVJbXBvcnREZWZhdWx0LFxuICAgICAgJ01lbWJlckV4cHJlc3Npb24nOiBoYW5kbGVQcm9wTG9va3VwLFxuICAgICAgJ1ZhcmlhYmxlRGVjbGFyYXRvcic6IGhhbmRsZURlc3RydWN0dXJpbmdBc3NpZ25tZW50LFxuICAgICAgJ1Byb2dyYW06ZXhpdCc6IGhhbmRsZVByb2dyYW1FeGl0LFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==