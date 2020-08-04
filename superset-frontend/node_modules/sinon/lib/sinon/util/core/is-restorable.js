"use strict";

function isRestorable(obj) {
    return typeof obj === "function" && typeof obj.restore === "function" && obj.restore.sinon;
}

module.exports = isRestorable;
