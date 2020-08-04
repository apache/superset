var resolve = require("./resolve");

module.exports = function(module, sandbox) {
  var i = module.indexOf("="), name = module;
  if (i >= 0) name = module.slice(0, i), module = module.slice(i + 1);
  module = require(resolve(module));
  if (sandbox[name]) Object.assign(sandbox[name], module);
  else sandbox[name] = module;
  return sandbox;
};
