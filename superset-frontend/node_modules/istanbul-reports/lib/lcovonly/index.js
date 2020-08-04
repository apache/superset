/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
'use strict';
const { ReportBase } = require('istanbul-lib-report');

class LcovOnlyReport extends ReportBase {
    constructor(opts) {
        super();
        this.file = opts.file || 'lcov.info';
        this.projectRoot = opts.projectRoot || process.cwd();
        this.contentWriter = null;
    }

    onStart(root, context) {
        this.contentWriter = context.writer.writeFile(this.file);
    }

    onDetail(node) {
        const fc = node.getFileCoverage();
        const writer = this.contentWriter;
        const functions = fc.f;
        const functionMap = fc.fnMap;
        const lines = fc.getLineCoverage();
        const branches = fc.b;
        const branchMap = fc.branchMap;
        const summary = node.getCoverageSummary();
        const path = require('path');

        writer.println('TN:'); //no test nam
        writer.println('SF:' + path.relative(this.projectRoot, fc.path));

        Object.values(functionMap).forEach(meta => {
            writer.println('FN:' + [meta.decl.start.line, meta.name].join(','));
        });
        writer.println('FNF:' + summary.functions.total);
        writer.println('FNH:' + summary.functions.covered);

        Object.entries(functionMap).forEach(([key, meta]) => {
            const stats = functions[key];
            writer.println('FNDA:' + [stats, meta.name].join(','));
        });

        Object.entries(lines).forEach(entry => {
            writer.println('DA:' + entry.join(','));
        });
        writer.println('LF:' + summary.lines.total);
        writer.println('LH:' + summary.lines.covered);

        Object.entries(branches).forEach(([key, branchArray]) => {
            const meta = branchMap[key];
            const { line } = meta.loc.start;
            branchArray.forEach((b, i) => {
                writer.println('BRDA:' + [line, key, i, b].join(','));
            });
        });
        writer.println('BRF:' + summary.branches.total);
        writer.println('BRH:' + summary.branches.covered);
        writer.println('end_of_record');
    }

    onEnd() {
        this.contentWriter.close();
    }
}

module.exports = LcovOnlyReport;
