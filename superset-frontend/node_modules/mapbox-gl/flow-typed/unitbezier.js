declare module "unitbezier" {
    declare class UnitBezier {
        constructor(p1x: number, p1y: number, p2x: number, p2y: number): UnitBezier;
        sampleCurveX(t: number): number;
        sampleCurveY(t: number): number;
        sampleCurveDerivativeX(t: number): number;
        solveCurveX(t: number): number;
        solve(x: number, epsilon?: number): number;
    }
    declare module.exports: typeof UnitBezier;
}
