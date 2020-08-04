var temporalUndefined = require("./temporalUndefined");

var tdz = require("./tdz");

function _temporalRef(val, name) {
  return val === temporalUndefined ? tdz(name) : val;
}

module.exports = _temporalRef;