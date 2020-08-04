"use strict";

exports.__esModule = true;
exports.default = void 0;
const elements = ['svg', 'Svg'];

const plugin = ({
  types: t
}) => ({
  visitor: {
    JSXElement(path) {
      if (!elements.some(element => path.get('openingElement.name').isJSXIdentifier({
        name: element
      }))) {
        return;
      }

      function createTitle(children = [], attributes = []) {
        return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('title'), attributes), t.jsxClosingElement(t.jsxIdentifier('title')), children);
      }

      function createTitleIdAttribute() {
        return t.jsxAttribute(t.jsxIdentifier('id'), t.jsxExpressionContainer(t.identifier('titleId')));
      }

      function enhanceAttributes(attributes) {
        const existingId = attributes.find(attribute => attribute.name.name === 'id');

        if (!existingId) {
          return [...attributes, createTitleIdAttribute()];
        }

        existingId.value = t.jsxExpressionContainer(t.logicalExpression('||', t.identifier('titleId'), existingId.value));
        return attributes;
      }

      function getTitleElement(existingTitle) {
        const titleExpression = t.identifier('title');

        if (existingTitle) {
          existingTitle.openingElement.attributes = enhanceAttributes(existingTitle.openingElement.attributes);
        }

        let titleElement = t.conditionalExpression(titleExpression, createTitle([t.jsxExpressionContainer(titleExpression)], existingTitle ? existingTitle.openingElement.attributes : [t.jsxAttribute(t.jsxIdentifier('id'), t.jsxExpressionContainer(t.identifier('titleId')))]), t.nullLiteral());

        if (existingTitle && existingTitle.children && existingTitle.children.length) {
          // if title already exists
          // render as follows
          const fallbackTitleElement = existingTitle; // {title === undefined ? fallbackTitleElement : titleElement}

          const conditionalExpressionForTitle = t.conditionalExpression(t.binaryExpression('===', titleExpression, t.identifier('undefined')), fallbackTitleElement, titleElement);
          titleElement = t.jsxExpressionContainer(conditionalExpressionForTitle);
        } else {
          titleElement = t.jsxExpressionContainer(titleElement);
        }

        return titleElement;
      } // store the title element


      let titleElement;
      const hasTitle = path.get('children').some(childPath => {
        if (!childPath.isJSXElement()) return false;
        if (childPath.node === titleElement) return false;
        if (childPath.node.openingElement.name.name !== 'title') return false;
        titleElement = getTitleElement(childPath.node);
        childPath.replaceWith(titleElement);
        return true;
      }); // create a title element if not already create

      titleElement = titleElement || getTitleElement();

      if (!hasTitle) {
        // path.unshiftContainer is not working well :(
        // path.unshiftContainer('children', titleElement)
        path.node.children.unshift(titleElement);
        path.replaceWith(path.node);
      }
    }

  }
});

var _default = plugin;
exports.default = _default;