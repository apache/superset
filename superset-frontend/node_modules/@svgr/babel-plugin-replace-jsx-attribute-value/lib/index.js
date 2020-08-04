"use strict";

exports.__esModule = true;
exports.default = void 0;

const addJSXAttribute = ({
  types: t,
  template
}, opts) => {
  function getAttributeValue(value, literal) {
    if (typeof value === 'string' && literal) {
      return t.jsxExpressionContainer(template.ast(value).expression);
    }

    if (typeof value === 'string') {
      return t.stringLiteral(value);
    }

    if (typeof value === 'boolean') {
      return t.jsxExpressionContainer(t.booleanLiteral(value));
    }

    if (typeof value === 'number') {
      return t.jsxExpressionContainer(t.numericLiteral(value));
    }

    return null;
  }

  return {
    visitor: {
      JSXAttribute(path) {
        const valuePath = path.get('value');
        if (!valuePath.isStringLiteral()) return;
        opts.values.forEach(({
          value,
          newValue,
          literal
        }) => {
          if (!valuePath.isStringLiteral({
            value
          })) return;
          valuePath.replaceWith(getAttributeValue(newValue, literal));
        });
      }

    }
  };
};

var _default = addJSXAttribute;
exports.default = _default;