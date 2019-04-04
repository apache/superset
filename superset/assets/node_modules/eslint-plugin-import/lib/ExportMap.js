'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.recursivePatternCapture = recursivePatternCapture;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _doctrine = require('doctrine');

var _doctrine2 = _interopRequireDefault(_doctrine);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _parse = require('eslint-module-utils/parse');

var _parse2 = _interopRequireDefault(_parse);

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _ignore = require('eslint-module-utils/ignore');

var _ignore2 = _interopRequireDefault(_ignore);

var _hash = require('eslint-module-utils/hash');

var _unambiguous = require('eslint-module-utils/unambiguous');

var unambiguous = _interopRequireWildcard(_unambiguous);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = (0, _debug2.default)('eslint-plugin-import:ExportMap');

const exportCache = new Map();

class ExportMap {
  constructor(path) {
    this.path = path;
    this.namespace = new Map();
    // todo: restructure to key on path, value is resolver + map of names
    this.reexports = new Map();
    /**
     * star-exports
     * @type {Set} of () => ExportMap
     */
    this.dependencies = new Set();
    /**
     * dependencies of this module that are not explicitly re-exported
     * @type {Map} from path = () => ExportMap
     */
    this.imports = new Map();
    this.errors = [];
  }

  get hasDefault() {
    return this.get('default') != null;
  } // stronger than this.has

  get size() {
    let size = this.namespace.size + this.reexports.size;
    this.dependencies.forEach(dep => {
      const d = dep();
      // CJS / ignored dependencies won't exist (#717)
      if (d == null) return;
      size += d.size;
    });
    return size;
  }

  /**
   * Note that this does not check explicitly re-exported names for existence
   * in the base namespace, but it will expand all `export * from '...'` exports
   * if not found in the explicit namespace.
   * @param  {string}  name
   * @return {Boolean} true if `name` is exported by this module.
   */
  has(name) {
    if (this.namespace.has(name)) return true;
    if (this.reexports.has(name)) return true;

    // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {
      for (let dep of this.dependencies) {
        let innerMap = dep();

        // todo: report as unresolved?
        if (!innerMap) continue;

        if (innerMap.has(name)) return true;
      }
    }

    return false;
  }

  /**
   * ensure that imported name fully resolves.
   * @param  {[type]}  name [description]
   * @return {Boolean}      [description]
   */
  hasDeep(name) {
    if (this.namespace.has(name)) return { found: true, path: [this] };

    if (this.reexports.has(name)) {
      const reexports = this.reexports.get(name),
            imported = reexports.getImport();

      // if import is ignored, return explicit 'null'
      if (imported == null) return { found: true, path: [this]

        // safeguard against cycles, only if name matches
      };if (imported.path === this.path && reexports.local === name) {
        return { found: false, path: [this] };
      }

      const deep = imported.hasDeep(reexports.local);
      deep.path.unshift(this);

      return deep;
    }

    // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {
      for (let dep of this.dependencies) {
        let innerMap = dep();
        // todo: report as unresolved?
        if (!innerMap) continue;

        // safeguard against cycles
        if (innerMap.path === this.path) continue;

        let innerValue = innerMap.hasDeep(name);
        if (innerValue.found) {
          innerValue.path.unshift(this);
          return innerValue;
        }
      }
    }

    return { found: false, path: [this] };
  }

  get(name) {
    if (this.namespace.has(name)) return this.namespace.get(name);

    if (this.reexports.has(name)) {
      const reexports = this.reexports.get(name),
            imported = reexports.getImport();

      // if import is ignored, return explicit 'null'
      if (imported == null) return null;

      // safeguard against cycles, only if name matches
      if (imported.path === this.path && reexports.local === name) return undefined;

      return imported.get(reexports.local);
    }

    // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {
      for (let dep of this.dependencies) {
        let innerMap = dep();
        // todo: report as unresolved?
        if (!innerMap) continue;

        // safeguard against cycles
        if (innerMap.path === this.path) continue;

        let innerValue = innerMap.get(name);
        if (innerValue !== undefined) return innerValue;
      }
    }

    return undefined;
  }

  forEach(callback, thisArg) {
    this.namespace.forEach((v, n) => callback.call(thisArg, v, n, this));

    this.reexports.forEach((reexports, name) => {
      const reexported = reexports.getImport();
      // can't look up meta for ignored re-exports (#348)
      callback.call(thisArg, reexported && reexported.get(reexports.local), name, this);
    });

    this.dependencies.forEach(dep => {
      const d = dep();
      // CJS / ignored dependencies won't exist (#717)
      if (d == null) return;

      d.forEach((v, n) => n !== 'default' && callback.call(thisArg, v, n, this));
    });
  }

  // todo: keys, values, entries?

  reportErrors(context, declaration) {
    context.report({
      node: declaration.source,
      message: `Parse errors in imported module '${declaration.source.value}': ` + `${this.errors.map(e => `${e.message} (${e.lineNumber}:${e.column})`).join(', ')}`
    });
  }
}

exports.default = ExportMap; /**
                              * parse docs from the first node that has leading comments
                              * @param  {...[type]} nodes [description]
                              * @return {{doc: object}}
                              */

function captureDoc(docStyleParsers) {
  const metadata = {},
        nodes = Array.prototype.slice.call(arguments, 1);

  // 'some' short-circuits on first 'true'
  nodes.some(n => {
    if (!n.leadingComments) return false;

    for (let name in docStyleParsers) {
      const doc = docStyleParsers[name](n.leadingComments);
      if (doc) {
        metadata.doc = doc;
      }
    }

    return true;
  });

  return metadata;
}

const availableDocStyleParsers = {
  jsdoc: captureJsDoc,
  tomdoc: captureTomDoc

  /**
   * parse JSDoc from leading comments
   * @param  {...[type]} comments [description]
   * @return {{doc: object}}
   */
};function captureJsDoc(comments) {
  let doc;

  // capture XSDoc
  comments.forEach(comment => {
    // skip non-block comments
    if (comment.value.slice(0, 4) !== '*\n *') return;
    try {
      doc = _doctrine2.default.parse(comment.value, { unwrap: true });
    } catch (err) {
      /* don't care, for now? maybe add to `errors?` */
    }
  });

  return doc;
}

/**
  * parse TomDoc section from comments
  */
function captureTomDoc(comments) {
  // collect lines up to first paragraph break
  const lines = [];
  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];
    if (comment.value.match(/^\s*$/)) break;
    lines.push(comment.value.trim());
  }

  // return doctrine-like object
  const statusMatch = lines.join(' ').match(/^(Public|Internal|Deprecated):\s*(.+)/);
  if (statusMatch) {
    return {
      description: statusMatch[2],
      tags: [{
        title: statusMatch[1].toLowerCase(),
        description: statusMatch[2]
      }]
    };
  }
}

ExportMap.get = function (source, context) {
  const path = (0, _resolve2.default)(source, context);
  if (path == null) return null;

  return ExportMap.for(childContext(path, context));
};

