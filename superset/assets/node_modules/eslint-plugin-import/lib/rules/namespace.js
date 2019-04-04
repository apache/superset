'use strict';

var _declaredScope = require('eslint-module-utils/declaredScope');

var _declaredScope2 = _interopRequireDefault(_declaredScope);

var _ExportMap = require('../ExportMap');

var _ExportMap2 = _interopRequireDefault(_ExportMap);

var _importDeclaration = require('../importDeclaration');

var _importDeclaration2 = _interopRequireDefault(_importDeclaration);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('namespace')
    },

    schema: [{
      'type': 'object',
      'properties': {
        'allowComputed': {
          'description': 'If `false`, will report computed (and thus, un-lintable) references ' + 'to namespace members.',
          'type': 'boolean',
          'default': false
        }
      },
      'additionalProperties': false
    }]
  },

  create: function namespaceRule(context) {

    // read options
    var _ref = context.options[0] || {},
        _ref$allowComputed = _ref.allowComputed;

    const allowComputed = _ref$allowComputed === undefined ? false : _ref$allowComputed;


    const namespaces = new Map();

    function makeMessage(last, namepath) {
      return `'${last.name}' not found in` + (namepath.length > 1 ? ' deeply ' : ' ') + `imported namespace '${namepath.join('.')}'.`;
    }

    return {

      // pick up all imports at body entry time, to properly respect hoisting
      Program: function (_ref2) {
        let body = _ref2.body;

        function processBodyStatement(declaration) {
          if (declaration.type !== 'ImportDeclaration') return;

          if (declaration.specifiers.length === 0) return;

          const imports = _ExportMap2.default.get(declaration.source.value, context);
          if (imports == null) return null;

          if (imports.errors.length) {
            imports.reportErrors(context, declaration);
            return;
          }

          for (const specifier of declaration.specifiers) {
            switch (specifier.type) {
              case 'ImportNamespaceSpecifier':
                if (!imports.size) {
                  context.report(specifier, `No exported names found in module '${declaration.source.value}'.`);
                }
                namespaces.set(specifier.local.name, imports);
                break;
              case 'ImportDefaultSpecifier':
              case 'ImportSpecifier':
                {
                  const meta = imports.get(
                  // default to 'default' for default http://i.imgur.com/nj6qAWy.jpg
                  specifier.imported ? specifier.imported.name : 'default');
                  if (!meta || !meta.namespace) break;
                  namespaces.set(specifier.local.name, meta.namespace);
                  break;
                }
            }
          }
        }
        body.forEach(processBodyStatement);
      },

      // same as above, but does not add names to local map
      ExportNamespaceSpecifier: function (namespace) {
        var declaration = (0, _importDeclaration2.default)(context);

        var imports = _ExportMap2.default.get(declaration.source.value, context);
        if (imports == null) return null;

        if (imports.errors.length) {
          imports.reportErrors(context, declaration);
          return;
        }

        if (!imports.size) {
          context.report(namespace, `No exported names found in module '${declaration.source.value}'.`);
        }
      },

      // todo: check for possible redefinition

      MemberExpression: function (dereference) {
        if (dereference.object.type !== 'Identifier') return;
        if (!namespaces.has(dereference.object.name)) return;

        if (dereference.parent.type === 'AssignmentExpression' && dereference.parent.left === dereference) {
          context.report(dereference.parent, `Assignment to member of namespace '${dereference.object.name}'.`);
        }

        // go deep
        var namespace = namespaces.get(dereference.object.name);
        var namepath = [dereference.object.name];
        // while property is namespace and parent is member expression, keep validating
        while (namespace instanceof _ExportMap2.default && dereference.type === 'MemberExpression') {

          if (dereference.computed) {
            if (!allowComputed) {
              context.report(dereference.property, 'Unable to validate computed reference to imported namespace \'' + dereference.object.name + '\'.');
            }
            return;
          }

          if (!namespace.has(dereference.property.name)) {
            context.report(dereference.property, makeMessage(dereference.property, namepath));
            break;
          }

          const exported = namespace.get(dereference.property.name);
          if (exported == null) return;

          // stash and pop
          namepath.push(dereference.property.name);
          namespace = exported.namespace;
          dereference = dereference.parent;
        }
      },

      VariableDeclarator: function (_ref3) {
        let id = _ref3.id,
            init = _ref3.init;

        if (init == null) return;
        if (init.type !== 'Identifier') return;
        if (!namespaces.has(init.name)) return;

        // check for redefinition in intermediate scopes
        if ((0, _declaredScope2.default)(context, init.name) !== 'module') return;

        // DFS traverse child namespaces
        function testKey(pattern, namespace) {
          let path = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [init.name];

          if (!(namespace instanceof _ExportMap2.default)) return;

          if (pattern.type !== 'ObjectPattern') return;

          for (const property of pattern.properties) {
            if (property.type === 'ExperimentalRestProperty' || property.type === 'RestElement' || !property.key) {
              continue;
            }

            if (property.key.type !== 'Identifier') {
              context.report({
                node: property,
                message: 'Only destructure top-level names.'
              });
              continue;
            }

            if (!namespace.has(property.key.name)) {
              context.report({
                node: property,
                message: makeMessage(property.key, path)
              });
              continue;
            }

            path.push(property.key.name);
            testKey(property.value, namespace.get(property.key.name).namespace, path);
            path.pop();
          }
        }

        testKey(id, namespaces.get(init.name));
      },

      JSXMemberExpression: function (_ref4) {
        let object = _ref4.object,
            property = _ref4.property;

        if (!namespaces.has(object.name)) return;
        var namespace = namespaces.get(object.name);
        if (!namespace.has(property.name)) {
          context.report({
            node: property,
            message: makeMessage(property, [object.name])
          });
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25hbWVzcGFjZS5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJzY2hlbWEiLCJjcmVhdGUiLCJuYW1lc3BhY2VSdWxlIiwiY29udGV4dCIsIm9wdGlvbnMiLCJhbGxvd0NvbXB1dGVkIiwibmFtZXNwYWNlcyIsIk1hcCIsIm1ha2VNZXNzYWdlIiwibGFzdCIsIm5hbWVwYXRoIiwibmFtZSIsImxlbmd0aCIsImpvaW4iLCJQcm9ncmFtIiwiYm9keSIsInByb2Nlc3NCb2R5U3RhdGVtZW50IiwiZGVjbGFyYXRpb24iLCJ0eXBlIiwic3BlY2lmaWVycyIsImltcG9ydHMiLCJFeHBvcnRzIiwiZ2V0Iiwic291cmNlIiwidmFsdWUiLCJlcnJvcnMiLCJyZXBvcnRFcnJvcnMiLCJzcGVjaWZpZXIiLCJzaXplIiwicmVwb3J0Iiwic2V0IiwibG9jYWwiLCJpbXBvcnRlZCIsIm5hbWVzcGFjZSIsImZvckVhY2giLCJFeHBvcnROYW1lc3BhY2VTcGVjaWZpZXIiLCJNZW1iZXJFeHByZXNzaW9uIiwiZGVyZWZlcmVuY2UiLCJvYmplY3QiLCJoYXMiLCJwYXJlbnQiLCJsZWZ0IiwiY29tcHV0ZWQiLCJwcm9wZXJ0eSIsImV4cG9ydGVkIiwicHVzaCIsIlZhcmlhYmxlRGVjbGFyYXRvciIsImlkIiwiaW5pdCIsInRlc3RLZXkiLCJwYXR0ZXJuIiwicGF0aCIsInByb3BlcnRpZXMiLCJrZXkiLCJub2RlIiwibWVzc2FnZSIsInBvcCIsIkpTWE1lbWJlckV4cHJlc3Npb24iXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztBQUVBQSxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFFBQU07QUFDSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLFdBQVI7QUFERCxLQURGOztBQUtKQyxZQUFRLENBQ047QUFDRSxjQUFRLFFBRFY7QUFFRSxvQkFBYztBQUNaLHlCQUFpQjtBQUNmLHlCQUNF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cUJBQVMvQyxZQUFZbUMsUUFBWixFQUFzQixDQUFDTCxPQUFPM0IsSUFBUixDQUF0QjtBQUZJLFdBQWY7QUFJRDtBQUNIO0FBbEtJLEtBQVA7QUFvS0Q7QUExTWMsQ0FBakIiLCJmaWxlIjoicnVsZXMvbmFtZXNwYWNlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGRlY2xhcmVkU2NvcGUgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9kZWNsYXJlZFNjb3BlJ1xuaW1wb3J0IEV4cG9ydHMgZnJvbSAnLi4vRXhwb3J0TWFwJ1xuaW1wb3J0IGltcG9ydERlY2xhcmF0aW9uIGZyb20gJy4uL2ltcG9ydERlY2xhcmF0aW9uJ1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ25hbWVzcGFjZScpLFxuICAgIH0sXG5cbiAgICBzY2hlbWE6IFtcbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiAnb2JqZWN0JyxcbiAgICAgICAgJ3Byb3BlcnRpZXMnOiB7XG4gICAgICAgICAgJ2FsbG93Q29tcHV0ZWQnOiB7XG4gICAgICAgICAgICAnZGVzY3JpcHRpb24nOlxuICAgICAgICAgICAgICAnSWYgYGZhbHNlYCwgd2lsbCByZXBvcnQgY29tcHV0ZWQgKGFuZCB0aHVzLCB1bi1saW50YWJsZSkgcmVmZXJlbmNlcyAnICtcbiAgICAgICAgICAgICAgJ3RvIG5hbWVzcGFjZSBtZW1iZXJzLicsXG4gICAgICAgICAgICAndHlwZSc6ICdib29sZWFuJyxcbiAgICAgICAgICAgICdkZWZhdWx0JzogZmFsc2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgJ2FkZGl0aW9uYWxQcm9wZXJ0aWVzJzogZmFsc2UsXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiBuYW1lc3BhY2VSdWxlKGNvbnRleHQpIHtcblxuICAgIC8vIHJlYWQgb3B0aW9uc1xuICAgIGNvbnN0IHtcbiAgICAgIGFsbG93Q29tcHV0ZWQgPSBmYWxzZSxcbiAgICB9ID0gY29udGV4dC5vcHRpb25zWzBdIHx8IHt9XG5cbiAgICBjb25zdCBuYW1lc3BhY2VzID0gbmV3IE1hcCgpXG5cbiAgICBmdW5jdGlvbiBtYWtlTWVzc2FnZShsYXN0LCBuYW1lcGF0aCkge1xuICAgICAgIHJldHVybiBgJyR7bGFzdC5uYW1lfScgbm90IGZvdW5kIGluYCArXG4gICAgICAgICAgICAgIChuYW1lcGF0aC5sZW5ndGggPiAxID8gJyBkZWVwbHkgJyA6ICcgJykgK1xuICAgICAgICAgICAgICBgaW1wb3J0ZWQgbmFtZXNwYWNlICcke25hbWVwYXRoLmpvaW4oJy4nKX0nLmBcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuXG4gICAgICAvLyBwaWNrIHVwIGFsbCBpbXBvcnRzIGF0IGJvZHkgZW50cnkgdGltZSwgdG8gcHJvcGVybHkgcmVzcGVjdCBob2lzdGluZ1xuICAgICAgUHJvZ3JhbTogZnVuY3Rpb24gKHsgYm9keSB9KSB7XG4gICAgICAgIGZ1bmN0aW9uIHByb2Nlc3NCb2R5U3RhdGVtZW50KGRlY2xhcmF0aW9uKSB7XG4gICAgICAgICAgaWYgKGRlY2xhcmF0aW9uLnR5cGUgIT09ICdJbXBvcnREZWNsYXJhdGlvbicpIHJldHVyblxuXG4gICAgICAgICAgaWYgKGRlY2xhcmF0aW9uLnNwZWNpZmllcnMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICAgICAgICAgIGNvbnN0IGltcG9ydHMgPSBFeHBvcnRzLmdldChkZWNsYXJhdGlvbi5zb3VyY2UudmFsdWUsIGNvbnRleHQpXG4gICAgICAgICAgaWYgKGltcG9ydHMgPT0gbnVsbCkgcmV0dXJuIG51bGxcblxuICAgICAgICAgIGlmIChpbXBvcnRzLmVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGltcG9ydHMucmVwb3J0RXJyb3JzKGNvbnRleHQsIGRlY2xhcmF0aW9uKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZm9yIChjb25zdCBzcGVjaWZpZXIgb2YgZGVjbGFyYXRpb24uc3BlY2lmaWVycykge1xuICAgICAgICAgICAgc3dpdGNoIChzcGVjaWZpZXIudHlwZSkge1xuICAgICAgICAgICAgICBjYXNlICdJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXInOlxuICAgICAgICAgICAgICAgIGlmICghaW1wb3J0cy5zaXplKSB7XG4gICAgICAgICAgICAgICAgICBjb250ZXh0LnJlcG9ydChzcGVjaWZpZXIsXG4gICAgICAgICAgICAgICAgICAgIGBObyBleHBvcnRlZCBuYW1lcyBmb3VuZCBpbiBtb2R1bGUgJyR7ZGVjbGFyYXRpb24uc291cmNlLnZhbHVlfScuYClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlcy5zZXQoc3BlY2lmaWVyLmxvY2FsLm5hbWUsIGltcG9ydHMpXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgY2FzZSAnSW1wb3J0RGVmYXVsdFNwZWNpZmllcic6XG4gICAgICAgICAgICAgIGNhc2UgJ0ltcG9ydFNwZWNpZmllcic6IHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXRhID0gaW1wb3J0cy5nZXQoXG4gICAgICAgICAgICAgICAgICAvLyBkZWZhdWx0IHRvICdkZWZhdWx0JyBmb3IgZGVmYXVsdCBodHRwOi8vaS5pbWd1ci5jb20vbmo2cUFXeS5qcGdcbiAgICAgICAgICAgICAgICAgIHNwZWNpZmllci5pbXBvcnRlZCA/IHNwZWNpZmllci5pbXBvcnRlZC5uYW1lIDogJ2RlZmF1bHQnKVxuICAgICAgICAgICAgICAgIGlmICghbWV0YSB8fCAhbWV0YS5uYW1lc3BhY2UpIGJyZWFrXG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlcy5zZXQoc3BlY2lmaWVyLmxvY2FsLm5hbWUsIG1ldGEubmFtZXNwYWNlKVxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYm9keS5mb3JFYWNoKHByb2Nlc3NCb2R5U3RhdGVtZW50KVxuICAgICAgfSxcblxuICAgICAgLy8gc2FtZSBhcyBhYm92ZSwgYnV0IGRvZXMgbm90IGFkZCBuYW1lcyB0byBsb2NhbCBtYXBcbiAgICAgIEV4cG9ydE5hbWVzcGFjZVNwZWNpZmllcjogZnVuY3Rpb24gKG5hbWVzcGFjZSkge1xuICAgICAgICB2YXIgZGVjbGFyYXRpb24gPSBpbXBvcnREZWNsYXJhdGlvbihjb250ZXh0KVxuXG4gICAgICAgIHZhciBpbXBvcnRzID0gRXhwb3J0cy5nZXQoZGVjbGFyYXRpb24uc291cmNlLnZhbHVlLCBjb250ZXh0KVxuICAgICAgICBpZiAoaW1wb3J0cyA9PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gICAgICAgIGlmIChpbXBvcnRzLmVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICBpbXBvcnRzLnJlcG9ydEVycm9ycyhjb250ZXh0LCBkZWNsYXJhdGlvbilcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaW1wb3J0cy5zaXplKSB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQobmFtZXNwYWNlLFxuICAgICAgICAgICAgYE5vIGV4cG9ydGVkIG5hbWVzIGZvdW5kIGluIG1vZHVsZSAnJHtkZWNsYXJhdGlvbi5zb3VyY2UudmFsdWV9Jy5gKVxuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvLyB0b2RvOiBjaGVjayBmb3IgcG9zc2libGUgcmVkZWZpbml0aW9uXG5cbiAgICAgIE1lbWJlckV4cHJlc3Npb246IGZ1bmN0aW9uIChkZXJlZmVyZW5jZSkge1xuICAgICAgICBpZiAoZGVyZWZlcmVuY2Uub2JqZWN0LnR5cGUgIT09ICdJZGVudGlmaWVyJykgcmV0dXJuXG4gICAgICAgIGlmICghbmFtZXNwYWNlcy5oYXMoZGVyZWZlcmVuY2Uub2JqZWN0Lm5hbWUpKSByZXR1cm5cblxuICAgICAgICBpZiAoZGVyZWZlcmVuY2UucGFyZW50LnR5cGUgPT09ICdBc3NpZ25tZW50RXhwcmVzc2lvbicgJiZcbiAgICAgICAgICAgIGRlcmVmZXJlbmNlLnBhcmVudC5sZWZ0ID09PSBkZXJlZmVyZW5jZSkge1xuICAgICAgICAgICAgY29udGV4dC5yZXBvcnQoZGVyZWZlcmVuY2UucGFyZW50LFxuICAgICAgICAgICAgICAgIGBBc3NpZ25tZW50IHRvIG1lbWJlciBvZiBuYW1lc3BhY2UgJyR7ZGVyZWZlcmVuY2Uub2JqZWN0Lm5hbWV9Jy5gKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ28gZGVlcFxuICAgICAgICB2YXIgbmFtZXNwYWNlID0gbmFtZXNwYWNlcy5nZXQoZGVyZWZlcmVuY2Uub2JqZWN0Lm5hbWUpXG4gICAgICAgIHZhciBuYW1lcGF0aCA9IFtkZXJlZmVyZW5jZS5vYmplY3QubmFtZV1cbiAgICAgICAgLy8gd2hpbGUgcHJvcGVydHkgaXMgbmFtZXNwYWNlIGFuZCBwYXJlbnQgaXMgbWVtYmVyIGV4cHJlc3Npb24sIGtlZXAgdmFsaWRhdGluZ1xuICAgICAgICB3aGlsZSAobmFtZXNwYWNlIGluc3RhbmNlb2YgRXhwb3J0cyAmJlxuICAgICAgICAgICAgICAgZGVyZWZlcmVuY2UudHlwZSA9PT0gJ01lbWJlckV4cHJlc3Npb24nKSB7XG5cbiAgICAgICAgICBpZiAoZGVyZWZlcmVuY2UuY29tcHV0ZWQpIHtcbiAgICAgICAgICAgIGlmICghYWxsb3dDb21wdXRlZCkge1xuICAgICAgICAgICAgICBjb250ZXh0LnJlcG9ydChkZXJlZmVyZW5jZS5wcm9wZXJ0eSxcbiAgICAgICAgICAgICAgICAnVW5hYmxlIHRvIHZhbGlkYXRlIGNvbXB1dGVkIHJlZmVyZW5jZSB0byBpbXBvcnRlZCBuYW1lc3BhY2UgXFwnJyArXG4gICAgICAgICAgICAgICAgZGVyZWZlcmVuY2Uub2JqZWN0Lm5hbWUgKyAnXFwnLicpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIW5hbWVzcGFjZS5oYXMoZGVyZWZlcmVuY2UucHJvcGVydHkubmFtZSkpIHtcbiAgICAgICAgICAgIGNvbnRleHQucmVwb3J0KFxuICAgICAgICAgICAgICBkZXJlZmVyZW5jZS5wcm9wZXJ0eSxcbiAgICAgICAgICAgICAgbWFrZU1lc3NhZ2UoZGVyZWZlcmVuY2UucHJvcGVydHksIG5hbWVwYXRoKSlcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZXhwb3J0ZWQgPSBuYW1lc3BhY2UuZ2V0KGRlcmVmZXJlbmNlLnByb3BlcnR5Lm5hbWUpXG4gICAgICAgICAgaWYgKGV4cG9ydGVkID09IG51bGwpIHJldHVyblxuXG4gICAgICAgICAgLy8gc3Rhc2ggYW5kIHBvcFxuICAgICAgICAgIG5hbWVwYXRoLnB1c2goZGVyZWZlcmVuY2UucHJvcGVydHkubmFtZSlcbiAgICAgICAgICBuYW1lc3BhY2UgPSBleHBvcnRlZC5uYW1lc3BhY2VcbiAgICAgICAgICBkZXJlZmVyZW5jZSA9IGRlcmVmZXJlbmNlLnBhcmVudFxuICAgICAgICB9XG5cbiAgICAgIH0sXG5cbiAgICAgIFZhcmlhYmxlRGVjbGFyYXRvcjogZnVuY3Rpb24gKHsgaWQsIGluaXQgfSkge1xuICAgICAgICBpZiAoaW5pdCA9PSBudWxsKSByZXR1cm5cbiAgICAgICAgaWYgKGluaXQudHlwZSAhPT0gJ0lkZW50aWZpZXInKSByZXR1cm5cbiAgICAgICAgaWYgKCFuYW1lc3BhY2VzLmhhcyhpbml0Lm5hbWUpKSByZXR1cm5cblxuICAgICAgICAvLyBjaGVjayBmb3IgcmVkZWZpbml0aW9uIGluIGludGVybWVkaWF0ZSBzY29wZXNcbiAgICAgICAgaWYgKGRlY2xhcmVkU2NvcGUoY29udGV4dCwgaW5pdC5uYW1lKSAhPT0gJ21vZHVsZScpIHJldHVyblxuXG4gICAgICAgIC8vIERGUyB0cmF2ZXJzZSBjaGlsZCBuYW1lc3BhY2VzXG4gICAgICAgIGZ1bmN0aW9uIHRlc3RLZXkocGF0dGVybiwgbmFtZXNwYWNlLCBwYXRoID0gW2luaXQubmFtZV0pIHtcbiAgICAgICAgICBpZiAoIShuYW1lc3BhY2UgaW5zdGFuY2VvZiBFeHBvcnRzKSkgcmV0dXJuXG5cbiAgICAgICAgICBpZiAocGF0dGVybi50eXBlICE9PSAnT2JqZWN0UGF0dGVybicpIHJldHVyblxuXG4gICAgICAgICAgZm9yIChjb25zdCBwcm9wZXJ0eSBvZiBwYXR0ZXJuLnByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgcHJvcGVydHkudHlwZSA9PT0gJ0V4cGVyaW1lbnRhbFJlc3RQcm9wZXJ0eSdcbiAgICAgICAgICAgICAgfHwgcHJvcGVydHkudHlwZSA9PT0gJ1Jlc3RFbGVtZW50J1xuICAgICAgICAgICAgICB8fCAhcHJvcGVydHkua2V5XG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByb3BlcnR5LmtleS50eXBlICE9PSAnSWRlbnRpZmllcicpIHtcbiAgICAgICAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgICAgICAgIG5vZGU6IHByb3BlcnR5LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdPbmx5IGRlc3RydWN0dXJlIHRvcC1sZXZlbCBuYW1lcy4nLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW5hbWVzcGFjZS5oYXMocHJvcGVydHkua2V5Lm5hbWUpKSB7XG4gICAgICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgICAgICBub2RlOiBwcm9wZXJ0eSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtYWtlTWVzc2FnZShwcm9wZXJ0eS5rZXksIHBhdGgpLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwYXRoLnB1c2gocHJvcGVydHkua2V5Lm5hbWUpXG4gICAgICAgICAgICB0ZXN0S2V5KHByb3BlcnR5LnZhbHVlLCBuYW1lc3BhY2UuZ2V0KHByb3BlcnR5LmtleS5uYW1lKS5uYW1lc3BhY2UsIHBhdGgpXG4gICAgICAgICAgICBwYXRoLnBvcCgpXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGVzdEtleShpZCwgbmFtZXNwYWNlcy5nZXQoaW5pdC5uYW1lKSlcbiAgICAgIH0sXG5cbiAgICAgIEpTWE1lbWJlckV4cHJlc3Npb246IGZ1bmN0aW9uKHtvYmplY3QsIHByb3BlcnR5fSkge1xuICAgICAgICAgaWYgKCFuYW1lc3BhY2VzLmhhcyhvYmplY3QubmFtZSkpIHJldHVyblxuICAgICAgICAgdmFyIG5hbWVzcGFjZSA9IG5hbWVzcGFjZXMuZ2V0KG9iamVjdC5uYW1lKVxuICAgICAgICAgaWYgKCFuYW1lc3BhY2UuaGFzKHByb3BlcnR5Lm5hbWUpKSB7XG4gICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgICBub2RlOiBwcm9wZXJ0eSxcbiAgICAgICAgICAgICBtZXNzYWdlOiBtYWtlTWVzc2FnZShwcm9wZXJ0eSwgW29iamVjdC5uYW1lXSksXG4gICAgICAgICAgIH0pXG4gICAgICAgICB9XG4gICAgICB9LFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==