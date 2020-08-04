"use strict";

exports.__esModule = true;
exports.default = void 0;

const removeJSXAttribute = (api, opts) => ({
  visitor: {
    JSXOpeningElement(path) {
      if (!opts.elements.includes(path.node.name.name)) return;
      path.get('attributes').forEach(attribute => {
        const nodeName = attribute.node.name;

        if (nodeName && opts.attributes.includes(nodeName.name)) {
          attribute.remove();
        }
      });
    }

  }
});

var _default = removeJSXAttribute;
exports.default = _default;