ExportMap.for = function (context) {
  const path = context.path;


  const cacheKey = (0, _hash.hashObject)(context).digest('hex');
  let exportMap = exportCache.get(cacheKey);

  // return cached ignore
  if (exportMap === null) return null;

  const stats = _fs2.default.statSync(path);
  if (exportMap != null) {
    // date equality check
    if (exportMap.mtime - stats.mtime === 0) {
      return exportMap;
    }
    // future: check content equality?
  }

  // check valid extensions first
  if (!(0, _ignore.hasValidExtension)(path, context)) {
    exportCache.set(cacheKey, null);
    return null;
  }

  const content = _fs2.default.readFileSync(path, { encoding: 'utf8' });

  // check for and cache ignore
  if ((0, _ignore2.default)(path, context) || !unambiguous.test(content)) {
    log('ignored path due to unambiguous regex or ignore settings:', path);
    exportCache.set(cacheKey, null);
    return null;
  }

  log('cache miss', cacheKey, 'for path', path);
  exportMap = ExportMap.parse(path, content, context);

  // ambiguous modules return null
  if (exportMap == null) return null;

  exportMap.mtime = stats.mtime;

  exportCache.set(cacheKey, exportMap);
  return exportMap;
};

ExportMap.parse = function (path, content, context) {
  var m = new ExportMap(path);

  try {
    var ast = (0, _parse2.default)(path, content, context);
  } catch (err) {
    log('parse error:', path, err);
    m.errors.push(err);
    return m; // can't continue
  }

  if (!unambiguous.isModule(ast)) return null;

  const docstyle = context.settings && context.settings['import/docstyle'] || ['jsdoc'];
  const docStyleParsers = {};
  docstyle.forEach(style => {
    docStyleParsers[style] = availableDocStyleParsers[style];
  });

  // attempt to collect module doc
  if (ast.comments) {
    ast.comments.some(c => {
      if (c.type !== 'Block') return false;
      try {
        const doc = _doctrine2.default.parse(c.value, { unwrap: true });
        if (doc.tags.some(t => t.title === 'module')) {
          m.doc = doc;
          return true;
        }
      } catch (err) {/* ignore */}
      return false;
    });
  }

  const namespaces = new Map();

  function remotePath(value) {
    return _resolve2.default.relative(value, path, context.settings);
  }

  function resolveImport(value) {
    const rp = remotePath(value);
    if (rp == null) return null;
    return ExportMap.for(childContext(rp, context));
  }

  function getNamespace(identifier) {
    if (!namespaces.has(identifier.name)) return;

    return function () {
      return resolveImport(namespaces.get(identifier.name));
    };
  }

  function addNamespace(object, identifier) {
    const nsfn = getNamespace(identifier);
    if (nsfn) {
      Object.defineProperty(object, 'namespace', { get: nsfn });
    }

    return object;
  }

  function captureDependency(declaration) {
    if (declaration.source == null) return null;

    const p = remotePath(declaration.source.value);
    if (p == null) return null;
    const existing = m.imports.get(p);
    if (existing != null) return existing.getter;

    const getter = () => ExportMap.for(childContext(p, context));
    m.imports.set(p, {
      getter,
      source: { // capturing actual node reference holds full AST in memory!
        value: declaration.source.value,
        loc: declaration.source.loc
      }
    });
    return getter;
  }

  ast.body.forEach(function (n) {

    if (n.type === 'ExportDefaultDeclaration') {
      const exportMeta = captureDoc(docStyleParsers, n);
      if (n.declaration.type === 'Identifier') {
        addNamespace(exportMeta, n.declaration);
      }
      m.namespace.set('default', exportMeta);
      return;
    }

    if (n.type === 'ExportAllDeclaration') {
      const getter = captureDependency(n);
      if (getter) m.dependencies.add(getter);
      return;
    }

    // capture namespaces in case of later export
    if (n.type === 'ImportDeclaration') {
      captureDependency(n);
      let ns;
      if (n.specifiers.some(s => s.type === 'ImportNamespaceSpecifier' && (ns = s))) {
        namespaces.set(ns.local.name, n.source.value);
      }
      return;
    }

    if (n.type === 'ExportNamedDeclaration') {
      // capture declaration
      if (n.declaration != null) {
        switch (n.declaration.type) {
          case 'FunctionDeclaration':
          case 'ClassDeclaration':
          case 'TypeAlias': // flowtype with babel-eslint parser
          case 'InterfaceDeclaration':
          case 'TSEnumDeclaration':
          case 'TSInterfaceDeclaration':
          case 'TSAbstractClassDeclaration':
          case 'TSModuleDeclaration':
            m.namespace.set(n.declaration.id.name, captureDoc(docStyleParsers, n));
            break;
          case 'VariableDeclaration':
            n.declaration.declarations.forEach(d => recursivePatternCapture(d.id, id => m.namespace.set(id.name, captureDoc(docStyleParsers, d, n))));
            break;
        }
      }

      const nsource = n.source && n.source.value;
      n.specifiers.forEach(s => {
        const exportMeta = {};
        let local;

        switch (s.type) {
          case 'ExportDefaultSpecifier':
            if (!n.source) return;
            local = 'default';
            break;
          case 'ExportNamespaceSpecifier':
            m.namespace.set(s.exported.name, Object.defineProperty(exportMeta, 'namespace', {
              get() {
                return resolveImport(nsource);
              }
            }));
            return;
          case 'ExportSpecifier':
            if (!n.source) {
              m.namespace.set(s.exported.name, addNamespace(exportMeta, s.local));
              return;
            }
          // else falls through
          default:
            local = s.local.name;
            break;
        }

        // todo: JSDoc
        m.reexports.set(s.exported.name, { local, getImport: () => resolveImport(nsource) });
      });
    }
  });

  return m;
};

/**
 * Traverse a pattern/identifier node, calling 'callback'
 * for each leaf identifier.
 * @param  {node}   pattern
 * @param  {Function} callback
 * @return {void}
 */
function recursivePatternCapture(pattern, callback) {
  switch (pattern.type) {
    case 'Identifier':
      // base case
      callback(pattern);
      break;

    case 'ObjectPattern':
      pattern.properties.forEach(p => {
        recursivePatternCapture(p.value, callback);
      });
      break;

    case 'ArrayPattern':
      pattern.elements.forEach(element => {
        if (element == null) return;
        recursivePatternCapture(element, callback);
      });
      break;
  }
}

/**
 * don't hold full context object in memory, just grab what we need.
 */
