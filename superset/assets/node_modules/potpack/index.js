(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
typeof define === 'function' && define.amd ? define(factory) :
(global.potpack = factory());
}(this, (function () { 'use strict';

function potpack(boxes) {

    // calculate total box area and maximum box width
    var area = 0;
    var maxWidth = 0;

    for (var i$1 = 0, list = boxes; i$1 < list.length; i$1 += 1) {
        var box = list[i$1];

        area += box.w * box.h;
        maxWidth = Math.max(maxWidth, box.w);
    }

    // sort the boxes for insertion by height, descending
    boxes.sort(function (a, b) { return b.h - a.h; });

    // aim for a squarish resulting container,
    // slightly adjusted for sub-100% space utilization
    var startWidth = Math.max(Math.ceil(Math.sqrt(area / 0.95)), maxWidth);

    // start with a single empty space, unbounded at the bottom
    var spaces = [{x: 0, y: 0, w: startWidth, h: Infinity}];

    var width = 0;
    var height = 0;

    for (var i$2 = 0, list$1 = boxes; i$2 < list$1.length; i$2 += 1) {
        // look through spaces backwards so that we check smaller spaces first
        var box$1 = list$1[i$2];

        for (var i = spaces.length - 1; i >= 0; i--) {
            var space = spaces[i];

            // look for empty spaces that can accommodate the current box
            if (box$1.w > space.w || box$1.h > space.h) { continue; }

            // found the space; add the box to its top-left corner
            // |-------|-------|
            // |  box  |       |
            // |_______|       |
            // |         space |
            // |_______________|
            box$1.x = space.x;
            box$1.y = space.y;

            height = Math.max(height, box$1.y + box$1.h);
            width = Math.max(width, box$1.x + box$1.w);

            if (box$1.w === space.w && box$1.h === space.h) {
                // space matches the box exactly; remove it
                var last = spaces.pop();
                if (i < spaces.length) { spaces[i] = last; }

            } else if (box$1.h === space.h) {
                // space matches the box height; update it accordingly
                // |-------|---------------|
                // |  box  | updated space |
                // |_______|_______________|
                space.x += box$1.w;
                space.w -= box$1.w;

            } else if (box$1.w === space.w) {
                // space matches the box width; update it accordingly
                // |---------------|
                // |      box      |
                // |_______________|
                // | updated space |
                // |_______________|
                space.y += box$1.h;
                space.h -= box$1.h;

            } else {
                // otherwise the box splits the space into two spaces
                // |-------|-----------|
                // |  box  | new space |
                // |_______|___________|
                // | updated space     |
                // |___________________|
                spaces.push({
                    x: space.x + box$1.w,
                    y: space.y,
                    w: space.w - box$1.w,
                    h: box$1.h
                });
                space.y += box$1.h;
                space.h -= box$1.h;
            }
            break;
        }
    }

    return {
        w: width, // container width
        h: height, // container height
        fill: (area / (width * height)) || 0 // space utilization
    };
}

return potpack;

})));
