'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
var Sort = {
    Numeric: function Numeric(a, b) {
        var valA = parseFloat(a.toString().replace(/,/g, ''));
        var valB = parseFloat(b.toString().replace(/,/g, ''));

        // Sort non-numeric values alphabetically at the bottom of the list
        if (isNaN(valA) && isNaN(valB)) {
            valA = a;
            valB = b;
        } else {
            if (isNaN(valA)) {
                return 1;
            }
            if (isNaN(valB)) {
                return -1;
            }
        }

        if (valA < valB) {
            return -1;
        }
        if (valA > valB) {
            return 1;
        }

        return 0;
    },

    NumericInteger: function NumericInteger(a, b) {
        if (isNaN(a) || isNaN(b)) {
            return a > b ? 1 : -1;
        }

        return a - b;
    },

    Currency: function Currency(a, b) {
        // Parse out dollar signs, then do a regular numeric sort
        a = a.replace(/[^0-9\.\-\,]+/g, '');
        b = b.replace(/[^0-9\.\-\,]+/g, '');

        return exports.Sort.Numeric(a, b);
    },

    Date: (function (_Date) {
        function Date(_x, _x2) {
            return _Date.apply(this, arguments);
        }

        Date.toString = function () {
            return _Date.toString();
        };

        return Date;
    })(function (a, b) {
        // Note: this function tries to do a standard javascript string -> date conversion
        // If you need more control over the date string format, consider using a different
        // date library and writing your own function
        var valA = Date.parse(a);
        var valB = Date.parse(b);

        // Handle non-date values with numeric sort
        // Sort non-numeric values alphabetically at the bottom of the list
        if (isNaN(valA) || isNaN(valB)) {
            return exports.Sort.Numeric(a, b);
        }

        if (valA > valB) {
            return 1;
        }
        if (valB > valA) {
            return -1;
        }

        return 0;
    }),

    CaseInsensitive: function CaseInsensitive(a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
    }
};
exports.Sort = Sort;
