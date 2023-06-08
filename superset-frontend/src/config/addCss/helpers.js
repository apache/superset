/* eslint-disable import/no-extraneous-dependencies */
const glob = require('glob');
const prependFile = require('prepend-file');

/**
 *
 * @param {*} hash - hash of the file
 * @param {*} path - public path
 * @param {*} name - microfrontend name
 * @returns string
 */
const getScriptText = (hash, name, path) => `
(function () {
  console.log('${name} init started');

  function addCssFile() {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '${path}/${name}.${hash}.css';
    link.id = 'superset-dashboard-plugin_manual_addon';

    document.body.appendChild(link);
  }

  addCssFile();
  console.log('${name} init worked');
})();
`;

/**
 *
 * @param {*} outputFolder - folder withh build files
 * @param {*} name - microfrontend name
 * @param {*} path - public path
 */
const updateFileWithCss = (outputFolder, name, path) => {
  console.log('Update File With Css function');
  console.log('Output folder:', JSON.stringify(outputFolder));
  console.log('Microfrontend name:', JSON.stringify(name));
  console.log('Output path:', JSON.stringify(path));

  glob(`${outputFolder}/${name}.**.js`, {}, function (er, files) {
    if (er) throw er;
    try {
      console.log('Files to update:', JSON.stringify(files));
      const hash = files[0].split(`${name}.`)[1].split('.js')[0];
      const scriptText = getScriptText(hash, name, path);
      prependFile(files[0], scriptText);
      console.log(
        'Files were updated with script:\n\n',
        JSON.stringify(scriptText.split('\n').join('').split('  ').join(' ')),
      );
    } catch (error) {
      console.log('There was an error in updateFileWithCss:', error);
    }
  });
};

module.exports = { updateFileWithCss };
