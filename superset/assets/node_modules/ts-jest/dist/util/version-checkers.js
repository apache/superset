"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var semver_1 = require("semver");
var get_package_version_1 = require("./get-package-version");
var logger_1 = require("./logger");
var messages_1 = require("./messages");
var logger = logger_1.rootLogger.child({ namespace: 'versions' });
var ExpectedVersions;
(function (ExpectedVersions) {
    ExpectedVersions["Jest"] = ">=24 <25";
    ExpectedVersions["TypeScript"] = ">=2.7 <4";
    ExpectedVersions["BabelJest"] = ">=24 <25";
    ExpectedVersions["BabelCore"] = ">=7.0.0-beta.0 <8";
})(ExpectedVersions = exports.ExpectedVersions || (exports.ExpectedVersions = {}));
exports.VersionCheckers = {
    jest: createVersionChecker('jest', ExpectedVersions.Jest),
    typescript: createVersionChecker('typescript', ExpectedVersions.TypeScript),
    babelJest: createVersionChecker('babel-jest', ExpectedVersions.BabelJest),
    babelCore: createVersionChecker('@babel/core', ExpectedVersions.BabelCore),
};
function checkVersion(name, expectedRange, action) {
    if (action === void 0) { action = 'warn'; }
    var version = get_package_version_1.getPackageVersion(name);
    var success = !!version && semver_1.satisfies(version, expectedRange);
    logger.debug({
        actualVersion: version,
        expectedVersion: expectedRange,
    }, 'checking version of %s: %s', name, success ? 'OK' : 'NOT OK');
    if (!action || success)
        return success;
    var message = messages_1.interpolate(version ? messages_1.Errors.UntestedDependencyVersion : messages_1.Errors.MissingDependency, {
        module: name,
        actualVersion: version || '??',
        expectedVersion: rangeToHumanString(expectedRange),
    });
    if (action === 'warn') {
        logger.warn(message);
    }
    else if (action === 'throw') {
        logger.fatal(message);
        throw new RangeError(message);
    }
    return success;
}
function rangeToHumanString(versionRange) {
    return new semver_1.Range(versionRange).toString();
}
function createVersionChecker(moduleName, expectedVersion) {
    var memo;
    var warn = function () {
        if (memo !== undefined)
            return memo;
        return (memo = checkVersion(moduleName, expectedVersion, 'warn'));
    };
    var raise = function () { return checkVersion(moduleName, expectedVersion, 'throw'); };
    return {
        raise: raise,
        warn: warn,
        forget: function () {
            memo = undefined;
        },
    };
}
