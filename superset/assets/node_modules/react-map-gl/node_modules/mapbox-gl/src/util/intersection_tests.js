// @flow

import { isCounterClockwise } from './util';

import type Point from '@mapbox/point-geometry';

export { multiPolygonIntersectsBufferedPoint, multiPolygonIntersectsBufferedMultiPoint, multiPolygonIntersectsMultiPolygon, multiPolygonIntersectsBufferedMultiLine, polygonIntersectsPolygon, distToSegmentSquared };

type Line = Array<Point>;
type MultiLine = Array<Line>;
type Ring = Array<Point>;
type Polygon = Array<Point>;
type MultiPolygon = Array<Polygon>;

function polygonIntersectsPolygon(polygonA: Polygon, polygonB: Polygon) {
    for (let i = 0; i < polygonA.length; i++) {
        if (polygonContainsPoint(polygonB, polygonA[i])) return true;
    }

    for (let i = 0; i < polygonB.length; i++) {
        if (polygonContainsPoint(polygonA, polygonB[i])) return true;
    }

    if (lineIntersectsLine(polygonA, polygonB)) return true;

    return false;
}

function multiPolygonIntersectsBufferedPoint(multiPolygon: MultiPolygon, point: Point, radius: number) {
    for (let j = 0; j < multiPolygon.length; j++) {
        const polygon = multiPolygon[j];
        if (polygonContainsPoint(polygon, point)) return true;
        if (pointIntersectsBufferedLine(point, polygon, radius)) return true;
    }
    return false;
}

function multiPolygonIntersectsBufferedMultiPoint(multiPolygon: MultiPolygon, rings: Array<Ring>, radius: number) {
    for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        for (let k = 0; k < ring.length; k++) {
            if (multiPolygonIntersectsBufferedPoint(multiPolygon, ring[k], radius)) return true;
        }
    }
    return false;
}

function multiPolygonIntersectsMultiPolygon(multiPolygonA: MultiPolygon, multiPolygonB: MultiPolygon) {

    if (multiPolygonA.length === 1 && multiPolygonA[0].length === 1) {
        return multiPolygonContainsPoint(multiPolygonB, multiPolygonA[0][0]);
    }

    for (let m = 0; m < multiPolygonB.length; m++) {
        const ring = multiPolygonB[m];
        for (let n = 0; n < ring.length; n++) {
            if (multiPolygonContainsPoint(multiPolygonA, ring[n])) return true;
        }
    }

    for (let j = 0; j < multiPolygonA.length; j++) {
        const polygon = multiPolygonA[j];
        for (let i = 0; i < polygon.length; i++) {
            if (multiPolygonContainsPoint(multiPolygonB, polygon[i])) return true;
        }

        for (let k = 0; k < multiPolygonB.length; k++) {
            if (lineIntersectsLine(polygon, multiPolygonB[k])) return true;
        }
    }

    return false;
}

function multiPolygonIntersectsBufferedMultiLine(multiPolygon: MultiPolygon, multiLine: MultiLine, radius: number) {
    for (let i = 0; i < multiLine.length; i++) {
        const line = multiLine[i];

        for (let j = 0; j < multiPolygon.length; j++) {
            const polygon = multiPolygon[j];

            if (polygon.length >= 3) {
                for (let k = 0; k < line.length; k++) {
                    if (polygonContainsPoint(polygon, line[k])) return true;
                }
            }

            if (lineIntersectsBufferedLine(polygon, line, radius)) return true;
        }
    }
    return false;
}

function lineIntersectsBufferedLine(lineA: Line, lineB: Line, radius: number) {

    if (lineA.length > 1) {
        if (lineIntersectsLine(lineA, lineB)) return true;

        // Check whether any point in either line is within radius of the other line
        for (let j = 0; j < lineB.length; j++) {
            if (pointIntersectsBufferedLine(lineB[j], lineA, radius)) return true;
        }
    }

    for (let k = 0; k < lineA.length; k++) {
        if (pointIntersectsBufferedLine(lineA[k], lineB, radius)) return true;
    }

    return false;
}

function lineIntersectsLine(lineA: Line, lineB: Line) {
    if (lineA.length === 0 || lineB.length === 0) return false;
    for (let i = 0; i < lineA.length - 1; i++) {
        const a0 = lineA[i];
        const a1 = lineA[i + 1];
        for (let j = 0; j < lineB.length - 1; j++) {
            const b0 = lineB[j];
            const b1 = lineB[j + 1];
            if (lineSegmentIntersectsLineSegment(a0, a1, b0, b1)) return true;
        }
    }
    return false;
}

function lineSegmentIntersectsLineSegment(a0: Point, a1: Point, b0: Point, b1: Point) {
    return isCounterClockwise(a0, b0, b1) !== isCounterClockwise(a1, b0, b1) &&
        isCounterClockwise(a0, a1, b0) !== isCounterClockwise(a0, a1, b1);
}

function pointIntersectsBufferedLine(p: Point, line: Line, radius: number) {
    const radiusSquared = radius * radius;

    if (line.length === 1) return p.distSqr(line[0]) < radiusSquared;

    for (let i = 1; i < line.length; i++) {
        // Find line segments that have a distance <= radius^2 to p
        // In that case, we treat the line as "containing point p".
        const v = line[i - 1], w = line[i];
        if (distToSegmentSquared(p, v, w) < radiusSquared) return true;
    }
    return false;
}

// Code from http://stackoverflow.com/a/1501725/331379.
function distToSegmentSquared(p: Point, v: Point, w: Point) {
    const l2 = v.distSqr(w);
    if (l2 === 0) return p.distSqr(v);
    const t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    if (t < 0) return p.distSqr(v);
    if (t > 1) return p.distSqr(w);
    return p.distSqr(w.sub(v)._mult(t)._add(v));
}

// point in polygon ray casting algorithm
function multiPolygonContainsPoint(rings: Array<Ring>, p: Point) {
    let c = false,
        ring, p1, p2;

    for (let k = 0; k < rings.length; k++) {
        ring = rings[k];
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            p1 = ring[i];
            p2 = ring[j];
            if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
                c = !c;
            }
        }
    }
    return c;
}

function polygonContainsPoint(ring: Ring, p: Point) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const p1 = ring[i];
        const p2 = ring[j];
        if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
            c = !c;
        }
    }
    return c;
}
