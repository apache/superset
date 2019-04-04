"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bs_logger_1 = require("bs-logger");
var backports_1 = require("./backports");
var original = process.env.TS_JEST_LOG;
var buildOptions = function () {
    var _a;
    return ({
        context: (_a = {},
            _a[bs_logger_1.LogContexts.package] = 'ts-jest',
            _a[bs_logger_1.LogContexts.logLevel] = bs_logger_1.LogLevels.trace,
            _a.version = require('../../package.json').version,
            _a),
        targets: process.env.TS_JEST_LOG || undefined,
    });
};
exports.rootLogger = bs_logger_1.createLogger(buildOptions());
backports_1.backportTsJestDebugEnvVar(exports.rootLogger);
if (original !== process.env.TS_JEST_LOG) {
    exports.rootLogger = bs_logger_1.createLogger(buildOptions());
}
