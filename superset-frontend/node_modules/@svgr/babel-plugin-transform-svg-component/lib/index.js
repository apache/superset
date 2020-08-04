"use strict";

exports.__esModule = true;
exports.default = void 0;

var _util = require("./util");

function defaultTemplate({
  template
}, opts, {
  imports,
  interfaces,
  componentName,
  props,
  jsx,
  exports
}) {
  const plugins = ['jsx'];

  if (opts.typescript) {
    plugins.push('typescript');
  }

  const typeScriptTpl = template.smart({
    plugins
  });
  return typeScriptTpl.ast`${imports}

${interfaces}

function ${componentName}(${props}) {
  return ${jsx};
}
${exports}
  `;
}

const plugin = (api, opts) => ({
  visitor: {
    Program(path) {
      const {
        types: t
      } = api;
      const template = opts.template || defaultTemplate;
      const body = template(api, opts, {
        componentName: t.identifier(opts.state.componentName),
        interfaces: (0, _util.getInterface)(api, opts),
        props: (0, _util.getProps)(api, opts),
        imports: (0, _util.getImport)(api, opts),
        exports: (0, _util.getExport)(api, opts),
        jsx: path.node.body[0].expression
      });

      if (Array.isArray(body)) {
        path.node.body = body;
      } else {
        path.node.body = [body];
      }

      path.replaceWith(path.node);
    }

  }
});

var _default = plugin;
exports.default = _default;