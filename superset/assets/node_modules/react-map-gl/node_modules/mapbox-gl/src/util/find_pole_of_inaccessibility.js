// @flow

import Queue from 'tinyqueue';

import Point from '@mapbox/point-geometry';
import { distToSegmentSquared } from './intersection_tests';

/**
 * Finds an approximation of a polygon's Pole Of Inaccessibiliy https://en.wikipedia.org/wiki/Pole_of_inaccessibility
 * This is a copy of http://github.com/mapbox/polylabel adapted to use Points
 *
 * @param polygonRings first item in array is the outer ring followed optionally by the list of holes, should be an element of the result of util/classify_rings
 * @param precision Specified in input coordinate units. If 0 returns after first run, if > 0 repeatedly narrows the search space until the radius of the area searched for the best pole is less than precision
 * @param debug Print some statistics to the console during execution
 * @returns Pole of Inaccessibiliy.
 * @private
 */
export default function (polygonRings: Array<Array<Point>>, precision?: number = 1, debug?: boolean = false): Point {
    // find the bounding box of the outer ring
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const outerRing = polygonRings[0];
    for (let i = 0; i < outerRing.length; i++) {
        const p = outerRing[i];
        if (!i || p.x < minX) minX = p.x;
        if (!i || p.y < minY) minY = p.y;
        if (!i || p.x > maxX) maxX = p.x;
        if (!i || p.y > maxY) maxY = p.y;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const cellSize = Math.min(width, height);
    let h = cellSize / 2;

    // a priority queue of cells in order of their "potential" (max distance to polygon)
    const cellQueue = new Queue(null, compareMax);

    if (cellSize === 0) return new Point(minX, minY);

    // cover polygon with initial cells
    for (let x = minX; x < maxX; x += cellSize) {
        for (let y = minY; y < maxY; y += cellSize) {
            cellQueue.push(new Cell(x + h, y + h, h, polygonRings));
        }
    }

    // take centroid as the first best guess
    let bestCell = getCentroidCell(polygonRings);
    let numProbes = cellQueue.length;

    while (cellQueue.length) {
        // pick the most promising cell from the queue
        const cell = cellQueue.pop();

        // update the best cell if we found a better one
        if (cell.d > bestCell.d || !bestCell.d) {
            bestCell = cell;
            if (debug) console.log('found best %d after %d probes', Math.round(1e4 * cell.d) / 1e4, numProbes);
        }

        // do not drill down further if there's no chance of a better solution
        if (cell.max - bestCell.d <= precision) continue;

        // split the cell into four cells
        h = cell.h / 2;
        cellQueue.push(new Cell(cell.p.x - h, cell.p.y - h, h, polygonRings));
        cellQueue.push(new Cell(cell.p.x + h, cell.p.y - h, h, polygonRings));
        cellQueue.push(new Cell(cell.p.x - h, cell.p.y + h, h, polygonRings));
        cellQueue.push(new Cell(cell.p.x + h, cell.p.y + h, h, polygonRings));
        numProbes += 4;
    }

    if (debug) {
        console.log(`num probes: ${numProbes}`);
        console.log(`best distance: ${bestCell.d}`);
    }

    return bestCell.p;
}

function compareMax(a, b) {
    return b.max - a.max;
}

function Cell(x, y, h, polygon) {
    this.p = new Point(x, y);
    this.h = h; // half the cell size
    this.d = pointToPolygonDist(this.p, polygon); // distance from cell center to polygon
    this.max = this.d + this.h * Math.SQRT2; // max distance to polygon within a cell
}

// signed distance from point to polygon outline (negative if point is outside)
function pointToPolygonDist(p, polygon) {
    let inside = false;
    let minDistSq = Infinity;

    for (let k = 0; k < polygon.length; k++) {
        const ring = polygon[k];

        for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
            const a = ring[i];
            const b = ring[j];

            if ((a.y > p.y !== b.y > p.y) &&
                (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;

            minDistSq = Math.min(minDistSq, distToSegmentSquared(p, a, b));
        }
    }

    return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}

// get polygon centroid
function getCentroidCell(polygon) {
    let area = 0;
    let x = 0;
    let y = 0;
    const points = polygon[0];
    for (let i = 0, len = points.length, j = len - 1; i < len; j = i++) {
        const a = points[i];
        const b = points[j];
        const f = a.x * b.y - b.x * a.y;
        x += (a.x + b.x) * f;
        y += (a.y + b.y) * f;
        area += f * 3;
    }
    return new Cell(x / area, y / area, 0, polygon);
}
