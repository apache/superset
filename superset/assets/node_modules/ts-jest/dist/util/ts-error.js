"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var make_error_1 = require("make-error");
var util_1 = require("util");
var logger_1 = require("./logger");
var messages_1 = require("./messages");
var logger = logger_1.rootLogger.child({ namespace: 'TSError' });
exports.INSPECT_CUSTOM = util_1.inspect.custom || 'inspect';
var TSError = (function (_super) {
    __extends(TSError, _super);
    function TSError(diagnosticText, diagnosticCodes) {
        var _this = _super.call(this, messages_1.interpolate(messages_1.Errors.UnableToCompileTypeScript, {
            diagnostics: diagnosticText.trim(),
            help: messages_1.Helps.IgnoreDiagnosticCode,
        })) || this;
        _this.diagnosticText = diagnosticText;
        _this.diagnosticCodes = diagnosticCodes;
        _this.name = 'TSError';
        logger.debug({ diagnosticCodes: diagnosticCodes, diagnosticText: diagnosticText }, 'created new TSError');
        Object.defineProperty(_this, 'stack', { value: '' });
        return _this;
    }
    TSError.prototype[exports.INSPECT_CUSTOM] = function () {
        return this.diagnosticText;
    };
    return TSError;
}(make_error_1.BaseError));
exports.TSError = TSError;
