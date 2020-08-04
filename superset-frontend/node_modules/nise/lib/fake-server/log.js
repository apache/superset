"use strict";
var inspect = require("util").inspect;

function log(response, request) {
    var str;

    str = "Request:\n" + inspect(request) + "\n\n";
    str += "Response:\n" + inspect(response) + "\n\n";

    /* istanbul ignore else: when this.logger is not a function, it can't be called */
    if (typeof this.logger === "function") {
        this.logger(str);
    }
}

module.exports = log;
