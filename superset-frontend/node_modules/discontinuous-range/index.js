//protected helper class
function _SubRange(low, high) {
    this.low = low;
    this.high = high;
    this.length = 1 + high - low;
}

_SubRange.prototype.overlaps = function (range) {
    return !(this.high < range.low || this.low > range.high);
};

_SubRange.prototype.touches = function (range) {
    return !(this.high + 1 < range.low || this.low - 1 > range.high);
};

//returns inclusive combination of _SubRanges as a _SubRange
_SubRange.prototype.add = function (range) {
    return this.touches(range) && new _SubRange(Math.min(this.low, range.low), Math.max(this.high, range.high));
};

//returns subtraction of _SubRanges as an array of _SubRanges (there's a case where subtraction divides it in 2)
_SubRange.prototype.subtract = function (range) {
    if (!this.overlaps(range)) return false;
    if (range.low <= this.low && range.high >= this.high) return [];
    if (range.low > this.low && range.high < this.high) return [new _SubRange(this.low, range.low - 1), new _SubRange(range.high + 1, this.high)];
    if (range.low <= this.low) return [new _SubRange(range.high + 1, this.high)];
    return [new _SubRange(this.low, range.low - 1)];
};

_SubRange.prototype.toString = function () {
    if (this.low == this.high) return this.low.toString();
    return this.low + '-' + this.high;
};

_SubRange.prototype.clone = function () {
    return new _SubRange(this.low, this.high);
};




function DiscontinuousRange(a, b) {
    if (this instanceof DiscontinuousRange) {
        this.ranges = [];
        this.length = 0;
        if (a !== undefined) this.add(a, b);
    } else {
        return new DiscontinuousRange(a, b);
    }
}

function _update_length(self) {
    self.length = self.ranges.reduce(function (previous, range) {return previous + range.length}, 0);
}

DiscontinuousRange.prototype.add = function (a, b) {
    var self = this;
    function _add(subrange) {
        var new_ranges = [];
        var i = 0;
        while (i < self.ranges.length && !subrange.touches(self.ranges[i])) {
            new_ranges.push(self.ranges[i].clone());
            i++;
        }
        while (i < self.ranges.length && subrange.touches(self.ranges[i])) {
            subrange = subrange.add(self.ranges[i]);
            i++;
        }
        new_ranges.push(subrange);
        while (i < self.ranges.length) {
            new_ranges.push(self.ranges[i].clone());
            i++;
        }
        self.ranges = new_ranges;
        _update_length(self);
    }

    if (a instanceof DiscontinuousRange) {
        a.ranges.forEach(_add);
    } else {
        if (a instanceof _SubRange) {
            _add(a);
        } else {
            if (b === undefined) b = a;
            _add(new _SubRange(a, b));
        }
    }
    return this;
};

DiscontinuousRange.prototype.subtract = function (a, b) {
    var self = this;
    function _subtract(subrange) {
        var new_ranges = [];
        var i = 0;
        while (i < self.ranges.length && !subrange.overlaps(self.ranges[i])) {
            new_ranges.push(self.ranges[i].clone());
            i++;
        }
        while (i < self.ranges.length && subrange.overlaps(self.ranges[i])) {
            new_ranges = new_ranges.concat(self.ranges[i].subtract(subrange));
            i++;
        }
        while (i < self.ranges.length) {
            new_ranges.push(self.ranges[i].clone());
            i++;
        }
        self.ranges = new_ranges;
        _update_length(self);
    }
    if (a instanceof DiscontinuousRange) {
        a.ranges.forEach(_subtract);
    } else {
        if (a instanceof _SubRange) {
            _subtract(a);
        } else {
            if (b === undefined) b = a;
            _subtract(new _SubRange(a, b));
        }
    }
    return this;
};


DiscontinuousRange.prototype.index = function (index) {
    var i = 0;
    while (i < this.ranges.length && this.ranges[i].length <= index) {
        index -= this.ranges[i].length;
        i++;
    }
    if (i >= this.ranges.length) return null;
    return this.ranges[i].low + index;
};


DiscontinuousRange.prototype.toString = function () {
    return '[ ' + this.ranges.join(', ') + ' ]'
};

DiscontinuousRange.prototype.clone = function () {
    return new DiscontinuousRange(this);
};

module.exports = DiscontinuousRange;
