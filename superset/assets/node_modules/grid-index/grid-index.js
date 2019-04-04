'use strict';

module.exports = GridIndex;

var NUM_PARAMS = 3;

function GridIndex(extent, n, padding) {
    var cells = this.cells = [];

    if (extent instanceof ArrayBuffer) {
        this.arrayBuffer = extent;
        var array = new Int32Array(this.arrayBuffer);
        extent = array[0];
        n = array[1];
        padding = array[2];

        this.d = n + 2 * padding;
        for (var k = 0; k < this.d * this.d; k++) {
            var start = array[NUM_PARAMS + k];
            var end = array[NUM_PARAMS + k + 1];
            cells.push(start === end ?
                    null :
                    array.subarray(start, end));
        }
        var keysOffset = array[NUM_PARAMS + cells.length];
        var bboxesOffset = array[NUM_PARAMS + cells.length + 1];
        this.keys = array.subarray(keysOffset, bboxesOffset);
        this.bboxes = array.subarray(bboxesOffset);

        this.insert = this._insertReadonly;

    } else {
        this.d = n + 2 * padding;
        for (var i = 0; i < this.d * this.d; i++) {
            cells.push([]);
        }
        this.keys = [];
        this.bboxes = [];
    }

    this.n = n;
    this.extent = extent;
    this.padding = padding;
    this.scale = n / extent;
    this.uid = 0;

    var p = (padding / n) * extent;
    this.min = -p;
    this.max = extent + p;
}


GridIndex.prototype.insert = function(key, x1, y1, x2, y2) {
    this._forEachCell(x1, y1, x2, y2, this._insertCell, this.uid++);
    this.keys.push(key);
    this.bboxes.push(x1);
    this.bboxes.push(y1);
    this.bboxes.push(x2);
    this.bboxes.push(y2);
};

GridIndex.prototype._insertReadonly = function() {
    throw 'Cannot insert into a GridIndex created from an ArrayBuffer.';
};

GridIndex.prototype._insertCell = function(x1, y1, x2, y2, cellIndex, uid) {
    this.cells[cellIndex].push(uid);
};

GridIndex.prototype.query = function(x1, y1, x2, y2, intersectionTest) {
    var min = this.min;
    var max = this.max;
    if (x1 <= min && y1 <= min && max <= x2 && max <= y2 && !intersectionTest) {
        // We use `Array#slice` because `this.keys` may be a `Int32Array` and
        // some browsers (Safari and IE) do not support `TypedArray#slice`
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/slice#Browser_compatibility
        return Array.prototype.slice.call(this.keys);

    } else {
        var result = [];
        var seenUids = {};
        this._forEachCell(x1, y1, x2, y2, this._queryCell, result, seenUids, intersectionTest);
        return result;
    }
};

GridIndex.prototype._queryCell = function(x1, y1, x2, y2, cellIndex, result, seenUids, intersectionTest) {
    var cell = this.cells[cellIndex];
    if (cell !== null) {
        var keys = this.keys;
        var bboxes = this.bboxes;
        for (var u = 0; u < cell.length; u++) {
            var uid = cell[u];
            if (seenUids[uid] === undefined) {
                var offset = uid * 4;
                if (intersectionTest ?
                    intersectionTest(bboxes[offset + 0], bboxes[offset + 1], bboxes[offset + 2], bboxes[offset + 3]) :
                    ((x1 <= bboxes[offset + 2]) &&
                    (y1 <= bboxes[offset + 3]) &&
                    (x2 >= bboxes[offset + 0]) &&
                    (y2 >= bboxes[offset + 1]))) {
                    seenUids[uid] = true;
                    result.push(keys[uid]);
                } else {
                    seenUids[uid] = false;
                }
            }
        }
    }
};

GridIndex.prototype._forEachCell = function(x1, y1, x2, y2, fn, arg1, arg2, intersectionTest) {
    var cx1 = this._convertToCellCoord(x1);
    var cy1 = this._convertToCellCoord(y1);
    var cx2 = this._convertToCellCoord(x2);
    var cy2 = this._convertToCellCoord(y2);
    for (var x = cx1; x <= cx2; x++) {
        for (var y = cy1; y <= cy2; y++) {
            var cellIndex = this.d * y + x;
            if (intersectionTest && !intersectionTest(
                        this._convertFromCellCoord(x),
                        this._convertFromCellCoord(y),
                        this._convertFromCellCoord(x + 1),
                        this._convertFromCellCoord(y + 1))) continue;
            if (fn.call(this, x1, y1, x2, y2, cellIndex, arg1, arg2, intersectionTest)) return;
        }
    }
};

GridIndex.prototype._convertFromCellCoord = function(x) {
    return (x - this.padding) / this.scale;
};

GridIndex.prototype._convertToCellCoord = function(x) {
    return Math.max(0, Math.min(this.d - 1, Math.floor(x * this.scale) + this.padding));
};

GridIndex.prototype.toArrayBuffer = function() {
    if (this.arrayBuffer) return this.arrayBuffer;

    var cells = this.cells;

    var metadataLength = NUM_PARAMS + this.cells.length + 1 + 1;
    var totalCellLength = 0;
    for (var i = 0; i < this.cells.length; i++) {
        totalCellLength += this.cells[i].length;
    }

    var array = new Int32Array(metadataLength + totalCellLength + this.keys.length + this.bboxes.length);
    array[0] = this.extent;
    array[1] = this.n;
    array[2] = this.padding;

    var offset = metadataLength;
    for (var k = 0; k < cells.length; k++) {
        var cell = cells[k];
        array[NUM_PARAMS + k] = offset;
        array.set(cell, offset);
        offset += cell.length;
    }

    array[NUM_PARAMS + cells.length] = offset;
    array.set(this.keys, offset);
    offset += this.keys.length;

    array[NUM_PARAMS + cells.length + 1] = offset;
    array.set(this.bboxes, offset);
    offset += this.bboxes.length;

    return array.buffer;
};
