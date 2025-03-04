/* eslint-disable import/no-extraneous-dependencies */
const glob = require('glob');
const prependFile = require('prepend-file');

/**
 * Generates HTML for the Font Awesome CSS links
 * @returns string
 */
const getFontAwesomeLinksScript = () => `
(function () {
  var head = document.head;
  var link1 = document.createElement('link');
  link1.rel = 'stylesheet';
  link1.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.1/css/fontawesome.min.css';
  link1.integrity = 'sha512-giQeaPns4lQTBMRpOOHsYnGw1tGVzbAIHUyHRgn7+6FmiEgGGjaG0T2LZJmAPMzRCl+Cug0ItQ2xDZpTmEc+CQ==';
  link1.crossOrigin = 'anonymous';
  link1.referrerPolicy = 'no-referrer';
  head.appendChild(link1);

  var link2 = document.createElement('link');
  link2.rel = 'stylesheet';
  link2.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.1/css/solid.min.css';
  link2.integrity = 'sha512-6mc0R607di/biCutMUtU9K7NtNewiGQzrvWX4bWTeqmljZdJrwYvKJtnhgR+Ryvj+NRJ8+NnnCM/biGqMe/iRA==';
  link2.crossOrigin = 'anonymous';
  link2.referrerPolicy = 'no-referrer';
  head.appendChild(link2);
})();
`;

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
      const fontAwesomeLinks = getFontAwesomeLinksScript();
      const combinedText = fontAwesomeLinks + scriptText;

      prependFile(files[0], combinedText);
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
