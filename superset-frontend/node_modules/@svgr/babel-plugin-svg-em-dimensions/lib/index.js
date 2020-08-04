"use strict";

exports.__esModule = true;
exports.default = void 0;
const elements = ['svg', 'Svg'];

const plugin = ({
  types: t
}) => ({
  visitor: {
    JSXOpeningElement: {
      enter(path) {
        if (!elements.some(element => path.get('name').isJSXIdentifier({
          name: element
        }))) return;
        const requiredAttributes = ['width', 'height'];
        const attributeValue = '1em';
        path.get('attributes').forEach(attributePath => {
          if (!attributePath.isJSXAttribute()) return;
          const index = requiredAttributes.indexOf(attributePath.node.name.name);
          if (index === -1) return;
          const value = attributePath.get('value');
          value.replaceWith(t.stringLiteral(attributeValue));
          requiredAttributes.splice(index, 1);
        });
        requiredAttributes.forEach(attribute => {
          path.pushContainer('attributes', t.jsxAttribute(t.jsxIdentifier(attribute), t.stringLiteral(attributeValue)));
        });
      }

    }
  }
});

var _default = plugin;
exports.default = _default;