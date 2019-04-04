'use strict';
/*
 * Quick and dirty script to build javascript stylesheets from highlight.js css
*/
const path = require('path');
const fs = require('fs');
const css = require('css');
const camel = require('to-camel-case');

fs.readdir(path.join(__dirname, '../node_modules/highlight.js/styles'), (err, files) => {
  if (err) {
    throw err;
  }

  files.forEach(file => {
    let stylesList = [];
    if (file.includes('.css')) {
      createJavascriptStyleSheet(file);
    };
  })
  const onlyCSSFiles = files.filter(file => file.includes('.css'));
  const availableStyleNames = onlyCSSFiles.map(file => (
    file.split('.css')[0] === 'default' ? 'default-style' : file.split('.css')[0]
  ));
  const styles = availableStyleNames.map(name => `\n* ${camel(name)}`);
  const defaultExports = availableStyleNames.map(name => `export { default as ${camel(name)} } from './${name}';\n`);
  const styleMD = `## Available \`stylesheet\` props ${styles.join('')}`;
  fs.writeFile(path.join(__dirname, '../AVAILABLE_STYLES_HLJS.MD'), styleMD, (err) => {
    if (err) {
      throw err;
    }
  });
  fs.writeFile(path.join(__dirname, '../src/styles/hljs/index.js'), defaultExports.join(''), (err) => {
    if (err) {
      throw err;
    }
  });
});


function createJavascriptStyleSheet(file) {
  const ignoreStyleWithThis = '.hljs a';
  const fileWithoutCSS = file.split('.css')[0] === 'default' ? 'default-style' : file.split('.css')[0];
  fs.readFile(path.join(__dirname, `../node_modules/highlight.js/styles/${file}`), 'utf-8', (err, data) => {
    if (err) {
      throw err;
    }
    const javacriptStylesheet = css.parse(data).stylesheet.rules.reduce((sheet, rule) => {
      if (rule.type === 'rule') {
        const style = rule.selectors.reduce((selectors, selector) => {
          if (!selector.includes(ignoreStyleWithThis)) {
            const selectorObject = rule.declarations.reduce((declarations, declaration) => {
              if (declaration.type === 'declaration' && declaration.property) {
                declarations[camel(declaration.property)] = declaration.value;
              }
              return declarations;
            }, {});
            selectors[selector.substring(1)] = selectorObject;
          }
          return selectors;
        }, {});
        sheet = Object.keys(style).reduce((stylesheet, selector) => {
          if (stylesheet[selector]) {
            stylesheet[selector] = Object.assign({}, stylesheet[selector], style[selector]);
          }
          else {
            stylesheet[selector] = style[selector];
          }
          return stylesheet;
        }, sheet);
      }
      return sheet;
    }, {});
    fs.writeFile(path.join(__dirname, `../src/styles/hljs/${fileWithoutCSS}.js`),
      `export default ${JSON.stringify(javacriptStylesheet, null, 4)}`,
      (err) => {
        if (err) {
          throw err;
        }
      });
  });
}