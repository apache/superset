"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chokidar = require("chokidar");
var path = require("path");
var startsWith = require("lodash/startsWith");
var FilesWatcher = /** @class */ (function () {
    function FilesWatcher(watchPaths, watchExtensions) {
        this.watchPaths = watchPaths;
        this.watchExtensions = watchExtensions;
        this.watchers = [];
        this.listeners = {};
    }
    FilesWatcher.prototype.isFileSupported = function (filePath) {
        return this.watchExtensions.indexOf(path.extname(filePath)) !== -1;
    };
    FilesWatcher.prototype.watch = function () {
        var _this = this;
        if (this.isWatching()) {
            throw new Error('Cannot watch again - already watching.');
        }
        this.watchers = this.watchPaths.map(function (watchPath) {
            return chokidar
                .watch(watchPath, { persistent: true, alwaysStat: true })
                .on('change', function (filePath, stats) {
                if (_this.isFileSupported(filePath)) {
                    (_this.listeners['change'] || []).forEach(function (changeListener) {
                        changeListener(filePath, stats);
                    });
                }
            })
                .on('unlink', function (filePath) {
                if (_this.isFileSupported(filePath)) {
                    (_this.listeners['unlink'] || []).forEach(function (unlinkListener) {
                        unlinkListener(filePath);
                    });
                }
            });
        });
    };
    FilesWatcher.prototype.isWatchingFile = function (filePath) {
        return (this.isWatching() &&
            this.isFileSupported(filePath) &&
            this.watchPaths.some(function (watchPath) { return startsWith(filePath, watchPath); }));
    };
    FilesWatcher.prototype.isWatching = function () {
        return this.watchers.length > 0;
    };
    FilesWatcher.prototype.on = function (event, listener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    };
    FilesWatcher.prototype.off = function (event, listener) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(function (oldListener) { return oldListener !== listener; });
        }
    };
    return FilesWatcher;
}());
exports.FilesWatcher = FilesWatcher;
