'use strict';
/*
 * Build javascript passthrough modules for highlight.js languages
*/
const path = require('path');
const fs = require('fs');
const camel = require('to-camel-case');

function makeImportName (name) {
  if (name === '1c') {
    return 'oneC';
  }
  return camel(name);
}

function createLanguagePassthroughModule (file) {
  const fileWithoutJS = file.split('.js')[0];
  const importName = makeImportName(fileWithoutJS);
  const lines = [
    `import ${importName} from "highlight.js/lib/languages/${fileWithoutJS}"`,
    `export default ${importName}`,
    ''
  ];

  fs.writeFile(path.join(__dirname, `../src/languages/hljs/${file}`), lines.join(';\n'), (err) => {
    if (err) {
      throw err;
    }
  });
}

fs.readdir(path.join(__dirname, '../node_modules/highlight.js/lib/languages'), (err, files) => {
  if (err) {
    throw err;
  }

  files.forEach(createLanguagePassthroughModule);

  const availableLanguageNames = files.map((file) => file.split('.js')[0]);
  const languagesLi = availableLanguageNames.map((name) => `\n* ${makeImportName(name)}${ makeImportName(name) !== name ? ` (${name})` : '' }`);
  const languageMD = `## Available \`language\` imports ${languagesLi.join('')}`;
  fs.writeFile(path.join(__dirname, '../AVAILABLE_LANGUAGES_HLJS.MD'), languageMD, (err) => {
    if (err) {
      throw err;
    }
  });

  const defaultExports = availableLanguageNames.map((name) => `export { default as ${makeImportName(name)} } from './${name}';\n`);
  fs.writeFile(path.join(__dirname, '../src/languages/hljs/index.js'), defaultExports.join(''), (err) => {
    if (err) {
      throw err;
    }
  });
});