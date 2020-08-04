"use strict";

exports.__esModule = true;
exports.default = void 0;

var _core = require("@superset-ui/core");

class ChartControlPanelRegistry extends _core.Registry {
  constructor() {
    super({
      name: 'ChartControlPanel'
    });
  }

}

const getInstance = (0, _core.makeSingleton)(ChartControlPanelRegistry);
var _default = getInstance;
exports.default = _default;