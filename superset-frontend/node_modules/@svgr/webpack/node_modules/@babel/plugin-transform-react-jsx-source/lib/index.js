"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _core = require("@babel/core");

const TRACE_ID = "__source";
const FILE_NAME_VAR = "_jsxFileName";

var _default = (0, _helperPluginUtils.declare)(api => {
  api.assertVersion(7);

  function makeTrace(fileNameIdentifier, lineNumber, column0Based) {
    const fileLineLiteral = lineNumber != null ? _core.types.numericLiteral(lineNumber) : _core.types.nullLiteral();
    const fileColumnLiteral = column0Based != null ? _core.types.numericLiteral(column0Based + 1) : _core.types.nullLiteral();

    const fileNameProperty = _core.types.objectProperty(_core.types.identifier("fileName"), fileNameIdentifier);

    const lineNumberProperty = _core.types.objectProperty(_core.types.identifier("lineNumber"), fileLineLiteral);

    const columnNumberProperty = _core.types.objectProperty(_core.types.identifier("columnNumber"), fileColumnLiteral);

    return _core.types.objectExpression([fileNameProperty, lineNumberProperty, columnNumberProperty]);
  }

  const visitor = {
    JSXOpeningElement(path, state) {
      const id = _core.types.jsxIdentifier(TRACE_ID);

      const location = path.container.openingElement.loc;

      if (!location) {
        return;
      }

      const attributes = path.container.openingElement.attributes;

      for (let i = 0; i < attributes.length; i++) {
        const name = attributes[i].name;

        if ((name == null ? void 0 : name.name) === TRACE_ID) {
          return;
        }
      }

      if (!state.fileNameIdentifier) {
        const fileName = state.filename || "";
        const fileNameIdentifier = path.scope.generateUidIdentifier(FILE_NAME_VAR);
        const scope = path.hub.getScope();

        if (scope) {
          scope.push({
            id: fileNameIdentifier,
            init: _core.types.stringLiteral(fileName)
          });
        }

        state.fileNameIdentifier = fileNameIdentifier;
      }

      const trace = makeTrace(state.fileNameIdentifier, location.start.line, location.start.column);
      attributes.push(_core.types.jsxAttribute(id, _core.types.jsxExpressionContainer(trace)));
    }

  };
  return {
    name: "transform-react-jsx-source",
    visitor
  };
});

exports.default = _default;