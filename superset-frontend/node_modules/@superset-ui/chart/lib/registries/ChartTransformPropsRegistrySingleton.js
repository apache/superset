"use strict";

exports.__esModule = true;
exports.default = void 0;

var _core = require("@superset-ui/core");

class ChartTransformPropsRegistry extends _core.Registry {
  constructor() {
    super({
      name: 'ChartTransformProps',
      overwritePolicy: _core.OverwritePolicy.WARN
    });
  }

}

const getInstance = (0, _core.makeSingleton)(ChartTransformPropsRegistry);
var _default = getInstance;
exports.default = _default;