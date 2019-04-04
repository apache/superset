declare module "@mapbox/point-geometry" {
    declare type PointLike = Point | [number, number];

    declare class Point {
        x: number;
        y: number;
        constructor(x: number, y: number): Point;
        clone(): Point;
        add(point: Point): Point;
        sub(point: Point): Point;
        multByPoint(point: Point): Point;
        divByPoint(point: Point): Point;
        mult(k: number): Point;
        div(k: number): Point;
        rotate(angle: number): Point;
        rotateAround(angle: number, point: Point): Point;
        matMult(matrix: [number, number, number, number]): Point;
        unit(): Point;
        perp(): Point;
        round(): Point;
        mag(): number;
        equals(point: Point): boolean;
        dist(point: Point): number;
        distSqr(point: Point): number;
        angle(): number;
        angleTo(point: Point): number;
        angleWith(point: Point): number;
        angleWithSep(x: number, y: number): number;
        _matMult(matrix: [number, number, number, number]): Point;
        _add(point: Point): Point;
        _sub(point: Point): Point;
        _mult(k: number): Point;
        _div(k: number): Point;
        _multByPoint(point: Point): Point;
        _divByPoint(point: Point): Point;
        _unit(): Point;
        _perp(): Point;
        _rotate(angle: number): Point;
        _rotateAround(angle: number, point: Point): Point;
        _round(): Point;
        static convert(a: PointLike): Point;
    }
    declare module.exports: typeof Point;
}
