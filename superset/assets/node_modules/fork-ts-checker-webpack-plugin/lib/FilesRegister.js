"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FilesRegister = /** @class */ (function () {
    function FilesRegister(dataFactory) {
        this.files = {};
        this.dataFactory = dataFactory;
    }
    FilesRegister.prototype.keys = function () {
        return Object.keys(this.files);
    };
    FilesRegister.prototype.add = function (filePath) {
        this.files[filePath] = {
            mtime: undefined,
            data: this.dataFactory(undefined)
        };
    };
    FilesRegister.prototype.remove = function (filePath) {
        if (this.has(filePath)) {
            delete this.files[filePath];
        }
    };
    FilesRegister.prototype.has = function (filePath) {
        return this.files.hasOwnProperty(filePath);
    };
    FilesRegister.prototype.get = function (filePath) {
        if (!this.has(filePath)) {
            throw new Error('File "' + filePath + '" not found in register.');
        }
        return this.files[filePath];
    };
    FilesRegister.prototype.ensure = function (filePath) {
        if (!this.has(filePath)) {
            this.add(filePath);
        }
    };
    FilesRegister.prototype.getData = function (filePath) {
        return this.get(filePath).data;
    };
    FilesRegister.prototype.mutateData = function (filePath, mutator) {
        this.ensure(filePath);
        mutator(this.files[filePath].data);
    };
    FilesRegister.prototype.getMtime = function (filePath) {
        return this.get(filePath).mtime;
    };
    FilesRegister.prototype.setMtime = function (filePath, mtime) {
        this.ensure(filePath);
        if (this.files[filePath].mtime !== mtime) {
            this.files[filePath].mtime = mtime;
            // file has been changed - we have to reset data
            this.files[filePath].data = this.dataFactory(this.files[filePath].data);
        }
    };
    return FilesRegister;
}());
exports.FilesRegister = FilesRegister;
