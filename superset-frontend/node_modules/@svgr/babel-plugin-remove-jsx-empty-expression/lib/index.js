"use strict";

exports.__esModule = true;
exports.default = void 0;

const removeJSXEmptyExpression = () => ({
  visitor: {
    JSXExpressionContainer(path) {
      if (!path.get('expression').isJSXEmptyExpression()) return;
      path.remove();
    }

  }
});

var _default = removeJSXEmptyExpression;
exports.default = _default;