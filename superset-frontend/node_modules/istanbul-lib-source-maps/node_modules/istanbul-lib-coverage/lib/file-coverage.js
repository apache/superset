/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
'use strict';

const percent = require('./percent');
const dataProperties = require('./data-properties');
const { CoverageSummary } = require('./coverage-summary');

// returns a data object that represents empty coverage
function emptyCoverage(filePath) {
    return {
        path: filePath,
        statementMap: {},
        fnMap: {},
        branchMap: {},
        s: {},
        f: {},
        b: {}
    };
}

// asserts that a data object "looks like" a coverage object
function assertValidObject(obj) {
    const valid =
        obj &&
        obj.path &&
        obj.statementMap &&
        obj.fnMap &&
        obj.branchMap &&
        obj.s &&
        obj.f &&
        obj.b;
    if (!valid) {
        throw new Error(
            'Invalid file coverage object, missing keys, found:' +
                Object.keys(obj).join(',')
        );
    }
}

/**
 * provides a read-only view of coverage for a single file.
 * The deep structure of this object is documented elsewhere. It has the following
 * properties:
 *
 * * `path` - the file path for which coverage is being tracked
 * * `statementMap` - map of statement locations keyed by statement index
 * * `fnMap` - map of function metadata keyed by function index
 * * `branchMap` - map of branch metadata keyed by branch index
 * * `s` - hit counts for statements
 * * `f` - hit count for functions
 * * `b` - hit count for branches
 */
class FileCoverage {
    /**
     * @constructor
     * @param {Object|FileCoverage|String} pathOrObj is a string that initializes
     * and empty coverage object with the specified file path or a data object that
     * has all the required properties for a file coverage object.
     */
    constructor(pathOrObj) {
        if (!pathOrObj) {
            throw new Error(
                'Coverage must be initialized with a path or an object'
            );
        }
        if (typeof pathOrObj === 'string') {
            this.data = emptyCoverage(pathOrObj);
        } else if (pathOrObj instanceof FileCoverage) {
            this.data = pathOrObj.data;
        } else if (typeof pathOrObj === 'object') {
            this.data = pathOrObj;
        } else {
            throw new Error('Invalid argument to coverage constructor');
        }
        assertValidObject(this.data);
    }

    /**
     * returns computed line coverage from statement coverage.
     * This is a map of hits keyed by line number in the source.
     */
    getLineCoverage() {
        const statementMap = this.data.statementMap;
        const statements = this.data.s;
        const lineMap = Object.create(null);

        Object.entries(statements).forEach(([st, count]) => {
            /* istanbul ignore if: is this even possible? */
            if (!statementMap[st]) {
                return;
            }
            const { line } = statementMap[st].start;
            const prevVal = lineMap[line];
            if (prevVal === undefined || prevVal < count) {
                lineMap[line] = count;
            }
        });
        return lineMap;
    }

    /**
     * returns an array of uncovered line numbers.
     * @returns {Array} an array of line numbers for which no hits have been
     *  collected.
     */
    getUncoveredLines() {
        const lc = this.getLineCoverage();
        const ret = [];
        Object.entries(lc).forEach(([l, hits]) => {
            if (hits === 0) {
                ret.push(l);
            }
        });
        return ret;
    }

    /**
     * returns a map of branch coverage by source line number.
     * @returns {Object} an object keyed by line number. Each object
     * has a `covered`, `total` and `coverage` (percentage) property.
     */
    getBranchCoverageByLine() {
        const branchMap = this.branchMap;
        const branches = this.b;
        const ret = {};
        Object.entries(branchMap).forEach(([k, map]) => {
            const line = map.line || map.loc.start.line;
            const branchData = branches[k];
            ret[line] = ret[line] || [];
            ret[line].push(...branchData);
        });
        Object.entries(ret).forEach(([k, dataArray]) => {
            const covered = dataArray.filter(item => item > 0);
            const coverage = (covered.length / dataArray.length) * 100;
            ret[k] = {
                covered: covered.length,
                total: dataArray.length,
                coverage
            };
        });
        return ret;
    }

    /**
     * return a JSON-serializable POJO for this file coverage object
     */
    toJSON() {
        return this.data;
    }

    /**
     * merges a second coverage object into this one, updating hit counts
     * @param {FileCoverage} other - the coverage object to be merged into this one.
     *  Note that the other object should have the same structure as this one (same file).
     */
    merge(other) {
        if (other.all === true) {
            return;
        }

        if (this.all === true) {
            this.data = other.data;
            return;
        }

        Object.entries(other.s).forEach(([k, v]) => {
            this.data.s[k] += v;
        });
        Object.entries(other.f).forEach(([k, v]) => {
            this.data.f[k] += v;
        });
        Object.entries(other.b).forEach(([k, v]) => {
            let i;
            const retArray = this.data.b[k];
            /* istanbul ignore if: is this even possible? */
            if (!retArray) {
                this.data.b[k] = v;
                return;
            }
            for (i = 0; i < retArray.length; i += 1) {
                retArray[i] += v[i];
            }
        });
    }

    computeSimpleTotals(property) {
        let stats = this[property];

        if (typeof stats === 'function') {
            stats = stats.call(this);
        }

        const ret = {
            total: Object.keys(stats).length,
            covered: Object.values(stats).filter(v => !!v).length,
            skipped: 0
        };
        ret.pct = percent(ret.covered, ret.total);
        return ret;
    }

    computeBranchTotals() {
        const stats = this.b;
        const ret = { total: 0, covered: 0, skipped: 0 };

        Object.values(stats).forEach(branches => {
            ret.covered += branches.filter(hits => hits > 0).length;
            ret.total += branches.length;
        });
        ret.pct = percent(ret.covered, ret.total);
        return ret;
    }

    /**
     * resets hit counts for all statements, functions and branches
     * in this coverage object resulting in zero coverage.
     */
    resetHits() {
        const statements = this.s;
        const functions = this.f;
        const branches = this.b;
        Object.keys(statements).forEach(s => {
            statements[s] = 0;
        });
        Object.keys(functions).forEach(f => {
            functions[f] = 0;
        });
        Object.keys(branches).forEach(b => {
            branches[b].fill(0);
        });
    }

    /**
     * returns a CoverageSummary for this file coverage object
     * @returns {CoverageSummary}
     */
    toSummary() {
        const ret = {};
        ret.lines = this.computeSimpleTotals('getLineCoverage');
        ret.functions = this.computeSimpleTotals('f', 'fnMap');
        ret.statements = this.computeSimpleTotals('s', 'statementMap');
        ret.branches = this.computeBranchTotals();
        return new CoverageSummary(ret);
    }
}

// expose coverage data attributes
dataProperties(FileCoverage, [
    'path',
    'statementMap',
    'fnMap',
    'branchMap',
    's',
    'f',
    'b',
    'all'
]);

module.exports = {
    FileCoverage
};
