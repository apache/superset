"use strict"

var semver = require("semver");

if (semver.satisfies(process.version, ">=10")) {
    var Console = require("console").Console;
    global.console = new Console({
        stdout: process.stdout,
        stderr: process.stderr,
        colorMode: false
    });
}

