var child_process = require("child_process"),
    resolve = require("resolve"),
    options = {basedir: process.cwd(), paths: []};

module.exports = function(module) {
  try {
    return resolve.sync(module, options); // Attempt fast local resolve first.
  } catch (error) {
    if (!options.paths.length) {
      options.paths.push(child_process.execSync("npm root -g").toString().trim());
      return resolve.sync(module, options);
    } else {
      throw error;
    }
  }
};
