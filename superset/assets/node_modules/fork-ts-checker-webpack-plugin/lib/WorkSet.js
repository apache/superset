"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var WorkSet = /** @class */ (function () {
    function WorkSet(workDomain, workNumber, workDivision) {
        this.workDomain = workDomain;
        this.workNumber = workNumber;
        this.workDivision = workDivision;
        this.workSize = Math.floor(this.workDomain.length / this.workDivision);
        this.workBegin = this.workNumber * this.workSize;
        this.workEnd = this.workBegin + this.workSize;
        // be sure that we will process all work for odd workSize.
        if (this.workNumber === this.workDivision - 1) {
            this.workEnd = this.workDomain.length;
        }
    }
    WorkSet.prototype.forEach = function (callback) {
        for (var i = this.workBegin; i < this.workEnd; ++i) {
            callback(this.workDomain[i], i);
        }
    };
    return WorkSet;
}());
exports.WorkSet = WorkSet;
