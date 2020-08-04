"use strict";

exports.__esModule = true;
exports.default = void 0;

var _core = require("@superset-ui/core");

class ChartComponentRegistry extends _core.Registry {
  constructor() {
    super({
      name: 'ChartComponent',
      overwritePolicy: _core.OverwritePolicy.WARN
    });
  }

}

const getInstance = (0, _core.makeSingleton)(ChartComponentRegistry);
var _default = getInstance;
exports.default = _default;