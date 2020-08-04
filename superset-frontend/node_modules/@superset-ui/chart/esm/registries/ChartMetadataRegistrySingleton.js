"use strict";

exports.__esModule = true;
exports.default = void 0;

var _core = require("@superset-ui/core");

class ChartMetadataRegistry extends _core.Registry {
  constructor() {
    super({
      name: 'ChartMetadata',
      overwritePolicy: _core.OverwritePolicy.WARN
    });
  }

}

const getInstance = (0, _core.makeSingleton)(ChartMetadataRegistry);
var _default = getInstance;
exports.default = _default;