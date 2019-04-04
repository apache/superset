"use strict";
/* eslint-disable no-console */

var green = "\u001b[32m";
var white = "\u001b[22m\u001b[39m";
var boldCyan = "\u001b[96m\u001b[1m";
var reset = "\u001b[0m";

var output =
    green +
    "Have some ❤️ for Sinon? You can support the project via Open Collective:" +
    white +
    "\n > " +
    boldCyan +
    "https://opencollective.com/sinon/donate\n" +
    reset;

console.log(output);
