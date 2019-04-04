"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var json_1 = require("./json");
var JsonableValue = (function () {
    function JsonableValue(value) {
        this.value = value;
    }
    Object.defineProperty(JsonableValue.prototype, "value", {
        get: function () {
            return this._value;
        },
        set: function (value) {
            this._value = value;
            this._serialized = json_1.stringify(value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(JsonableValue.prototype, "serialized", {
        get: function () {
            return this._serialized;
        },
        enumerable: true,
        configurable: true
    });
    JsonableValue.prototype.valueOf = function () {
        return this._value;
    };
    JsonableValue.prototype.toString = function () {
        return this._serialized;
    };
    return JsonableValue;
}());
exports.JsonableValue = JsonableValue;
