const path = require('path');

const join = (fs, rootPath, filename) => {
  if (fs && fs.join) {
    return fs.join(rootPath, filename);
  }
  if (path.posix.isAbsolute(rootPath)) {
    return path.posix.join(rootPath, filename);
  }
  if (path.win32.isAbsolute(rootPath)) {
    return path.win32.join(rootPath, filename);
  }
  throw new Error(
    `${rootPath} is neither a posix nor a windows path, and there is no 'join' method defined in the file system`,
  );
};

const dirname = (fs, absPath) => {
  if (fs && fs.dirname) {
    return fs.dirname(absPath);
  }
  if (path.posix.isAbsolute(absPath)) {
    return path.posix.dirname(absPath);
  }
  if (path.win32.isAbsolute(absPath)) {
    return path.win32.dirname(absPath);
  }
  throw new Error(
    `${absPath} is neither a posix nor a windows path, and there is no 'dirname' method defined in the file system`,
  );
};

const PLUGIN_NAME = 'ModuleReplaceWebpackPlugin';

/**
 * You can replace whole module (file) or create new module, export from target module and change some exported sub-modules
 */
class ModuleReplaceWebpackPlugin {
  /**
   * Create an instance of the plugin
   * @param {{ test: RegExp, replace: Function | string, ignoreIssuer?: RegExp  }[]} resourceRegExpList the resource matcher
   */
  constructor(resourceRegExpList) {
    this.resourceRegExpList = resourceRegExpList;
  }

  /**
   * Apply the plugin
   * @param {Compiler} compiler the compiler instance
   * @returns {void}
   */
  apply(compiler) {
    const { resourceRegExpList } = this;
    compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, nmf => {
      nmf.hooks.beforeResolve.tap(PLUGIN_NAME, result => {
        resourceRegExpList.forEach(({ test, replace, ignoreIssuer }) => {
          if (
            test.test(result.request) &&
            (!ignoreIssuer || !ignoreIssuer.test(result.contextInfo.issuer))
          ) {
            if (typeof replace === 'function') {
              replace(result);
            } else {
              console.log(
                `${PLUGIN_NAME}  replace  ${result.request}  to  ${replace}`,
              );
              // eslint-disable-next-line no-param-reassign
              result.request = replace;
            }
          }
        });
      });
      nmf.hooks.afterResolve.tap(PLUGIN_NAME, result => {
        const { createData } = result;
        resourceRegExpList.forEach(({ test, replace, ignoreIssuer }) => {
          if (
            test.test(createData.resource) &&
            (!ignoreIssuer || !ignoreIssuer.test(result.contextInfo.issuer))
          ) {
            if (typeof replace === 'function') {
              replace(result);
            } else {
              const fs = compiler.inputFileSystem;
              if (
                replace.startsWith('/') ||
                (replace.length > 1 && replace[1] === ':')
              ) {
                console.log(
                  `${PLUGIN_NAME}   replace   ${createData.resource}   to   ${replace}`,
                );
                createData.resource = replace;
              } else {
                const resultReplace = join(
                  fs,
                  dirname(fs, createData.resource),
                  replace,
                );
                console.log(
                  `${PLUGIN_NAME}   replace   ${createData.resource}   to   ${resultReplace}`,
                );
                createData.resource = resultReplace;
              }
            }
          }
        });
      });
    });
  }
}

module.exports = {
  ModuleReplaceWebpackPlugin,
};
