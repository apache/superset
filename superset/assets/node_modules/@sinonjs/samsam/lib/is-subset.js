"use strict";

function isSubset(s1, s2, compare) {
    var allContained = true;
    s1.forEach(function(v1) {
        var includes = false;
        s2.forEach(function(v2) {
            if (compare(v2, v1)) {
                includes = true;
            }
        });
        allContained = allContained && includes;
    });

    return allContained;
}

module.exports = isSubset;
