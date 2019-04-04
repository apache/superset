"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const console_1 = require("console");
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
const stderrConsole = new console_1.Console(process.stderr);
const stdoutConsole = new console_1.Console(process.stdout);
const doNothingLogger = (_message) => { };
const makeLoggerFunc = (loaderOptions) => loaderOptions.silent
    ? (_whereToLog, _message) => { }
    : (whereToLog, message) => 
    // tslint:disable-next-line:no-console
    console.log.call(whereToLog, message);
const makeExternalLogger = (loaderOptions, logger) => (message) => logger(loaderOptions.logInfoToStdOut ? stdoutConsole : stderrConsole, message);
const makeLogInfo = (loaderOptions, logger, green) => LogLevel[loaderOptions.logLevel] <= LogLevel.INFO
    ? (message) => logger(loaderOptions.logInfoToStdOut ? stdoutConsole : stderrConsole, green(message))
    : doNothingLogger;
const makeLogError = (loaderOptions, logger, red) => LogLevel[loaderOptions.logLevel] <= LogLevel.ERROR
    ? (message) => logger(stderrConsole, red(message))
    : doNothingLogger;
const makeLogWarning = (loaderOptions, logger, yellow) => LogLevel[loaderOptions.logLevel] <= LogLevel.WARN
    ? (message) => logger(stderrConsole, yellow(message))
    : doNothingLogger;
function makeLogger(loaderOptions, colors) {
    const logger = makeLoggerFunc(loaderOptions);
    return {
        log: makeExternalLogger(loaderOptions, logger),
        logInfo: makeLogInfo(loaderOptions, logger, colors.green),
        logWarning: makeLogWarning(loaderOptions, logger, colors.yellow),
        logError: makeLogError(loaderOptions, logger, colors.red)
    };
}
exports.makeLogger = makeLogger;
