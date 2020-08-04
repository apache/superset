"use strict";

module.exports = function toString() {
    var i, prop, thisValue;
    if (this.getCall && this.callCount) {
        i = this.callCount;

        while (i--) {
            thisValue = this.getCall(i).thisValue;

            // eslint-disable-next-line guard-for-in
            for (prop in thisValue) {
                try {
                    if (thisValue[prop] === this) {
                        return prop;
                    }
                } catch (e) {
                    // no-op - accessing props can throw an error, nothing to do here
                }
            }
        }
    }

    return this.displayName || "sinon fake";
};
