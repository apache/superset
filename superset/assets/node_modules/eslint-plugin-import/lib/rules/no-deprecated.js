'use strict';

var _declaredScope = require('eslint-module-utils/declaredScope');

var _declaredScope2 = _interopRequireDefault(_declaredScope);

var _ExportMap = require('../ExportMap');

var _ExportMap2 = _interopRequireDefault(_ExportMap);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function message(deprecation) {
  return 'Deprecated' + (deprecation.description ? ': ' + deprecation.description : '.');
}

function getDeprecation(metadata) {
  if (!metadata || !metadata.doc) return;

  let deprecation;
  if (metadata.doc.tags.some(t => t.title === 'deprecated' && (deprecation = t))) {
    return deprecation;
  }
}

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-deprecated')
    }
  },

  create: function (context) {
    const deprecated = new Map(),
          namespaces = new Map();

    function checkSpecifiers(node) {
      if (node.type !== 'ImportDeclaration') return;
      if (node.source == null) return; // local export, ignore

      const imports = _ExportMap2.default.get(node.source.value, context);
      if (imports == null) return;

      let moduleDeprecation;
      if (imports.doc && imports.doc.tags.some(t => t.title === 'deprecated' && (moduleDeprecation = t))) {
        context.report({ node, message: message(moduleDeprecation) });
      }

      if (imports.errors.length) {
        imports.reportErrors(context, node);
        return;
      }

      node.specifiers.forEach(function (im) {
        let imported, local;
        switch (im.type) {

          case 'ImportNamespaceSpecifier':
            {
              if (!imports.size) return;
              namespaces.set(im.local.name, imports);
              return;
            }

          case 'ImportDefaultSpecifier':
            imported = 'default';
            local = im.local.name;
            break;

          case 'ImportSpecifier':
            imported = im.imported.name;
            local = im.local.name;
            break;

          default:
            return; // can't handle this one
        }

        // unknown thing can't be deprecated
        const exported = imports.get(imported);
        if (exported == null) return;

        // capture import of deep namespace
        if (exported.namespace) namespaces.set(local, exported.namespace);

        const deprecation = getDeprecation(imports.get(imported));
        if (!deprecation) return;

        context.report({ node: im, message: message(deprecation) });

        deprecated.set(local, deprecation);
      });
    }

    return {
      'Program': (_ref) => {
        let body = _ref.body;
        return body.forEach(checkSpecifiers);
      },

      'Identifier': function (node) {
        if (node.parent.type === 'MemberExpression' && node.parent.property === node) {
          return; // handled by MemberExpression
        }

        // ignore specifier identifiers
        if (node.parent.type.slice(0, 6) === 'Import') return;

        if (!deprecated.has(node.name)) return;

        if ((0, _declaredScope2.default)(context, node.name) !== 'module') return;
        context.report({
          node,
          message: message(deprecated.get(node.name))
        });
      },

      'MemberExpression': function (dereference) {
        if (dereference.object.type !== 'Identifier') return;
        if (!namespaces.has(dereference.object.name)) return;

        if ((0, _declaredScope2.default)(context, dereference.object.name) !== 'module') return;

        // go deep
        var namespace = namespaces.get(dereference.object.name);
        var namepath = [dereference.object.name];
        // while property is namespace and parent is member expression, keep validating
        while (namespace instanceof _ExportMap2.default && dereference.type === 'MemberExpression') {

          // ignore computed parts for now
          if (dereference.computed) return;

          const metadata = namespace.get(dereference.property.name);

          if (!metadata) break;
          const deprecation = getDeprecation(metadata);

          if (deprecation) {
            context.report({ node: dereference.property, message: message(deprecation) });
          }

          // stash and pop
          namepath.push(dereference.property.name);
          namespace = metadata.namespace;
          dereference = dereference.parent;
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLWRlcHJlY2F0ZWQuanMiXSwibmFtZXMiOlsibWVzc2FnZSIsImRlcHJlY2F0aW9uIiwiZGVzY3JpcHRpb24iLCJnZXREZXByZWNhdGlvbiIsIm1ldGFkYXRhIiwiZG9jIiwidGFncyIsInNvbWUiLCJ0IiwidGl0bGUiLCJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJjb250ZXh0IiwiZGVwcmVjYXRlZCIsIk1hcCIsIm5hbWVzcGFjZXMiLCJjaGVja1NwZWNpZmllcnMiLCJub2RlIiwidHlwZSIsInNvdXJjZSIsImltcG9ydHMiLCJFeHBvcnRzIiwiZ2V0IiwidmFsdWUiLCJtb2R1bGVEZXByZWNhdGlvbiIsInJlcG9ydCIsImVycm9ycyIsImxlbmd0aCIsInJlcG9ydEVycm9ycyIsInNwZWNpZmllcnMiLCJmb3JFYWNoIiwiaW0iLCJpbXBvcnRlZCIsImxvY2FsIiwic2l6ZSIsInNldCIsIm5hbWUiLCJleHBvcnRlZCIsIm5hbWVzcGFjZSIsImJvZHkiLCJwYXJlbnQiLCJwcm9wZXJ0eSIsInNsaWNlIiwiaGFzIiwiZGVyZWZlcmVuY2UiLCJvYmplY3QiLCJuYW1lcGF0aCIsImNvbXB1dGVkIiwicHVzaCJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztBQUVBLFNBQVNBLE9BQVQsQ0FBaUJDLFdBQWpCLEVBQThCO0FBQzVCLFNBQU8sZ0JBQWdCQSxZQUFZQyxXQUFaLEdBQTBCLE9BQU9ELFlBQVlDLFdBQTdDLEdBQTJELEdBQTNFLENBQVA7QUFDRDs7QUFFRCxTQUFTQyxjQUFULENBQXdCQyxRQUF4QixFQUFrQztBQUNoQyxNQUFJLENBQUNBLFFBQUQsSUFBYSxDQUFDQSxTQUFTQyxHQUEzQixFQUFnQzs7QUFFaEMsTUFBSUosV0FBSjtBQUNBLE1BQUlHLFNBQVNDLEdBQVQsQ0FBYUMsSUFBYixDQUFrQkMsSUFBbEIsQ0FBdUJDLEtBQUtBLEVBQUVDLEtBQUYsS0FBWSxZ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QUFXc0MsVUFBVWhCLEdBQVYsQ0FBY3NCLFlBQVlILFFBQVosQ0FBcUJMLElBQW5DLENBQWpCOztBQUVBLGNBQUksQ0FBQ3BDLFFBQUwsRUFBZTtBQUNmLGdCQUFNSCxjQUFjRSxlQUFlQyxRQUFmLENBQXBCOztBQUVBLGNBQUlILFdBQUosRUFBaUI7QUFDZmUsb0JBQVFhLE1BQVIsQ0FBZSxFQUFFUixNQUFNMkIsWUFBWUgsUUFBcEIsRUFBOEI3QyxTQUFTQSxRQUFRQyxXQUFSLENBQXZDLEVBQWY7QUFDRDs7QUFFRDtBQUNBaUQsbUJBQVNFLElBQVQsQ0FBY0osWUFBWUgsUUFBWixDQUFxQkwsSUFBbkM7QUFDQUUsc0JBQVl0QyxTQUFTc0MsU0FBckI7QUFDQU0sd0JBQWNBLFlBQVlKLE1BQTFCO0FBQ0Q7QUFDRjtBQWxESSxLQUFQO0FBb0REO0FBMUhjLENBQWpCIiwiZmlsZSI6InJ1bGVzL25vLWRlcHJlY2F0ZWQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZGVjbGFyZWRTY29wZSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL2RlY2xhcmVkU2NvcGUnXG5pbXBvcnQgRXhwb3J0cyBmcm9tICcuLi9FeHBvcnRNYXAnXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5mdW5jdGlvbiBtZXNzYWdlKGRlcHJlY2F0aW9uKSB7XG4gIHJldHVybiAnRGVwcmVjYXRlZCcgKyAoZGVwcmVjYXRpb24uZGVzY3JpcHRpb24gPyAnOiAnICsgZGVwcmVjYXRpb24uZGVzY3JpcHRpb24gOiAnLicpXG59XG5cbmZ1bmN0aW9uIGdldERlcHJlY2F0aW9uKG1ldGFkYXRhKSB7XG4gIGlmICghbWV0YWRhdGEgfHwgIW1ldGFkYXRhLmRvYykgcmV0dXJuXG5cbiAgbGV0IGRlcHJlY2F0aW9uXG4gIGlmIChtZXRhZGF0YS5kb2MudGFncy5zb21lKHQgPT4gdC50aXRsZSA9PT0gJ2RlcHJlY2F0ZWQnICYmIChkZXByZWNhdGlvbiA9IHQpKSkge1xuICAgIHJldHVybiBkZXByZWNhdGlvblxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduby1kZXByZWNhdGVkJyksXG4gICAgfSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgY29uc3QgZGVwcmVjYXRlZCA9IG5ldyBNYXAoKVxuICAgICAgICAsIG5hbWVzcGFjZXMgPSBuZXcgTWFwKClcblxuICAgIGZ1bmN0aW9uIGNoZWNrU3BlY2lmaWVycyhub2RlKSB7XG4gICAgICBpZiAobm9kZS50eXBlICE9PSAnSW1wb3J0RGVjbGFyYXRpb24nKSByZXR1cm5cbiAgICAgIGlmIChub2RlLnNvdXJjZSA9PSBudWxsKSByZXR1cm4gLy8gbG9jYWwgZXhwb3J0LCBpZ25vcmVcblxuICAgICAgY29uc3QgaW1wb3J0cyA9IEV4cG9ydHMuZ2V0KG5vZGUuc291cmNlLnZhbHVlLCBjb250ZXh0KVxuICAgICAgaWYgKGltcG9ydHMgPT0gbnVsbCkgcmV0dXJuXG5cbiAgICAgIGxldCBtb2R1bGVEZXByZWNhdGlvblxuICAgICAgaWYgKGltcG9ydHMuZG9jICYmXG4gICAgICAgICAgaW1wb3J0cy5kb2MudGFncy5zb21lKHQgPT4gdC50aXRsZSA9PT0gJ2RlcHJlY2F0ZWQnICYmIChtb2R1bGVEZXByZWNhdGlvbiA9IHQpKSkge1xuICAgICAgICBjb250ZXh0LnJlcG9ydCh7IG5vZGUsIG1lc3NhZ2U6IG1lc3NhZ2UobW9kdWxlRGVwcmVjYXRpb24pIH0pXG4gICAgICB9XG5cbiAgICAgIGlmIChpbXBvcnRzLmVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgaW1wb3J0cy5yZXBvcnRFcnJvcnMoY29udGV4dCwgbm9kZSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIG5vZGUuc3BlY2lmaWVycy5mb3JFYWNoKGZ1bmN0aW9uIChpbSkge1xuICAgICAgICBsZXQgaW1wb3J0ZWQsIGxvY2FsXG4gICAgICAgIHN3aXRjaCAoaW0udHlwZSkge1xuXG5cbiAgICAgICAgICBjYXNlICdJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXInOntcbiAgICAgICAgICAgIGlmICghaW1wb3J0cy5zaXplKSByZXR1cm5cbiAgICAgICAgICAgIG5hbWVzcGFjZXMuc2V0KGltLmxvY2FsLm5hbWUsIGltcG9ydHMpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlICdJbXBvcnREZWZhdWx0U3BlY2lmaWVyJzpcbiAgICAgICAgICAgIGltcG9ydGVkID0gJ2RlZmF1bHQnXG4gICAgICAgICAgICBsb2NhbCA9IGltLmxvY2FsLm5hbWVcbiAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICBjYXNlICdJbXBvcnRTcGVjaWZpZXInOlxuICAgICAgICAgICAgaW1wb3J0ZWQgPSBpbS5pbXBvcnRlZC5uYW1lXG4gICAgICAgICAgICBsb2NhbCA9IGltLmxvY2FsLm5hbWVcbiAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICBkZWZhdWx0OiByZXR1cm4gLy8gY2FuJ3QgaGFuZGxlIHRoaXMgb25lXG4gICAgICAgIH1cblxuICAgICAgICAvLyB1bmtub3duIHRoaW5nIGNhbid0IGJlIGRlcHJlY2F0ZWRcbiAgICAgICAgY29uc3QgZXhwb3J0ZWQgPSBpbXBvcnRzLmdldChpbXBvcnRlZClcbiAgICAgICAgaWYgKGV4cG9ydGVkID09IG51bGwpIHJldHVyblxuXG4gICAgICAgIC8vIGNhcHR1cmUgaW1wb3J0IG9mIGRlZXAgbmFtZXNwYWNlXG4gICAgICAgIGlmIChleHBvcnRlZC5uYW1lc3BhY2UpIG5hbWVzcGFjZXMuc2V0KGxvY2FsLCBleHBvcnRlZC5uYW1lc3BhY2UpXG5cbiAgICAgICAgY29uc3QgZGVwcmVjYXRpb24gPSBnZXREZXByZWNhdGlvbihpbXBvcnRzLmdldChpbXBvcnRlZCkpXG4gICAgICAgIGlmICghZGVwcmVjYXRpb24pIHJldHVyblxuXG4gICAgICAgIGNvbnRleHQucmVwb3J0KHsgbm9kZTogaW0sIG1lc3NhZ2U6IG1lc3NhZ2UoZGVwcmVjYXRpb24pIH0pXG5cbiAgICAgICAgZGVwcmVjYXRlZC5zZXQobG9jYWwsIGRlcHJlY2F0aW9uKVxuXG4gICAgICB9KVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAnUHJvZ3JhbSc6ICh7IGJvZHkgfSkgPT4gYm9keS5mb3JFYWNoKGNoZWNrU3BlY2lmaWVycyksXG5cbiAgICAgICdJZGVudGlmaWVyJzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgaWYgKG5vZGUucGFyZW50LnR5cGUgPT09ICdNZW1iZXJFeHByZXNzaW9uJyAmJiBub2RlLnBhcmVudC5wcm9wZXJ0eSA9PT0gbm9kZSkge1xuICAgICAgICAgIHJldHVybiAvLyBoYW5kbGVkIGJ5IE1lbWJlckV4cHJlc3Npb25cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlnbm9yZSBzcGVjaWZpZXIgaWRlbnRpZmllcnNcbiAgICAgICAgaWYgKG5vZGUucGFyZW50LnR5cGUuc2xpY2UoMCwgNikgPT09ICdJbXBvcnQnKSByZXR1cm5cblxuICAgICAgICBpZiAoIWRlcHJlY2F0ZWQuaGFzKG5vZGUubmFtZSkpIHJldHVyblxuXG4gICAgICAgIGlmIChkZWNsYXJlZFNjb3BlKGNvbnRleHQsIG5vZGUubmFtZSkgIT09ICdtb2R1bGUnKSByZXR1cm5cbiAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgbWVzc2FnZTogbWVzc2FnZShkZXByZWNhdGVkLmdldChub2RlLm5hbWUpKSxcbiAgICAgICAgfSlcbiAgICAgIH0sXG5cbiAgICAgICdNZW1iZXJFeHByZXNzaW9uJzogZnVuY3Rpb24gKGRlcmVmZXJlbmNlKSB7XG4gICAgICAgIGlmIChkZXJlZmVyZW5jZS5vYmplY3QudHlwZSAhPT0gJ0lkZW50aWZpZXInKSByZXR1cm5cbiAgICAgICAgaWYgKCFuYW1lc3BhY2VzLmhhcyhkZXJlZmVyZW5jZS5vYmplY3QubmFtZSkpIHJldHVyblxuXG4gICAgICAgIGlmIChkZWNsYXJlZFNjb3BlKGNvbnRleHQsIGRlcmVmZXJlbmNlLm9iamVjdC5uYW1lKSAhPT0gJ21vZHVsZScpIHJldHVyblxuXG4gICAgICAgIC8vIGdvIGRlZXBcbiAgICAgICAgdmFyIG5hbWVzcGFjZSA9IG5hbWVzcGFjZXMuZ2V0KGRlcmVmZXJlbmNlLm9iamVjdC5uYW1lKVxuICAgICAgICB2YXIgbmFtZXBhdGggPSBbZGVyZWZlcmVuY2Uub2JqZWN0Lm5hbWVdXG4gICAgICAgIC8vIHdoaWxlIHByb3BlcnR5IGlzIG5hbWVzcGFjZSBhbmQgcGFyZW50IGlzIG1lbWJlciBleHByZXNzaW9uLCBrZWVwIHZhbGlkYXRpbmdcbiAgICAgICAgd2hpbGUgKG5hbWVzcGFjZSBpbnN0YW5jZW9mIEV4cG9ydHMgJiZcbiAgICAgICAgICAgICAgIGRlcmVmZXJlbmNlLnR5cGUgPT09ICdNZW1iZXJFeHByZXNzaW9uJykge1xuXG4gICAgICAgICAgLy8gaWdub3JlIGNvbXB1dGVkIHBhcnRzIGZvciBub3dcbiAgICAgICAgICBpZiAoZGVyZWZlcmVuY2UuY29tcHV0ZWQpIHJldHVyblxuXG4gICAgICAgICAgY29uc3QgbWV0YWRhdGEgPSBuYW1lc3BhY2UuZ2V0KGRlcmVmZXJlbmNlLnByb3BlcnR5Lm5hbWUpXG5cbiAgICAgICAgICBpZiAoIW1ldGFkYXRhKSBicmVha1xuICAgICAgICAgIGNvbnN0IGRlcHJlY2F0aW9uID0gZ2V0RGVwcmVjYXRpb24obWV0YWRhdGEpXG5cbiAgICAgICAgICBpZiAoZGVwcmVjYXRpb24pIHtcbiAgICAgICAgICAgIGNvbnRleHQucmVwb3J0KHsgbm9kZTogZGVyZWZlcmVuY2UucHJvcGVydHksIG1lc3NhZ2U6IG1lc3NhZ2UoZGVwcmVjYXRpb24pIH0pXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gc3Rhc2ggYW5kIHBvcFxuICAgICAgICAgIG5hbWVwYXRoLnB1c2goZGVyZWZlcmVuY2UucHJvcGVydHkubmFtZSlcbiAgICAgICAgICBuYW1lc3BhY2UgPSBtZXRhZGF0YS5uYW1lc3BhY2VcbiAgICAgICAgICBkZXJlZmVyZW5jZSA9IGRlcmVmZXJlbmNlLnBhcmVudFxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==