function childContext(path, context) {
  const settings = context.settings,
        parserOptions = context.parserOptions,
        parserPath = context.parserPath;

  return {
    settings,
    parserOptions,
    parserPath,
    path
  };
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkV4cG9ydE1hcC5qcyJdLCJuYW1lcyI6WyJyZWN1cnNpdmVQYXR0ZXJuQ2FwdHVyZSIsInVuYW1iaWd1b3VzIiwibG9nIiwiZXhwb3J0Q2FjaGUiLCJNYXAiLCJFeHBvcnRNYXAiLCJjb25zdHJ1Y3RvciIsInBhdGgiLCJuYW1lc3BhY2UiLCJyZWV4cG9ydHMiLCJkZXBlbmRlbmNpZXMiLCJTZXQiLCJpbXBvcnRzIiwiZXJyb3JzIiwiaGFzRGVmYXVsdCIsImdldCIsInNpemUiLCJmb3JFYWNoIiwiZGVwIiwiZCIsImhhcyIsIm5hbWUiLCJpbm5lck1hcCIsImhhc0RlZXAiLCJmb3VuZCIsImltcG9ydGVkIiwiZ2V0SW1wb3J0IiwibG9jYWwiLCJkZWVwIiwidW5zaGlmdCIsImlubmVyVmFsdWUiLCJ1bmRlZmluZWQiLCJjYWxsYmFjayIsInRoaXNBcmciLCJ2IiwibiIsImNhbGwiLCJyZWV4cG9ydGVkIiwicmVwb3J0RXJyb3JzIiwiY29udGV4dCIsImRlY2xhcmF0aW9uIiwicmVwb3J0Iiwibm9kZSIsInNvdXJjZSIsIm1lc3NhZ2UiLCJ2YWx1ZSIsIm1hcCIsImUiLCJsaW5lTnVtYmVyIiwiY29sdW1uIiwiam9pbiIsImNhcHR1cmVEb2MiLCJkb2NTdHlsZVBhcnNlcnMiLCJtZXRhZGF0YSIsIm5vZGVzIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJzbGljZSIsImFyZ3VtZW50cyIsInNvbWUiLCJsZWFkaW5nQ29tbWVudHMiLCJkb2MiLCJhdmFpbGFibGVEb2NTdHlsZVBhcnNlcnMiLCJqc2RvYyIsImNhcHR1cmVKc0RvYyIsInRvbWRvYyIsImNhcHR1cmVUb21Eb2MiLCJjb21tZW50cyIsImNvbW1lbnQiLCJkb2N0cmluZSIsInBhcnNlIiwidW53cmFwIiwiZXJyIiwibGluZXMiLCJpIiwibGVuZ3RoIiwibWF0Y2giLCJwdXNoIiwidHJpbSIsInN0YXR1c01hdGNoIiwiZGVzY3JpcHRpb24iLCJ0YWdzIiwidGl0bGUiLCJ0b0xvd2VyQ2FzZSIsImZvciIsImNoaWxkQ29udGV4dCIsImNhY2hlS2V5IiwiZGlnZXN0IiwiZXhwb3J0TWFwIiwic3RhdHMiLCJmcyIsInN0YXRTeW5jIiwibXRpbWUiLCJzZXQiLCJjb250ZW50IiwicmVhZEZpbGVTeW5jIiwiZW5jb2RpbmciLCJ0ZXN0IiwibSIsImFzdCIsImlzTW9kdWxlIiwiZG9jc3R5bGUiLCJzZXR0aW5ncyIsInN0eWxlIiwiYyIsInR5cGUiLCJ0IiwibmFtZXNwYWNlcyIsInJlbW90ZVBhdGgiLCJyZXNvbHZlIiwicmVsYXRpdmUiLCJyZXNvbHZlSW1wb3J0IiwicnAiLCJnZXROYW1lc3BhY2UiLCJpZGVudGlmaWVyIiwiYWRkTmFtZXNwYWNlIiwib2JqZWN0IiwibnNmbiIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiY2FwdHVyZURlcGVuZGVuY3kiLCJwIiwiZXhpc3RpbmciLCJnZXR0ZXIiLCJsb2MiLCJib2R5IiwiZXhwb3J0TWV0YSIsImFkZCIsIm5zIiwic3BlY2lmaWVycyIsInMiLCJpZCIsImRlY2xhcmF0aW9ucyIsIm5zb3VyY2UiLCJleHBvcnRlZCIsInBhdHRlcm4iLCJwcm9wZXJ0aWVzIiwiZWxlbWVudHMiLCJlbGVtZW50IiwicGFyc2VyT3B0aW9ucyIsInBhcnNlclBhdGgiXSwibWFwcGluZ3MiOiI7Ozs7O1FBZ2ZnQkEsdUIsR0FBQUEsdUI7O0FBaGZoQjs7OztBQUVBOzs7O0FBRUE7Ozs7QUFFQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFFQTs7QUFDQTs7SUFBWUMsVzs7Ozs7O0FBRVosTUFBTUMsTUFBTSxxQkFBTSxnQ0FBTixDQUFaOztBQUVBLE1BQU1DLGNBQWMsSUFBSUMsR0FBSixFQUFwQjs7QUFFZSxNQUFNQyxTQUFOLENBQWdCO0FBQzdCQyxjQUFZQyxJQUFaLEVBQWtCO0FBQ2hCLFNBQUtBLElBQUwsR0FBWUEsSUFBWjtBQUNBLFNBQUtDLFNBQUwsR0FBaUIsSUFBSUosR0FBSixFQUFqQjtBQUNBO0FBQ0EsU0FBS0ssU0FBTCxHQUFpQixJQUFJTCxHQUFKLEVBQWpCO0FB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QU1xRixjQUFjc0IsT0FBZCxDQUExQixFQUFqQztBQUNELE9BM0JEO0FBNEJEO0FBQ0YsR0EvRUQ7O0FBaUZBLFNBQU9uQyxDQUFQO0FBQ0QsQ0FyS0Q7O0FBd0tBOzs7Ozs7O0FBT08sU0FBU2xHLHVCQUFULENBQWlDdUksT0FBakMsRUFBMEN2RyxRQUExQyxFQUFvRDtBQUN6RCxVQUFRdUcsUUFBUTlCLElBQWhCO0FBQ0UsU0FBSyxZQUFMO0FBQW1CO0FBQ2pCekUsZUFBU3VHLE9BQVQ7QUFDQTs7QUFFRixTQUFLLGVBQUw7QUFDRUEsY0FBUUMsVUFBUixDQUFtQnZILE9BQW5CLENBQTJCd0csS0FBSztBQUM5QnpILGdDQUF3QnlILEVBQUU1RSxLQUExQixFQUFpQ2IsUUFBakM7QUFDRCxPQUZEO0FBR0E7O0FBRUYsU0FBSyxjQUFMO0FBQ0V1RyxjQUFRRSxRQUFSLENBQWlCeEgsT0FBakIsQ0FBMEJ5SCxPQUFELElBQWE7QUFDcEMsWUFBSUEsV0FBVyxJQUFmLEVBQXFCO0FBQ3JCMUksZ0NBQXdCMEksT0FBeEIsRUFBaUMxRyxRQUFqQztBQUNELE9BSEQ7QUFJQTtBQWhCSjtBQWtCRDs7QUFFRDs7O0FBR0EsU0FBU3FELFlBQVQsQ0FBc0I5RSxJQUF0QixFQUE0QmdDLE9BQTVCLEVBQXFDO0FBQUEsUUFDM0IrRCxRQUQyQixHQUNhL0QsT0FEYixDQUMzQitELFFBRDJCO0FBQUEsUUFDakJxQyxhQURpQixHQUNhcEcsT0FEYixDQUNqQm9HLGFBRGlCO0FBQUEsUUFDRkMsVUFERSxHQUNhckcsT0FEYixDQUNGcUcsVUFERTs7QUFFbkMsU0FBTztBQUNMdEMsWUFESztBQUVMcUMsaUJBRks7QUFHTEMsY0FISztBQUlMckk7QUFKSyxHQUFQO0FBTUQiLCJmaWxlIjoiRXhwb3J0TWFwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuXG5pbXBvcnQgZG9jdHJpbmUgZnJvbSAnZG9jdHJpbmUnXG5cbmltcG9ydCBkZWJ1ZyBmcm9tICdkZWJ1ZydcblxuaW1wb3J0IHBhcnNlIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvcGFyc2UnXG5pbXBvcnQgcmVzb2x2ZSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL3Jlc29sdmUnXG5pbXBvcnQgaXNJZ25vcmVkLCB7IGhhc1ZhbGlkRXh0ZW5zaW9uIH0gZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9pZ25vcmUnXG5cbmltcG9ydCB7IGhhc2hPYmplY3QgfSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL2hhc2gnXG5pbXBvcnQgKiBhcyB1bmFtYmlndW91cyBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL3VuYW1iaWd1b3VzJ1xuXG5jb25zdCBsb2cgPSBkZWJ1ZygnZXNsaW50LXBsdWdpbi1pbXBvcnQ6RXhwb3J0TWFwJylcblxuY29uc3QgZXhwb3J0Q2FjaGUgPSBuZXcgTWFwKClcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXhwb3J0TWFwIHtcbiAgY29uc3RydWN0b3IocGF0aCkge1xuICAgIHRoaXMucGF0aCA9IHBhdGhcbiAgICB0aGlzLm5hbWVzcGFjZSA9IG5ldyBNYXAoKVxuICAgIC8vIHRvZG86IHJlc3RydWN0dXJlIHRvIGtleSBvbiBwYXRoLCB2YWx1ZSBpcyByZXNvbHZlciArIG1hcCBvZiBuYW1lc1xuICAgIHRoaXMucmVleHBvcnRzID0gbmV3IE1hcCgpXG4gICAgLyoqXG4gICAgICogc3Rhci1leHBvcnRzXG4gICAgICogQHR5cGUge1NldH0gb2YgKCkgPT4gRXhwb3J0TWFwXG4gICAgICovXG4gICAgdGhpcy5kZXBlbmRlbmNpZXMgPSBuZXcgU2V0KClcbiAgICAvKipcbiAgICAgKiBkZXBlbmRlbmNpZXMgb2YgdGhpcyBtb2R1bGUgdGhhdCBhcmUgbm90IGV4cGxpY2l0bHkgcmUtZXhwb3J0ZWRcbiAgICAgKiBAdHlwZSB7TWFwfSBmcm9tIHBhdGggPSAoKSA9PiBFeHBvcnRNYXBcbiAgICAgKi9cbiAgICB0aGlzLmltcG9ydHMgPSBuZXcgTWFwKClcbiAgICB0aGlzLmVycm9ycyA9IFtdXG4gIH1cblxuICBnZXQgaGFzRGVmYXVsdCgpIHsgcmV0dXJuIHRoaXMuZ2V0KCdkZWZhdWx0JykgIT0gbnVsbCB9IC8vIHN0cm9uZ2VyIHRoYW4gdGhpcy5oYXNcblxuICBnZXQgc2l6ZSgpIHtcbiAgICBsZXQgc2l6ZSA9IHRoaXMubmFtZXNwYWNlLnNpemUgKyB0aGlzLnJlZXhwb3J0cy5zaXplXG4gICAgdGhpcy5kZXBlbmRlbmNpZXMuZm9yRWFjaChkZXAgPT4ge1xuICAgICAgY29uc3QgZCA9IGRlcCgpXG4gICAgICAvLyBDSlMgLyBpZ25vcmVkIGRlcGVuZGVuY2llcyB3b24ndCBleGlzdCAoIzcxNylcbiAgICAgIGlmIChkID09IG51bGwpIHJldHVyblxuICAgICAgc2l6ZSArPSBkLnNpemVcbiAgICB9KVxuICAgIHJldHVybiBzaXplXG4gIH1cblxuICAvKipcbiAgICogTm90ZSB0aGF0IHRoaXMgZG9lcyBub3QgY2hlY2sgZXhwbGljaXRseSByZS1leHBvcnRlZCBuYW1lcyBmb3IgZXhpc3RlbmNlXG4gICAqIGluIHRoZSBiYXNlIG5hbWVzcGFjZSwgYnV0IGl0IHdpbGwgZXhwYW5kIGFsbCBgZXhwb3J0ICogZnJvbSAnLi4uJ2AgZXhwb3J0c1xuICAgKiBpZiBub3QgZm91bmQgaW4gdGhlIGV4cGxpY2l0IG5hbWVzcGFjZS5cbiAgICogQHBhcmFtICB7c3RyaW5nfSAgbmFtZVxuICAgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIGBuYW1lYCBpcyBleHBvcnRlZCBieSB0aGlzIG1vZHVsZS5cbiAgICovXG4gIGhhcyhuYW1lKSB7XG4gICAgaWYgKHRoaXMubmFtZXNwYWNlLmhhcyhuYW1lKSkgcmV0dXJuIHRydWVcbiAgICBpZiAodGhpcy5yZWV4cG9ydHMuaGFzKG5hbWUpKSByZXR1cm4gdHJ1ZVxuXG4gICAgLy8gZGVmYXVsdCBleHBvcnRzIG11c3QgYmUgZXhwbGljaXRseSByZS1leHBvcnRlZCAoIzMyOClcbiAgICBpZiAobmFtZSAhPT0gJ2RlZmF1bHQnKSB7XG4gICAgICBmb3IgKGxldCBkZXAgb2YgdGhpcy5kZXBlbmRlbmNpZXMpIHtcbiAgICAgICAgbGV0IGlubmVyTWFwID0gZGVwKClcblxuICAgICAgICAvLyB0b2RvOiByZXBvcnQgYXMgdW5yZXNvbHZlZD9cbiAgICAgICAgaWYgKCFpbm5lck1hcCkgY29udGludWVcblxuICAgICAgICBpZiAoaW5uZXJNYXAuaGFzKG5hbWUpKSByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgLyoqXG4gICAqIGVuc3VyZSB0aGF0IGltcG9ydGVkIG5hbWUgZnVsbHkgcmVzb2x2ZXMuXG4gICAqIEBwYXJhbSAge1t0eXBlXX0gIG5hbWUgW2Rlc2NyaXB0aW9uXVxuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgIFtkZXNjcmlwdGlvbl1cbiAgICovXG4gIGhhc0RlZXAobmFtZSkge1xuICAgIGlmICh0aGlzLm5hbWVzcGFjZS5oYXMobmFtZSkpIHJldHVybiB7IGZvdW5kOiB0cnVlLCBwYXRoOiBbdGhpc10gfVxuXG4gICAgaWYgKHRoaXMucmVleHBvcnRzLmhhcyhuYW1lKSkge1xuICAgICAgY29uc3QgcmVleHBvcnRzID0gdGhpcy5yZWV4cG9ydHMuZ2V0KG5hbWUpXG4gICAgICAgICAgLCBpbXBvcnRlZCA9IHJlZXhwb3J0cy5nZXRJbXBvcnQoKVxuXG4gICAgICAvLyBpZiBpbXBvcnQgaXMgaWdub3JlZCwgcmV0dXJuIGV4cGxpY2l0ICdudWxsJ1xuICAgICAgaWYgKGltcG9ydGVkID09IG51bGwpIHJldHVybiB7IGZvdW5kOiB0cnVlLCBwYXRoOiBbdGhpc10gfVxuXG4gICAgICAvLyBzYWZlZ3VhcmQgYWdhaW5zdCBjeWNsZXMsIG9ubHkgaWYgbmFtZSBtYXRjaGVzXG4gICAgICBpZiAoaW1wb3J0ZWQucGF0aCA9PT0gdGhpcy5wYXRoICYmIHJlZXhwb3J0cy5sb2NhbCA9PT0gbmFtZSkge1xuICAgICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHBhdGg6IFt0aGlzXSB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRlZXAgPSBpbXBvcnRlZC5oYXNEZWVwKHJlZXhwb3J0cy5sb2NhbClcbiAgICAgIGRlZXAucGF0aC51bnNoaWZ0KHRoaXMpXG5cbiAgICAgIHJldHVybiBkZWVwXG4gICAgfVxuXG5cbiAgICAvLyBkZWZhdWx0IGV4cG9ydHMgbXVzdCBiZSBleHBsaWNpdGx5IHJlLWV4cG9ydGVkICgjMzI4KVxuICAgIGlmIChuYW1lICE9PSAnZGVmYXVsdCcpIHtcbiAgICAgIGZvciAobGV0IGRlcCBvZiB0aGlzLmRlcGVuZGVuY2llcykge1xuICAgICAgICBsZXQgaW5uZXJNYXAgPSBkZXAoKVxuICAgICAgICAvLyB0b2RvOiByZXBvcnQgYXMgdW5yZXNvbHZlZD9cbiAgICAgICAgaWYgKCFpbm5lck1hcCkgY29udGludWVcblxuICAgICAgICAvLyBzYWZlZ3VhcmQgYWdhaW5zdCBjeWNsZXNcbiAgICAgICAgaWYgKGlubmVyTWFwLnBhdGggPT09IHRoaXMucGF0aCkgY29udGludWVcblxuICAgICAgICBsZXQgaW5uZXJWYWx1ZSA9IGlubmVyTWFwLmhhc0RlZXAobmFtZSlcbiAgICAgICAgaWYgKGlubmVyVmFsdWUuZm91bmQpIHtcbiAgICAgICAgICBpbm5lclZhbHVlLnBhdGgudW5zaGlmdCh0aGlzKVxuICAgICAgICAgIHJldHVybiBpbm5lclZhbHVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHBhdGg6IFt0aGlzXSB9XG4gIH1cblxuICBnZXQobmFtZSkge1xuICAgIGlmICh0aGlzLm5hbWVzcGFjZS5oYXMobmFtZSkpIHJldHVybiB0aGlzLm5hbWVzcGFjZS5nZXQobmFtZSlcblxuICAgIGlmICh0aGlzLnJlZXhwb3J0cy5oYXMobmFtZSkpIHtcbiAgICAgIGNvbnN0IHJlZXhwb3J0cyA9IHRoaXMucmVleHBvcnRzLmdldChuYW1lKVxuICAgICAgICAgICwgaW1wb3J0ZWQgPSByZWV4cG9ydHMuZ2V0SW1wb3J0KClcblxuICAgICAgLy8gaWYgaW1wb3J0IGlzIGlnbm9yZWQsIHJldHVybiBleHBsaWNpdCAnbnVsbCdcbiAgICAgIGlmIChpbXBvcnRlZCA9PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gICAgICAvLyBzYWZlZ3VhcmQgYWdhaW5zdCBjeWNsZXMsIG9ubHkgaWYgbmFtZSBtYXRjaGVzXG4gICAgICBpZiAoaW1wb3J0ZWQucGF0aCA9PT0gdGhpcy5wYXRoICYmIHJlZXhwb3J0cy5sb2NhbCA9PT0gbmFtZSkgcmV0dXJuIHVuZGVmaW5lZFxuXG4gICAgICByZXR1cm4gaW1wb3J0ZWQuZ2V0KHJlZXhwb3J0cy5sb2NhbClcbiAgICB9XG5cbiAgICAvLyBkZWZhdWx0IGV4cG9ydHMgbXVzdCBiZSBleHBsaWNpdGx5IHJlLWV4cG9ydGVkICgjMzI4KVxuICAgIGlmIChuYW1lICE9PSAnZGVmYXVsdCcpIHtcbiAgICAgIGZvciAobGV0IGRlcCBvZiB0aGlzLmRlcGVuZGVuY2llcykge1xuICAgICAgICBsZXQgaW5uZXJNYXAgPSBkZXAoKVxuICAgICAgICAvLyB0b2RvOiByZXBvcnQgYXMgdW5yZXNvbHZlZD9cbiAgICAgICAgaWYgKCFpbm5lck1hcCkgY29udGludWVcblxuICAgICAgICAvLyBzYWZlZ3VhcmQgYWdhaW5zdCBjeWNsZXNcbiAgICAgICAgaWYgKGlubmVyTWFwLnBhdGggPT09IHRoaXMucGF0aCkgY29udGludWVcblxuICAgICAgICBsZXQgaW5uZXJWYWx1ZSA9IGlubmVyTWFwLmdldChuYW1lKVxuICAgICAgICBpZiAoaW5uZXJWYWx1ZSAhPT0gdW5kZWZpbmVkKSByZXR1cm4gaW5uZXJWYWx1ZVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxuXG4gIGZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB0aGlzLm5hbWVzcGFjZS5mb3JFYWNoKCh2LCBuKSA9PlxuICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB2LCBuLCB0aGlzKSlcblxuICAgIHRoaXMucmVleHBvcnRzLmZvckVhY2goKHJlZXhwb3J0cywgbmFtZSkgPT4ge1xuICAgICAgY29uc3QgcmVleHBvcnRlZCA9IHJlZXhwb3J0cy5nZXRJbXBvcnQoKVxuICAgICAgLy8gY2FuJ3QgbG9vayB1cCBtZXRhIGZvciBpZ25vcmVkIHJlLWV4cG9ydHMgKCMzNDgpXG4gICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHJlZXhwb3J0ZWQgJiYgcmVleHBvcnRlZC5nZXQocmVleHBvcnRzLmxvY2FsKSwgbmFtZSwgdGhpcylcbiAgICB9KVxuXG4gICAgdGhpcy5kZXBlbmRlbmNpZXMuZm9yRWFjaChkZXAgPT4ge1xuICAgICAgY29uc3QgZCA9IGRlcCgpXG4gICAgICAvLyBDSlMgLyBpZ25vcmVkIGRlcGVuZGVuY2llcyB3b24ndCBleGlzdCAoIzcxNylcbiAgICAgIGlmIChkID09IG51bGwpIHJldHVyblxuXG4gICAgICBkLmZvckVhY2goKHYsIG4pID0+XG4gICAgICAgIG4gIT09ICdkZWZhdWx0JyAmJiBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHYsIG4sIHRoaXMpKVxuICAgIH0pXG4gIH1cblxuICAvLyB0b2RvOiBrZXlzLCB2YWx1ZXMsIGVudHJpZXM/XG5cbiAgcmVwb3J0RXJyb3JzKGNvbnRleHQsIGRlY2xhcmF0aW9uKSB7XG4gICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgbm9kZTogZGVjbGFyYXRpb24uc291cmNlLFxuICAgICAgbWVzc2FnZTogYFBhcnNlIGVycm9ycyBpbiBpbXBvcnRlZCBtb2R1bGUgJyR7ZGVjbGFyYXRpb24uc291cmNlLnZhbHVlfSc6IGAgK1xuICAgICAgICAgICAgICAgICAgYCR7dGhpcy5lcnJvcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoZSA9PiBgJHtlLm1lc3NhZ2V9ICgke2UubGluZU51bWJlcn06JHtlLmNvbHVtbn0pYClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcsICcpfWAsXG4gICAgfSlcbiAgfVxufVxuXG4vKipcbiAqIHBhcnNlIGRvY3MgZnJvbSB0aGUgZmlyc3Qgbm9kZSB0aGF0IGhhcyBsZWFkaW5nIGNvbW1lbnRzXG4gKiBAcGFyYW0gIHsuLi5bdHlwZV19IG5vZGVzIFtkZXNjcmlwdGlvbl1cbiAqIEByZXR1cm4ge3tkb2M6IG9iamVjdH19XG4gKi9cbmZ1bmN0aW9uIGNhcHR1cmVEb2MoZG9jU3R5bGVQYXJzZXJzKSB7XG4gIGNvbnN0IG1ldGFkYXRhID0ge31cbiAgICAgICAsIG5vZGVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKVxuXG4gIC8vICdzb21lJyBzaG9ydC1jaXJjdWl0cyBvbiBmaXJzdCAndHJ1ZSdcbiAgbm9kZXMuc29tZShuID0+IHtcbiAgICBpZiAoIW4ubGVhZGluZ0NvbW1lbnRzKSByZXR1cm4gZmFsc2VcblxuICAgIGZvciAobGV0IG5hbWUgaW4gZG9jU3R5bGVQYXJzZXJzKSB7XG4gICAgICBjb25zdCBkb2MgPSBkb2NTdHlsZVBhcnNlcnNbbmFtZV0obi5sZWFkaW5nQ29tbWVudHMpXG4gICAgICBpZiAoZG9jKSB7XG4gICAgICAgIG1ldGFkYXRhLmRvYyA9IGRvY1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlXG4gIH0pXG5cbiAgcmV0dXJuIG1ldGFkYXRhXG59XG5cbmNvbnN0IGF2YWlsYWJsZURvY1N0eWxlUGFyc2VycyA9IHtcbiAganNkb2M6IGNhcHR1cmVKc0RvYyxcbiAgdG9tZG9jOiBjYXB0dXJlVG9tRG9jLFxufVxuXG4vKipcbiAqIHBhcnNlIEpTRG9jIGZyb20gbGVhZGluZyBjb21tZW50c1xuICogQHBhcmFtICB7Li4uW3R5cGVdfSBjb21tZW50cyBbZGVzY3JpcHRpb25dXG4gKiBAcmV0dXJuIHt7ZG9jOiBvYmplY3R9fVxuICovXG5mdW5jdGlvbiBjYXB0dXJlSnNEb2MoY29tbWVudHMpIHtcbiAgbGV0IGRvY1xuXG4gIC8vIGNhcHR1cmUgWFNEb2NcbiAgY29tbWVudHMuZm9yRWFjaChjb21tZW50ID0+IHtcbiAgICAvLyBza2lwIG5vbi1ibG9jayBjb21tZW50c1xuICAgIGlmIChjb21tZW50LnZhbHVlLnNsaWNlKDAsIDQpICE9PSAnKlxcbiAqJykgcmV0dXJuXG4gICAgdHJ5IHtcbiAgICAgIGRvYyA9IGRvY3RyaW5lLnBhcnNlKGNvbW1lbnQudmFsdWUsIHsgdW53cmFwOiB0cnVlIH0pXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvKiBkb24ndCBjYXJlLCBmb3Igbm93PyBtYXliZSBhZGQgdG8gYGVycm9ycz9gICovXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBkb2Ncbn1cblxuLyoqXG4gICogcGFyc2UgVG9tRG9jIHNlY3Rpb24gZnJvbSBjb21tZW50c1xuICAqL1xuZnVuY3Rpb24gY2FwdHVyZVRvbURvYyhjb21tZW50cykge1xuICAvLyBjb2xsZWN0IGxpbmVzIHVwIHRvIGZpcnN0IHBhcmFncmFwaCBicmVha1xuICBjb25zdCBsaW5lcyA9IFtdXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY29tbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjb21tZW50ID0gY29tbWVudHNbaV1cbiAgICBpZiAoY29tbWVudC52YWx1ZS5tYXRjaCgvXlxccyokLykpIGJyZWFrXG4gICAgbGluZXMucHVzaChjb21tZW50LnZhbHVlLnRyaW0oKSlcbiAgfVxuXG4gIC8vIHJldHVybiBkb2N0cmluZS1saWtlIG9iamVjdFxuICBjb25zdCBzdGF0dXNNYXRjaCA9IGxpbmVzLmpvaW4oJyAnKS5tYXRjaCgvXihQdWJsaWN8SW50ZXJuYWx8RGVwcmVjYXRlZCk6XFxzKiguKykvKVxuICBpZiAoc3RhdHVzTWF0Y2gpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGVzY3JpcHRpb246IHN0YXR1c01hdGNoWzJdLFxuICAgICAgdGFnczogW3tcbiAgICAgICAgdGl0bGU6IHN0YXR1c01hdGNoWzFdLnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBzdGF0dXNNYXRjaFsyXSxcbiAgICAgIH1dLFxuICAgIH1cbiAgfVxufVxuXG5FeHBvcnRNYXAuZ2V0ID0gZnVuY3Rpb24gKHNvdXJjZSwgY29udGV4dCkge1xuICBjb25zdCBwYXRoID0gcmVzb2x2ZShzb3VyY2UsIGNvbnRleHQpXG4gIGlmIChwYXRoID09IG51bGwpIHJldHVybiBudWxsXG5cbiAgcmV0dXJuIEV4cG9ydE1hcC5mb3IoY2hpbGRDb250ZXh0KHBhdGgsIGNvbnRleHQpKVxufVxuXG5FeHBvcnRNYXAuZm9yID0gZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgY29uc3QgeyBwYXRoIH0gPSBjb250ZXh0XG5cbiAgY29uc3QgY2FjaGVLZXkgPSBoYXNoT2JqZWN0KGNvbnRleHQpLmRpZ2VzdCgnaGV4JylcbiAgbGV0IGV4cG9ydE1hcCA9IGV4cG9ydENhY2hlLmdldChjYWNoZUtleSlcblxuICAvLyByZXR1cm4gY2FjaGVkIGlnbm9yZVxuICBpZiAoZXhwb3J0TWFwID09PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMocGF0aClcbiAgaWYgKGV4cG9ydE1hcCAhPSBudWxsKSB7XG4gICAgLy8gZGF0ZSBlcXVhbGl0eSBjaGVja1xuICAgIGlmIChleHBvcnRNYXAubXRpbWUgLSBzdGF0cy5tdGltZSA9PT0gMCkge1xuICAgICAgcmV0dXJuIGV4cG9ydE1hcFxuICAgIH1cbiAgICAvLyBmdXR1cmU6IGNoZWNrIGNvbnRlbnQgZXF1YWxpdHk/XG4gIH1cblxuICAvLyBjaGVjayB2YWxpZCBleHRlbnNpb25zIGZpcnN0XG4gIGlmICghaGFzVmFsaWRFeHRlbnNpb24ocGF0aCwgY29udGV4dCkpIHtcbiAgICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIG51bGwpXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMocGF0aCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pXG5cbiAgLy8gY2hlY2sgZm9yIGFuZCBjYWNoZSBpZ25vcmVcbiAgaWYgKGlzSWdub3JlZChwYXRoLCBjb250ZXh0KSB8fCAhdW5hbWJpZ3VvdXMudGVzdChjb250ZW50KSkge1xuICAgIGxvZygnaWdub3JlZCBwYXRoIGR1ZSB0byB1bmFtYmlndW91cyByZWdleCBvciBpZ25vcmUgc2V0dGluZ3M6JywgcGF0aClcbiAgICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIG51bGwpXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGxvZygnY2FjaGUgbWlzcycsIGNhY2hlS2V5LCAnZm9yIHBhdGgnLCBwYXRoKVxuICBleHBvcnRNYXAgPSBFeHBvcnRNYXAucGFyc2UocGF0aCwgY29udGVudCwgY29udGV4dClcblxuICAvLyBhbWJpZ3VvdXMgbW9kdWxlcyByZXR1cm4gbnVsbFxuICBpZiAoZXhwb3J0TWFwID09IG51bGwpIHJldHVybiBudWxsXG5cbiAgZXhwb3J0TWFwLm10aW1lID0gc3RhdHMubXRpbWVcblxuICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIGV4cG9ydE1hcClcbiAgcmV0dXJuIGV4cG9ydE1hcFxufVxuXG5cbkV4cG9ydE1hcC5wYXJzZSA9IGZ1bmN0aW9uIChwYXRoLCBjb250ZW50LCBjb250ZXh0KSB7XG4gIHZhciBtID0gbmV3IEV4cG9ydE1hcChwYXRoKVxuXG4gIHRyeSB7XG4gICAgdmFyIGFzdCA9IHBhcnNlKHBhdGgsIGNvbnRlbnQsIGNvbnRleHQpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGxvZygncGFyc2UgZXJyb3I6JywgcGF0aCwgZXJyKVxuICAgIG0uZXJyb3JzLnB1c2goZXJyKVxuICAgIHJldHVybiBtIC8vIGNhbid0IGNvbnRpbnVlXG4gIH1cblxuICBpZiAoIXVuYW1iaWd1b3VzLmlzTW9kdWxlKGFzdCkpIHJldHVybiBudWxsXG5cbiAgY29uc3QgZG9jc3R5bGUgPSAoY29udGV4dC5zZXR0aW5ncyAmJiBjb250ZXh0LnNldHRpbmdzWydpbXBvcnQvZG9jc3R5bGUnXSkgfHwgWydqc2RvYyddXG4gIGNvbnN0IGRvY1N0eWxlUGFyc2VycyA9IHt9XG4gIGRvY3N0eWxlLmZvckVhY2goc3R5bGUgPT4ge1xuICAgIGRvY1N0eWxlUGFyc2Vyc1tzdHlsZV0gPSBhdmFpbGFibGVEb2NTdHlsZVBhcnNlcnNbc3R5bGVdXG4gIH0pXG5cbiAgLy8gYXR0ZW1wdCB0byBjb2xsZWN0IG1vZHVsZSBkb2NcbiAgaWYgKGFzdC5jb21tZW50cykge1xuICAgIGFzdC5jb21tZW50cy5zb21lKGMgPT4ge1xuICAgICAgaWYgKGMudHlwZSAhPT0gJ0Jsb2NrJykgcmV0dXJuIGZhbHNlXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBkb2MgPSBkb2N0cmluZS5wYXJzZShjLnZhbHVlLCB7IHVud3JhcDogdHJ1ZSB9KVxuICAgICAgICBpZiAoZG9jLnRhZ3Muc29tZSh0ID0+IHQudGl0bGUgPT09ICdtb2R1bGUnKSkge1xuICAgICAgICAgIG0uZG9jID0gZG9jXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9KVxuICB9XG5cbiAgY29uc3QgbmFtZXNwYWNlcyA9IG5ldyBNYXAoKVxuXG4gIGZ1bmN0aW9uIHJlbW90ZVBhdGgodmFsdWUpIHtcbiAgICByZXR1cm4gcmVzb2x2ZS5yZWxhdGl2ZSh2YWx1ZSwgcGF0aCwgY29udGV4dC5zZXR0aW5ncylcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc29sdmVJbXBvcnQodmFsdWUpIHtcbiAgICBjb25zdCBycCA9IHJlbW90ZVBhdGgodmFsdWUpXG4gICAgaWYgKHJwID09IG51bGwpIHJldHVybiBudWxsXG4gICAgcmV0dXJuIEV4cG9ydE1hcC5mb3IoY2hpbGRDb250ZXh0KHJwLCBjb250ZXh0KSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldE5hbWVzcGFjZShpZGVudGlmaWVyKSB7XG4gICAgaWYgKCFuYW1lc3BhY2VzLmhhcyhpZGVudGlmaWVyLm5hbWUpKSByZXR1cm5cblxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZUltcG9ydChuYW1lc3BhY2VzLmdldChpZGVudGlmaWVyLm5hbWUpKVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZE5hbWVzcGFjZShvYmplY3QsIGlkZW50aWZpZXIpIHtcbiAgICBjb25zdCBuc2ZuID0gZ2V0TmFtZXNwYWNlKGlkZW50aWZpZXIpXG4gICAgaWYgKG5zZm4pIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3QsICduYW1lc3BhY2UnLCB7IGdldDogbnNmbiB9KVxuICAgIH1cblxuICAgIHJldHVybiBvYmplY3RcbiAgfVxuXG4gIGZ1bmN0aW9uIGNhcHR1cmVEZXBlbmRlbmN5KGRlY2xhcmF0aW9uKSB7XG4gICAgaWYgKGRlY2xhcmF0aW9uLnNvdXJjZSA9PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gICAgY29uc3QgcCA9IHJlbW90ZVBhdGgoZGVjbGFyYXRpb24uc291cmNlLnZhbHVlKVxuICAgIGlmIChwID09IG51bGwpIHJldHVybiBudWxsXG4gICAgY29uc3QgZXhpc3RpbmcgPSBtLmltcG9ydHMuZ2V0KHApXG4gICAgaWYgKGV4aXN0aW5nICE9IG51bGwpIHJldHVybiBleGlzdGluZy5nZXR0ZXJcblxuICAgIGNvbnN0IGdldHRlciA9ICgpID0+IEV4cG9ydE1hcC5mb3IoY2hpbGRDb250ZXh0KHAsIGNvbnRleHQpKVxuICAgIG0uaW1wb3J0cy5zZXQocCwge1xuICAgICAgZ2V0dGVyLFxuICAgICAgc291cmNlOiB7ICAvLyBjYXB0dXJpbmcgYWN0dWFsIG5vZGUgcmVmZXJlbmNlIGhvbGRzIGZ1bGwgQVNUIGluIG1lbW9yeSFcbiAgICAgICAgdmFsdWU6IGRlY2xhcmF0aW9uLnNvdXJjZS52YWx1ZSxcbiAgICAgICAgbG9jOiBkZWNsYXJhdGlvbi5zb3VyY2UubG9jLFxuICAgICAgfSxcbiAgICB9KVxuICAgIHJldHVybiBnZXR0ZXJcbiAgfVxuXG5cbiAgYXN0LmJvZHkuZm9yRWFjaChmdW5jdGlvbiAobikge1xuXG4gICAgaWYgKG4udHlwZSA9PT0gJ0V4cG9ydERlZmF1bHREZWNsYXJhdGlvbicpIHtcbiAgICAgIGNvbnN0IGV4cG9ydE1ldGEgPSBjYXB0dXJlRG9jKGRvY1N0eWxlUGFyc2VycywgbilcbiAgICAgIGlmIChuLmRlY2xhcmF0aW9uLnR5cGUgPT09ICdJZGVudGlmaWVyJykge1xuICAgICAgICBhZGROYW1lc3BhY2UoZXhwb3J0TWV0YSwgbi5kZWNsYXJhdGlvbilcbiAgICAgIH1cbiAgICAgIG0ubmFtZXNwYWNlLnNldCgnZGVmYXVsdCcsIGV4cG9ydE1ldGEpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAobi50eXBlID09PSAnRXhwb3J0QWxsRGVjbGFyYXRpb24nKSB7XG4gICAgICBjb25zdCBnZXR0ZXIgPSBjYXB0dXJlRGVwZW5kZW5jeShuKVxuICAgICAgaWYgKGdldHRlcikgbS5kZXBlbmRlbmNpZXMuYWRkKGdldHRlcilcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIGNhcHR1cmUgbmFtZXNwYWNlcyBpbiBjYXNlIG9mIGxhdGVyIGV4cG9ydFxuICAgIGlmIChuLnR5cGUgPT09ICdJbXBvcnREZWNsYXJhdGlvbicpIHtcbiAgICAgIGNhcHR1cmVEZXBlbmRlbmN5KG4pXG4gICAgICBsZXQgbnNcbiAgICAgIGlmIChuLnNwZWNpZmllcnMuc29tZShzID0+IHMudHlwZSA9PT0gJ0ltcG9ydE5hbWVzcGFjZVNwZWNpZmllcicgJiYgKG5zID0gcykpKSB7XG4gICAgICAgIG5hbWVzcGFjZXMuc2V0KG5zLmxvY2FsLm5hbWUsIG4uc291cmNlLnZhbHVlKVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKG4udHlwZSA9PT0gJ0V4cG9ydE5hbWVkRGVjbGFyYXRpb24nKSB7XG4gICAgICAvLyBjYXB0dXJlIGRlY2xhcmF0aW9uXG4gICAgICBpZiAobi5kZWNsYXJhdGlvbiAhPSBudWxsKSB7XG4gICAgICAgIHN3aXRjaCAobi5kZWNsYXJhdGlvbi50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnRnVuY3Rpb25EZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnQ2xhc3NEZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnVHlwZUFsaWFzJzogLy8gZmxvd3R5cGUgd2l0aCBiYWJlbC1lc2xpbnQgcGFyc2VyXG4gICAgICAgICAgY2FzZSAnSW50ZXJmYWNlRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ1RTRW51bURlY2xhcmF0aW9uJzpcbiAgICAgICAgICBjYXNlICdUU0ludGVyZmFjZURlY2xhcmF0aW9uJzpcbiAgICAgICAgICBjYXNlICdUU0Fic3RyYWN0Q2xhc3NEZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnVFNNb2R1bGVEZWNsYXJhdGlvbic6XG4gICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQobi5kZWNsYXJhdGlvbi5pZC5uYW1lLCBjYXB0dXJlRG9jKGRvY1N0eWxlUGFyc2VycywgbikpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ1ZhcmlhYmxlRGVjbGFyYXRpb24nOlxuICAgICAgICAgICAgbi5kZWNsYXJhdGlvbi5kZWNsYXJhdGlvbnMuZm9yRWFjaCgoZCkgPT5cbiAgICAgICAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUoZC5pZCxcbiAgICAgICAgICAgICAgICBpZCA9PiBtLm5hbWVzcGFjZS5zZXQoaWQubmFtZSwgY2FwdHVyZURvYyhkb2NTdHlsZVBhcnNlcnMsIGQsIG4pKSkpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG5zb3VyY2UgPSBuLnNvdXJjZSAmJiBuLnNvdXJjZS52YWx1ZVxuICAgICAgbi5zcGVjaWZpZXJzLmZvckVhY2goKHMpID0+IHtcbiAgICAgICAgY29uc3QgZXhwb3J0TWV0YSA9IHt9XG4gICAgICAgIGxldCBsb2NhbFxuXG4gICAgICAgIHN3aXRjaCAocy50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnRXhwb3J0RGVmYXVsdFNwZWNpZmllcic6XG4gICAgICAgICAgICBpZiAoIW4uc291cmNlKSByZXR1cm5cbiAgICAgICAgICAgIGxvY2FsID0gJ2RlZmF1bHQnXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ0V4cG9ydE5hbWVzcGFjZVNwZWNpZmllcic6XG4gICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQocy5leHBvcnRlZC5uYW1lLCBPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0TWV0YSwgJ25hbWVzcGFjZScsIHtcbiAgICAgICAgICAgICAgZ2V0KCkgeyByZXR1cm4gcmVzb2x2ZUltcG9ydChuc291cmNlKSB9LFxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICBjYXNlICdFeHBvcnRTcGVjaWZpZXInOlxuICAgICAgICAgICAgaWYgKCFuLnNvdXJjZSkge1xuICAgICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQocy5leHBvcnRlZC5uYW1lLCBhZGROYW1lc3BhY2UoZXhwb3J0TWV0YSwgcy5sb2NhbCkpXG4gICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gZWxzZSBmYWxscyB0aHJvdWdoXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGxvY2FsID0gcy5sb2NhbC5uYW1lXG4gICAgICAgICAgICBicmVha1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdG9kbzogSlNEb2NcbiAgICAgICAgbS5yZWV4cG9ydHMuc2V0KHMuZXhwb3J0ZWQubmFtZSwgeyBsb2NhbCwgZ2V0SW1wb3J0OiAoKSA9PiByZXNvbHZlSW1wb3J0KG5zb3VyY2UpIH0pXG4gICAgICB9KVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gbVxufVxuXG5cbi8qKlxuICogVHJhdmVyc2UgYSBwYXR0ZXJuL2lkZW50aWZpZXIgbm9kZSwgY2FsbGluZyAnY2FsbGJhY2snXG4gKiBmb3IgZWFjaCBsZWFmIGlkZW50aWZpZXIuXG4gKiBAcGFyYW0gIHtub2RlfSAgIHBhdHRlcm5cbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7dm9pZH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlY3Vyc2l2ZVBhdHRlcm5DYXB0dXJlKHBhdHRlcm4sIGNhbGxiYWNrKSB7XG4gIHN3aXRjaCAocGF0dGVybi50eXBlKSB7XG4gICAgY2FzZSAnSWRlbnRpZmllcic6IC8vIGJhc2UgY2FzZVxuICAgICAgY2FsbGJhY2socGF0dGVybilcbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlICdPYmplY3RQYXR0ZXJuJzpcbiAgICAgIHBhdHRlcm4ucHJvcGVydGllcy5mb3JFYWNoKHAgPT4ge1xuICAgICAgICByZWN1cnNpdmVQYXR0ZXJuQ2FwdHVyZShwLnZhbHVlLCBjYWxsYmFjaylcbiAgICAgIH0pXG4gICAgICBicmVha1xuXG4gICAgY2FzZSAnQXJyYXlQYXR0ZXJuJzpcbiAgICAgIHBhdHRlcm4uZWxlbWVudHMuZm9yRWFjaCgoZWxlbWVudCkgPT4ge1xuICAgICAgICBpZiAoZWxlbWVudCA9PSBudWxsKSByZXR1cm5cbiAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUoZWxlbWVudCwgY2FsbGJhY2spXG4gICAgICB9KVxuICAgICAgYnJlYWtcbiAgfVxufVxuXG4vKipcbiAqIGRvbid0IGhvbGQgZnVsbCBjb250ZXh0IG9iamVjdCBpbiBtZW1vcnksIGp1c3QgZ3JhYiB3aGF0IHdlIG5lZWQuXG4gKi9cbmZ1bmN0aW9uIGNoaWxkQ29udGV4dChwYXRoLCBjb250ZXh0KSB7XG4gIGNvbnN0IHsgc2V0dGluZ3MsIHBhcnNlck9wdGlvbnMsIHBhcnNlclBhdGggfSA9IGNvbnRleHRcbiAgcmV0dXJuIHtcbiAgICBzZXR0aW5ncyxcbiAgICBwYXJzZXJPcHRpb25zLFxuICAgIHBhcnNlclBhdGgsXG4gICAgcGF0aCxcbiAgfVxufVxuIl19