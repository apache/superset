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
  const importName = makeImportName(file.split(".js")[0])
  const lines = [
    `import ${importName} from "refractor/lang/${file}";`,
     `export default ${importName}`,
    ''
  ];

  fs.writeFile(path.join(__dirname, `../src/languages/prism/${file}`), lines.join(';\n'), err => {
    if (err) {
      process.exit(1);
    }
  });
}

fs.readdir(path.join(__dirname, '../node_modules/refractor/lang'), (err, files) => {
  console.log(files)
  if (err) {
    process.exit(1);
  }
  files.forEach(createLanguagePassthroughModule);
  const availableLanguageNames = files.map(file => file.split('.js')[0]);
  console.log(availableLanguageNames.join('\n'));
  const languagesLi = availableLanguageNames.map((name) => `\n* ${makeImportName(name)}${ makeImportName(name) !== name ? ` (${name})` : '' }`);
  const languageMD = `## Available \`language\` imports ${languagesLi.join('')}`;
  fs.writeFile(path.join(__dirname, '../AVAILABLE_LANGUAGES_PRISM.MD'), languageMD, err => {
    if (err) {
      process.exit(1);
    }
  });

  const defaultExports = availableLanguageNames.map((name) => `export { default as ${makeImportName(name)} } from './${name}';\n`);
  fs.writeFile(path.join(__dirname, '../src/languages/prism/index.js'), defaultExports.join(''), err => {
    if (err) {
      process.exit(1);
    }
  });
});
