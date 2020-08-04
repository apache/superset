"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.helper = helper;

var t = _interopRequireWildcard(require("@babel/types"));

var _helperModuleImports = require("@babel/helper-module-imports");

var _helperAnnotateAsPure = _interopRequireDefault(require("@babel/helper-annotate-as-pure"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const DEFAULT = {
  importSource: "react",
  runtime: "automatic",
  pragma: "React.createElement",
  pragmaFrag: "React.Fragment"
};

function helper(babel, options) {
  const FILE_NAME_VAR = "_jsxFileName";
  const JSX_SOURCE_ANNOTATION_REGEX = /\*?\s*@jsxImportSource\s+([^\s]+)/;
  const JSX_RUNTIME_ANNOTATION_REGEX = /\*?\s*@jsxRuntime\s+([^\s]+)/;
  const JSX_ANNOTATION_REGEX = /\*?\s*@jsx\s+([^\s]+)/;
  const JSX_FRAG_ANNOTATION_REGEX = /\*?\s*@jsxFrag\s+([^\s]+)/;
  const IMPORT_NAME_SIZE = options.development ? 3 : 4;
  const {
    importSource: IMPORT_SOURCE_DEFAULT = DEFAULT.importSource,
    runtime: RUNTIME_DEFAULT = DEFAULT.runtime,
    pragma: PRAGMA_DEFAULT = DEFAULT.pragma,
    pragmaFrag: PRAGMA_FRAG_DEFAULT = DEFAULT.pragmaFrag
  } = options;
  const injectMetaPropertiesVisitor = {
    JSXOpeningElement(path, state) {
      for (const attr of path.get("attributes")) {
        if (!attr.isJSXElement()) continue;
        const {
          name
        } = attr.node.name;

        if (name === "__source" || name === "__self") {
          throw path.buildCodeFrameError(`__source and __self should not be defined in props and are reserved for internal usage.`);
        }
      }

      const source = t.jsxAttribute(t.jsxIdentifier("__source"), t.jsxExpressionContainer(makeSource(path, state)));
      const self = t.jsxAttribute(t.jsxIdentifier("__self"), t.jsxExpressionContainer(t.thisExpression()));
      path.pushContainer("attributes", [source, self]);
    }

  };
  return {
    JSXNamespacedName(path, state) {
      const throwIfNamespace = state.opts.throwIfNamespace === undefined ? true : !!state.opts.throwIfNamespace;

      if (throwIfNamespace) {
        throw path.buildCodeFrameError(`Namespace tags are not supported by default. React's JSX doesn't support namespace tags. \
You can set \`throwIfNamespace: false\` to bypass this warning.`);
      }
    },

    JSXSpreadChild(path) {
      throw path.buildCodeFrameError("Spread children are not supported in React.");
    },

    JSXElement: {
      exit(path, file) {
        let callExpr;

        if (file.get("@babel/plugin-react-jsx/runtime") === "classic" || shouldUseCreateElement(path)) {
          callExpr = buildCreateElementCall(path, file);
        } else {
          callExpr = buildJSXElementCall(path, file);
        }

        path.replaceWith(t.inherits(callExpr, path.node));
      }

    },
    JSXFragment: {
      exit(path, file) {
        let callExpr;

        if (file.get("@babel/plugin-react-jsx/runtime") === "classic") {
          callExpr = buildCreateElementFragmentCall(path, file);
        } else {
          callExpr = buildJSXFragmentCall(path, file);
        }

        path.replaceWith(t.inherits(callExpr, path.node));
      }

    },

    JSXAttribute(path) {
      if (t.isJSXElement(path.node.value)) {
        path.node.value = t.jsxExpressionContainer(path.node.value);
      }
    },

    Program: {
      enter(path, state) {
        if (hasJSX(path)) {
          const {
            file
          } = state;
          let runtime = RUNTIME_DEFAULT;
          let source = IMPORT_SOURCE_DEFAULT;
          let sourceSet = !!options.importSource;
          let pragma = PRAGMA_DEFAULT;
          let pragmaFrag = PRAGMA_FRAG_DEFAULT;
          let pragmaSet = !!options.pragma;
          let pragmaFragSet = !!options.pragmaFrag;

          if (file.ast.comments) {
            for (const comment of file.ast.comments) {
              const sourceMatches = JSX_SOURCE_ANNOTATION_REGEX.exec(comment.value);

              if (sourceMatches) {
                source = sourceMatches[1];
                sourceSet = true;
              }

              const runtimeMatches = JSX_RUNTIME_ANNOTATION_REGEX.exec(comment.value);

              if (runtimeMatches) {
                runtime = runtimeMatches[1];
              }

              const jsxMatches = JSX_ANNOTATION_REGEX.exec(comment.value);

              if (jsxMatches) {
                pragma = jsxMatches[1];
                pragmaSet = true;
              }

              const jsxFragMatches = JSX_FRAG_ANNOTATION_REGEX.exec(comment.value);

              if (jsxFragMatches) {
                pragmaFrag = jsxFragMatches[1];
                pragmaFragSet = true;
              }
            }
          }

          state.set("@babel/plugin-react-jsx/runtime", runtime);

          if (runtime === "classic") {
            if (sourceSet) {
              throw path.buildCodeFrameError(`importSource cannot be set when runtime is classic.`);
            }

            state.set("@babel/plugin-react-jsx/createElementIdentifier", createIdentifierParser(pragma));
            state.set("@babel/plugin-react-jsx/jsxFragIdentifier", createIdentifierParser(pragmaFrag));
            state.set("@babel/plugin-react-jsx/usedFragment", false);
            state.set("@babel/plugin-react-jsx/pragmaSet", pragma !== DEFAULT.pragma);
            state.set("@babel/plugin-react-jsx/pragmaFragSet", pragmaFrag !== DEFAULT.pragmaFrag);
          } else if (runtime === "automatic") {
            if (pragmaSet || pragmaFragSet) {
              throw path.buildCodeFrameError(`pragma and pragmaFrag cannot be set when runtime is automatic.`);
            }

            const importName = addAutoImports(path, Object.assign(Object.assign({}, state.opts), {}, {
              source
            }));
            state.set("@babel/plugin-react-jsx/jsxIdentifier", createIdentifierParser(createIdentifierName(path, options.development ? "jsxDEV" : "jsx", importName)));
            state.set("@babel/plugin-react-jsx/jsxStaticIdentifier", createIdentifierParser(createIdentifierName(path, options.development ? "jsxDEV" : "jsxs", importName)));
            state.set("@babel/plugin-react-jsx/createElementIdentifier", createIdentifierParser(createIdentifierName(path, "createElement", importName)));
            state.set("@babel/plugin-react-jsx/jsxFragIdentifier", createIdentifierParser(createIdentifierName(path, "Fragment", importName)));
            state.set("@babel/plugin-react-jsx/importSourceSet", source !== DEFAULT.importSource);
          } else {
            throw path.buildCodeFrameError(`Runtime must be either "classic" or "automatic".`);
          }

          if (options.development) {
            path.traverse(injectMetaPropertiesVisitor, state);
          }
        }
      },

      exit(path, state) {
        if (state.get("@babel/plugin-react-jsx/runtime") === "classic" && state.get("@babel/plugin-react-jsx/pragmaSet") && state.get("@babel/plugin-react-jsx/usedFragment") && !state.get("@babel/plugin-react-jsx/pragmaFragSet")) {
          throw new Error("transform-react-jsx: pragma has been set but " + "pragmaFrag has not been set");
        }
      }

    }
  };

  function shouldUseCreateElement(path) {
    const openingPath = path.get("openingElement");
    const attributes = openingPath.node.attributes;
    let seenPropsSpread = false;

    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];

      if (seenPropsSpread && t.isJSXAttribute(attr) && attr.name.name === "key") {
        return true;
      } else if (t.isJSXSpreadAttribute(attr)) {
        seenPropsSpread = true;
      }
    }

    return false;
  }

  function createIdentifierName(path, name, importName) {
    if ((0, _helperModuleImports.isModule)(path)) {
      const identifierName = `${importName[name]}`;
      return identifierName;
    } else {
      return `${importName[name]}.${name}`;
    }
  }

  function getImportNames(parentPath) {
    const imports = new Set();
    parentPath.traverse({
      "JSXElement|JSXFragment"(path) {
        if (path.type === "JSXFragment") imports.add("Fragment");
        const openingPath = path.get("openingElement");
        const validChildren = t.react.buildChildren(openingPath.parent);
        let importName;

        if (path.type === "JSXElement" && shouldUseCreateElement(path)) {
          importName = "createElement";
        } else if (options.development) {
          importName = "jsxDEV";
        } else if (validChildren.length > 1) {
          importName = "jsxs";
        } else {
          importName = "jsx";
        }

        imports.add(importName);

        if (imports.size === IMPORT_NAME_SIZE) {
          path.stop();
        }
      }

    });
    return imports;
  }

  function hasJSX(parentPath) {
    let fileHasJSX = false;
    parentPath.traverse({
      "JSXElement|JSXFragment"(path) {
        fileHasJSX = true;
        path.stop();
      }

    });
    return fileHasJSX;
  }

  function getSource(source, importName) {
    switch (importName) {
      case "Fragment":
        return `${source}/${options.development ? "jsx-dev-runtime" : "jsx-runtime"}`;

      case "jsxDEV":
        return `${source}/jsx-dev-runtime`;

      case "jsx":
      case "jsxs":
        return `${source}/jsx-runtime`;

      case "createElement":
        return source;
    }
  }

  function addAutoImports(path, state) {
    const imports = getImportNames(path, state);

    if ((0, _helperModuleImports.isModule)(path)) {
      const importMap = {};
      imports.forEach(importName => {
        if (!importMap[importName]) {
          importMap[importName] = (0, _helperModuleImports.addNamed)(path, importName, getSource(state.source, importName), {
            importedInterop: "uncompiled",
            ensureLiveReference: true
          }).name;
        }
      });
      return importMap;
    } else {
      const importMap = {};
      const sourceMap = {};
      imports.forEach(importName => {
        const source = getSource(state.source, importName);

        if (!importMap[importName]) {
          if (!sourceMap[source]) {
            sourceMap[source] = (0, _helperModuleImports.addNamespace)(path, source, {
              importedInterop: "uncompiled",
              ensureLiveReference: true
            }).name;
          }

          importMap[importName] = sourceMap[source];
        }
      });
      return importMap;
    }
  }

  function createIdentifierParser(id) {
    return () => {
      return id.split(".").map(name => t.identifier(name)).reduce((object, property) => t.memberExpression(object, property));
    };
  }

  function makeTrace(fileNameIdentifier, lineNumber, column0Based) {
    const fileLineLiteral = lineNumber != null ? t.numericLiteral(lineNumber) : t.nullLiteral();
    const fileColumnLiteral = column0Based != null ? t.numericLiteral(column0Based + 1) : t.nullLiteral();
    const fileNameProperty = t.objectProperty(t.identifier("fileName"), fileNameIdentifier);
    const lineNumberProperty = t.objectProperty(t.identifier("lineNumber"), fileLineLiteral);
    const columnNumberProperty = t.objectProperty(t.identifier("columnNumber"), fileColumnLiteral);
    return t.objectExpression([fileNameProperty, lineNumberProperty, columnNumberProperty]);
  }

  function makeSource(path, state) {
    const location = path.node.loc;

    if (!location) {
      return;
    }

    if (!state.fileNameIdentifier) {
      const {
        filename = ""
      } = state;
      const fileNameIdentifier = path.scope.generateUidIdentifier(FILE_NAME_VAR);
      const scope = path.hub.getScope();

      if (scope) {
        scope.push({
          id: fileNameIdentifier,
          init: t.stringLiteral(filename)
        });
      }

      state.fileNameIdentifier = fileNameIdentifier;
    }

    return makeTrace(state.fileNameIdentifier, location.start.line, location.start.column);
  }

  function convertJSXIdentifier(node, parent) {
    if (t.isJSXIdentifier(node)) {
      if (node.name === "this" && t.isReferenced(node, parent)) {
        return t.thisExpression();
      } else if (t.isValidIdentifier(node.name, false)) {
        node.type = "Identifier";
      } else {
        return t.stringLiteral(node.name);
      }
    } else if (t.isJSXMemberExpression(node)) {
      return t.memberExpression(convertJSXIdentifier(node.object, node), convertJSXIdentifier(node.property, node));
    } else if (t.isJSXNamespacedName(node)) {
      return t.stringLiteral(`${node.namespace.name}:${node.name.name}`);
    }

    return node;
  }

  function convertAttributeValue(node) {
    if (t.isJSXExpressionContainer(node)) {
      return node.expression;
    } else {
      return node;
    }
  }

  function convertAttribute(node) {
    const value = convertAttributeValue(node.value || t.booleanLiteral(true));

    if (t.isJSXSpreadAttribute(node)) {
      return t.spreadElement(node.argument);
    }

    if (t.isStringLiteral(value) && !t.isJSXExpressionContainer(node.value)) {
      value.value = value.value.replace(/\n\s+/g, " ");

      if (value.extra && value.extra.raw) {
        delete value.extra.raw;
      }
    }

    if (t.isJSXNamespacedName(node.name)) {
      node.name = t.stringLiteral(node.name.namespace.name + ":" + node.name.name.name);
    } else if (t.isValidIdentifier(node.name.name, false)) {
      node.name.type = "Identifier";
    } else {
      node.name = t.stringLiteral(node.name.name);
    }

    return t.inherits(t.objectProperty(node.name, value), node);
  }

  function buildJSXElementCall(path, file) {
    const openingPath = path.get("openingElement");
    openingPath.parent.children = t.react.buildChildren(openingPath.parent);
    const tagExpr = convertJSXIdentifier(openingPath.node.name, openingPath.node);
    const args = [];
    let tagName;

    if (t.isIdentifier(tagExpr)) {
      tagName = tagExpr.name;
    } else if (t.isLiteral(tagExpr)) {
      tagName = tagExpr.value;
    }

    const state = {
      tagExpr: tagExpr,
      tagName: tagName,
      args: args,
      pure: false
    };

    if (options.pre) {
      options.pre(state, file);
    }

    let attribs = [];
    const extracted = Object.create(null);

    for (const attr of openingPath.get("attributes")) {
      if (attr.isJSXAttribute() && t.isJSXIdentifier(attr.node.name)) {
        const {
          name
        } = attr.node.name;

        switch (name) {
          case "__source":
          case "__self":
            if (extracted[name]) throw sourceSelfError(path, name);

          case "key":
            extracted[name] = convertAttributeValue(attr.node.value);
            break;

          default:
            attribs.push(attr.node);
        }
      } else {
        attribs.push(attr.node);
      }
    }

    if (attribs.length || path.node.children.length) {
      attribs = buildJSXOpeningElementAttributes(attribs, file, path.node.children);
    } else {
      attribs = t.objectExpression([]);
    }

    args.push(attribs);

    if (!options.development) {
      if (extracted.key !== undefined) {
        args.push(extracted.key);
      }
    } else {
      var _extracted$key, _extracted$__source, _extracted$__self;

      args.push((_extracted$key = extracted.key) != null ? _extracted$key : path.scope.buildUndefinedNode(), t.booleanLiteral(path.node.children.length > 1), (_extracted$__source = extracted.__source) != null ? _extracted$__source : path.scope.buildUndefinedNode(), (_extracted$__self = extracted.__self) != null ? _extracted$__self : t.thisExpression());
    }

    if (options.post) {
      options.post(state, file);
    }

    const call = state.call || t.callExpression(path.node.children.length > 1 ? state.jsxStaticCallee : state.jsxCallee, args);
    if (state.pure) (0, _helperAnnotateAsPure.default)(call);
    return call;
  }

  function buildJSXOpeningElementAttributes(attribs, file, children) {
    const props = attribs.map(convertAttribute);

    if (children && children.length > 0) {
      if (children.length === 1) {
        props.push(t.objectProperty(t.identifier("children"), children[0]));
      } else {
        props.push(t.objectProperty(t.identifier("children"), t.arrayExpression(children)));
      }
    }

    return t.objectExpression(props);
  }

  function buildJSXFragmentCall(path, file) {
    const openingPath = path.get("openingElement");
    openingPath.parent.children = t.react.buildChildren(openingPath.parent);
    const args = [];
    const tagName = null;
    const tagExpr = file.get("@babel/plugin-react-jsx/jsxFragIdentifier")();
    const state = {
      tagExpr: tagExpr,
      tagName: tagName,
      args: args,
      pure: false
    };

    if (options.pre) {
      options.pre(state, file);
    }

    let childrenNode;

    if (path.node.children.length > 0) {
      if (path.node.children.length === 1) {
        childrenNode = path.node.children[0];
      } else {
        childrenNode = t.arrayExpression(path.node.children);
      }
    }

    args.push(t.objectExpression(childrenNode !== undefined ? [t.objectProperty(t.identifier("children"), childrenNode)] : []));

    if (options.development) {
      args.push(path.scope.buildUndefinedNode(), t.booleanLiteral(path.node.children.length > 1));
    }

    if (options.post) {
      options.post(state, file);
    }

    const call = state.call || t.callExpression(path.node.children.length > 1 ? state.jsxStaticCallee : state.jsxCallee, args);
    if (state.pure) (0, _helperAnnotateAsPure.default)(call);
    return call;
  }

  function buildCreateElementFragmentCall(path, file) {
    if (options.filter && !options.filter(path.node, file)) {
      return;
    }

    const openingPath = path.get("openingElement");
    openingPath.parent.children = t.react.buildChildren(openingPath.parent);
    const args = [];
    const tagName = null;
    const tagExpr = file.get("@babel/plugin-react-jsx/jsxFragIdentifier")();
    const state = {
      tagExpr: tagExpr,
      tagName: tagName,
      args: args,
      pure: false
    };

    if (options.pre) {
      options.pre(state, file);
    }

    args.push(t.nullLiteral(), ...path.node.children);

    if (options.post) {
      options.post(state, file);
    }

    file.set("@babel/plugin-react-jsx/usedFragment", true);
    const call = state.call || t.callExpression(state.createElementCallee, args);
    if (state.pure) (0, _helperAnnotateAsPure.default)(call);
    return call;
  }

  function buildCreateElementCall(path, file) {
    const openingPath = path.get("openingElement");
    openingPath.parent.children = t.react.buildChildren(openingPath.parent);
    const tagExpr = convertJSXIdentifier(openingPath.node.name, openingPath.node);
    const args = [];
    let tagName;

    if (t.isIdentifier(tagExpr)) {
      tagName = tagExpr.name;
    } else if (t.isLiteral(tagExpr)) {
      tagName = tagExpr.value;
    }

    const state = {
      tagExpr: tagExpr,
      tagName: tagName,
      args: args,
      pure: false
    };

    if (options.pre) {
      options.pre(state, file);
    }

    const attribs = buildCreateElementOpeningElementAttributes(path, openingPath.node.attributes);
    args.push(attribs, ...path.node.children);

    if (options.post) {
      options.post(state, file);
    }

    const call = state.call || t.callExpression(state.createElementCallee, args);
    if (state.pure) (0, _helperAnnotateAsPure.default)(call);
    return call;
  }

  function buildCreateElementOpeningElementAttributes(path, attribs) {
    const props = [];
    const found = Object.create(null);

    for (const attr of attribs) {
      const name = t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name;

      if (name === "__source" || name === "__self") {
        if (found[name]) throw sourceSelfError(path, name);
        found[name] = true;
        if (!options.development) continue;
      }

      props.push(convertAttribute(attr));
    }

    return props.length > 0 ? t.objectExpression(props) : t.nullLiteral();
  }

  function sourceSelfError(path, name) {
    const pluginName = `transform-react-jsx-${name.slice(2)}`;
    return path.buildCodeFrameError(`Duplicate ${name} prop found. You are most likely using the deprecated ${pluginName} Babel plugin. Both __source and __self are automatically set when using the automatic runtime. Please remove transform-react-jsx-source and transform-react-jsx-self from your Babel config.`);
  }
}