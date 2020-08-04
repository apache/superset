var global = require('../internals/global');
var bind = require('../internals/function-bind-context');

var call = Function.call;

module.exports = function (CONSTRUCTOR, METHOD, length) {
  return bind(call, global[CONSTRUCTOR].prototype[METHOD], length);
};
