"use strict";

exports.__esModule = true;
exports.default = void 0;

var _core = require("@superset-ui/core");

class ChartBuildQueryRegistry extends _core.Registry {
  constructor() {
    super({
      name: 'ChartBuildQuery',
      overwritePolicy: _core.OverwritePolicy.WARN
    });
  }

}

const getInstance = (0, _core.makeSingleton)(ChartBuildQueryRegistry);
var _default = getInstance;
exports.default = _default;