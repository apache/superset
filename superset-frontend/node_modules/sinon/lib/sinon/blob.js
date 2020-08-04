"use strict";

exports.isSupported = (function() {
    try {
        return Boolean(new Blob());
    } catch (e) {
        return false;
    }
})();
