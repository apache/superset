var test = require('tap').test,
    UnitBezier = require('../');

test('unit bezier', function(t) {
    var u = new UnitBezier(0, 0, 1, 1);
    t.equal(u.sampleCurveY(1), 1, 'sampleCurveY');
    t.equal(u.sampleCurveX(1), 1, 'sampleCurveX');
    t.equal(u.sampleCurveDerivativeX(0.1), 0.54, 'sampleCurveDerivativeX');
    t.equal(u.solveCurveX(0), 0, 'solveCurveX');
    t.equal(u.solveCurveX(1), 1, 'solveCurveX');
    t.equal(u.solveCurveX(1.25552, 1.e-8), 1, 'solveCurveX');
    t.equal(u.solveCurveX(1, 1e-8), 1, 'solveCurveX');
    t.equal(u.solveCurveX(0.5), 0.5, 'solveCurveX');
    t.equal(u.solve(0.5), 0.5, 'solve');
    t.end();
});
