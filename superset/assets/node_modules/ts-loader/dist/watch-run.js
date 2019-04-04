"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const constants = require("./constants");
const utils_1 = require("./utils");
/**
 * Make function which will manually update changed files
 */
function makeWatchRun(instance) {
    // Called Before starting compilation after watch
    const lastTimes = new Map();
    const startTime = 0;
    return (compiler, callback) => {
        if (null === instance.modifiedFiles) {
            instance.modifiedFiles = new Map();
        }
        // startTime = startTime || watching.startTime;
        const times = compiler.fileTimestamps;
        for (const [filePath, date] of times) {
            if (date > (lastTimes.get(filePath) || startTime) &&
                filePath.match(constants.tsTsxJsJsxRegex) !== null) {
                continue;
            }
            lastTimes.set(filePath, date);
            updateFile(instance, filePath);
        }
        // On watch update add all known dts files expect the ones in node_modules
        // (skip @types/* and modules with typings)
        for (const filePath of instance.files.keys()) {
            if (filePath.match(constants.dtsDtsxOrDtsDtsxMapRegex) !== null &&
                filePath.match(constants.nodeModules) === null) {
                updateFile(instance, filePath);
            }
        }
        callback();
    };
}
exports.makeWatchRun = makeWatchRun;
function updateFile(instance, filePath) {
    const nFilePath = path.normalize(filePath);
    const file = instance.files.get(nFilePath) || instance.otherFiles.get(nFilePath);
    if (file !== undefined) {
        file.text = utils_1.readFile(nFilePath) || '';
        file.version++;
        instance.version++;
        instance.modifiedFiles.set(nFilePath, file);
        if (instance.watchHost !== undefined) {
            instance.watchHost.invokeFileWatcher(nFilePath, instance.compiler.FileWatcherEventKind.Changed);
        }
    }
}
