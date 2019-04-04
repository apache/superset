
// calculate simplification data using optimized Douglas-Peucker algorithm

export default function simplify(coords, first, last, sqTolerance) {
    var maxSqDist = sqTolerance;
    var mid = (last - first) >> 1;
    var minPosToMid = last - first;
    var index;

    var ax = coords[first];
    var ay = coords[first + 1];
    var bx = coords[last];
    var by = coords[last + 1];

    for (var i = first + 3; i < last; i += 3) {
        var d = getSqSegDist(coords[i], coords[i + 1], ax, ay, bx, by);

        if (d > maxSqDist) {
            index = i;
            maxSqDist = d;

        } else if (d === maxSqDist) {
            // a workaround to ensure we choose a pivot close to the middle of the list,
            // reducing recursion depth, for certain degenerate inputs
            // https://github.com/mapbox/geojson-vt/issues/104
            var posToMid = Math.abs(i - mid);
            if (posToMid < minPosToMid) {
                index = i;
                minPosToMid = posToMid;
            }
        }
    }

    if (maxSqDist > sqTolerance) {
        if (index - first > 3) simplify(coords, first, index, sqTolerance);
        coords[index + 2] = maxSqDist;
        if (last - index > 3) simplify(coords, index, last, sqTolerance);
    }
}

// square distance from a point to a segment
function getSqSegDist(px, py, x, y, bx, by) {

    var dx = bx - x;
    var dy = by - y;

    if (dx !== 0 || dy !== 0) {

        var t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);

        if (t > 1) {
            x = bx;
            y = by;

        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = px - x;
    dy = py - y;

    return dx * dx + dy * dy;
}
