"use strict";

module.exports = function functionName(func) {
    return (
        func.displayName ||
        func.name ||
        // Use function decomposition as a last resort to get function
        // name. Does not rely on function decomposition to work - if it
        // doesn't debugging will be slightly less informative
        // (i.e. toString will say 'spy' rather than 'myFunc').
        (String(func).match(/function ([^\s(]+)/) || [])[1]
    );
};
