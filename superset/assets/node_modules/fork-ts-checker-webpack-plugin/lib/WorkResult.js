"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var WorkResult = /** @class */ (function () {
    function WorkResult(workDomain) {
        this.workResult = {};
        this.workDomain = workDomain;
    }
    WorkResult.prototype.supports = function (workName) {
        return -1 !== this.workDomain.indexOf(workName);
    };
    WorkResult.prototype.set = function (workName, result) {
        if (!this.supports(workName)) {
            throw new Error('Cannot set result - work "' + workName + '" is not supported.');
        }
        this.workResult[workName] = result;
    };
    WorkResult.prototype.has = function (workName) {
        return this.supports(workName) && undefined !== this.workResult[workName];
    };
    WorkResult.prototype.get = function (workName) {
        if (!this.supports(workName)) {
            throw new Error('Cannot get result - work "' + workName + '" is not supported.');
        }
        return this.workResult[workName];
    };
    WorkResult.prototype.hasAll = function () {
        var _this = this;
        return this.workDomain.every(function (key) { return _this.has(key); });
    };
    WorkResult.prototype.clear = function () {
        this.workResult = {};
    };
    WorkResult.prototype.reduce = function (reducer, initial) {
        var _this = this;
        return this.workDomain.reduce(function (reduced, workName) {
            return reducer(reduced, _this.workResult[workName]);
        }, initial);
    };
    return WorkResult;
}());
exports.WorkResult = WorkResult;
