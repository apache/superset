// @flow

import Point from '@mapbox/point-geometry';

import * as intersectionTests from '../util/intersection_tests';
import Grid from './grid_index';
import { mat4 } from 'gl-matrix';

import * as projection from '../symbol/projection';

import type Transform from '../geo/transform';
import type {SingleCollisionBox} from '../data/bucket/symbol_bucket';
import type {
    GlyphOffsetArray,
    SymbolLineVertexArray
} from '../data/array_types';

// When a symbol crosses the edge that causes it to be included in
// collision detection, it will cause changes in the symbols around
// it. This constant specifies how many pixels to pad the edge of
// the viewport for collision detection so that the bulk of the changes
// occur offscreen. Making this constant greater increases label
// stability, but it's expensive.
const viewportPadding = 100;

/**
 * A collision index used to prevent symbols from overlapping. It keep tracks of
 * where previous symbols have been placed and is used to check if a new
 * symbol overlaps with any previously added symbols.
 *
 * There are two steps to insertion: first placeCollisionBox/Circles checks if
 * there's room for a symbol, then insertCollisionBox/Circles actually puts the
 * symbol in the index. The two step process allows paired symbols to be inserted
 * together even if they overlap.
 *
 * @private
 */
class CollisionIndex {
    grid: Grid;
    ignoredGrid: Grid;
    transform: Transform;
    pitchfactor: number;
    screenRightBoundary: number;
    screenBottomBoundary: number;
    gridRightBoundary: number;
    gridBottomBoundary: number;

    constructor(
        transform: Transform,
        grid: Grid = new Grid(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25),
        ignoredGrid: Grid = new Grid(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25)
    ) {
        this.transform = transform;

        this.grid = grid;
        this.ignoredGrid = ignoredGrid;
        this.pitchfactor = Math.cos(transform._pitch) * transform.cameraToCenterDistance;

        this.screenRightBoundary = transform.width + viewportPadding;
        this.screenBottomBoundary = transform.height + viewportPadding;
        this.gridRightBoundary = transform.width + 2 * viewportPadding;
        this.gridBottomBoundary = transform.height + 2 * viewportPadding;
    }

    placeCollisionBox(collisionBox: SingleCollisionBox, allowOverlap: boolean, textPixelRatio: number, posMatrix: mat4, collisionGroupPredicate?: any): { box: Array<number>, offscreen: boolean } {
        const projectedPoint = this.projectAndGetPerspectiveRatio(posMatrix, collisionBox.anchorPointX, collisionBox.anchorPointY);
        const tileToViewport = textPixelRatio * projectedPoint.perspectiveRatio;
        const tlX = collisionBox.x1 * tileToViewport + projectedPoint.point.x;
        const tlY = collisionBox.y1 * tileToViewport + projectedPoint.point.y;
        const brX = collisionBox.x2 * tileToViewport + projectedPoint.point.x;
        const brY = collisionBox.y2 * tileToViewport + projectedPoint.point.y;

        if (!this.isInsideGrid(tlX, tlY, brX, brY) ||
            (!allowOverlap && this.grid.hitTest(tlX, tlY, brX, brY, collisionGroupPredicate))) {
            return {
                box: [],
                offscreen: false
            };
        }

        return {
            box: [tlX, tlY, brX, brY],
            offscreen: this.isOffscreen(tlX, tlY, brX, brY)
        };
    }

    approximateTileDistance(tileDistance: any, lastSegmentAngle: number, pixelsToTileUnits: number, cameraToAnchorDistance: number, pitchWithMap: boolean): number {
        // This is a quick and dirty solution for chosing which collision circles to use (since collision circles are
        // laid out in tile units). Ideally, I think we should generate collision circles on the fly in viewport coordinates
        // at the time we do collision detection.
        // See https://github.com/mapbox/mapbox-gl-js/issues/5474

        // incidenceStretch is the ratio of how much y space a label takes up on a tile while drawn perpendicular to the viewport vs
        //  how much space it would take up if it were drawn flat on the tile
        // Using law of sines, camera_to_anchor/sin(ground_angle) = camera_to_center/sin(incidence_angle)
        // Incidence angle 90 -> head on, sin(incidence_angle) = 1, no stretch
        // Incidence angle 1 -> very oblique, sin(incidence_angle) =~ 0, lots of stretch
        // ground_angle = u_pitch + PI/2 -> sin(ground_angle) = cos(u_pitch)
        // incidenceStretch = 1 / sin(incidenceAngle)

        const incidenceStretch = pitchWithMap ? 1 : cameraToAnchorDistance / this.pitchfactor;
        const lastSegmentTile = tileDistance.lastSegmentViewportDistance * pixelsToTileUnits;
        return tileDistance.prevTileDistance +
            lastSegmentTile +
            (incidenceStretch - 1) * lastSegmentTile * Math.abs(Math.sin(lastSegmentAngle));
    }

    placeCollisionCircles(collisionCircles: Array<number>,
                          allowOverlap: boolean,
                          scale: number,
                          textPixelRatio: number,
                          symbol: any,
                          lineVertexArray: SymbolLineVertexArray,
                          glyphOffsetArray: GlyphOffsetArray,
                          fontSize: number,
                          posMatrix: mat4,
                          labelPlaneMatrix: mat4,
                          showCollisionCircles: boolean,
                          pitchWithMap: boolean,
                          collisionGroupPredicate?: any): { circles: Array<number>, offscreen: boolean } {
        const placedCollisionCircles = [];

        const projectedAnchor = this.projectAnchor(posMatrix, symbol.anchorX, symbol.anchorY);

        const projectionCache = {};
        const fontScale = fontSize / 24;
        const lineOffsetX = symbol.lineOffsetX * fontSize;
        const lineOffsetY = symbol.lineOffsetY * fontSize;

        const tileUnitAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
        // projection.project generates NDC coordinates, as opposed to the
        // pixel-based grid coordinates generated by this.projectPoint
        const labelPlaneAnchorPoint =
            projection.project(tileUnitAnchorPoint, labelPlaneMatrix).point;
        const firstAndLastGlyph = projection.placeFirstAndLastGlyph(
            fontScale,
            glyphOffsetArray,
            lineOffsetX,
            lineOffsetY,
            /*flip*/ false,
            labelPlaneAnchorPoint,
            tileUnitAnchorPoint,
            symbol,
            lineVertexArray,
            labelPlaneMatrix,
            projectionCache,
            /*return tile distance*/ true);

        let collisionDetected = false;
        let inGrid = false;
        let entirelyOffscreen = true;

        const tileToViewport = projectedAnchor.perspectiveRatio * textPixelRatio;
        // pixelsToTileUnits is used for translating line geometry to tile units
        // ... so we care about 'scale' but not 'perspectiveRatio'
        // equivalent to pixel_to_tile_units
        const pixelsToTileUnits = 1 / (textPixelRatio * scale);

        let firstTileDistance = 0, lastTileDistance = 0;
        if (firstAndLastGlyph) {
            firstTileDistance = this.approximateTileDistance(firstAndLastGlyph.first.tileDistance, firstAndLastGlyph.first.angle, pixelsToTileUnits, projectedAnchor.cameraDistance, pitchWithMap);
            lastTileDistance = this.approximateTileDistance(firstAndLastGlyph.last.tileDistance, firstAndLastGlyph.last.angle, pixelsToTileUnits, projectedAnchor.cameraDistance, pitchWithMap);
        }

        for (let k = 0; k < collisionCircles.length; k += 5) {
            const anchorPointX = collisionCircles[k];
            const anchorPointY = collisionCircles[k + 1];
            const tileUnitRadius = collisionCircles[k + 2];
            const boxSignedDistanceFromAnchor = collisionCircles[k + 3];
            if (!firstAndLastGlyph ||
                (boxSignedDistanceFromAnchor < -firstTileDistance) ||
                (boxSignedDistanceFromAnchor > lastTileDistance)) {
                // The label either doesn't fit on its line or we
                // don't need to use this circle because the label
                // doesn't extend this far. Either way, mark the circle unused.
                markCollisionCircleUsed(collisionCircles, k, false);
                continue;
            }

            const projectedPoint = this.projectPoint(posMatrix, anchorPointX, anchorPointY);
            const radius = tileUnitRadius * tileToViewport;

            const atLeastOneCirclePlaced = placedCollisionCircles.length > 0;
            if (atLeastOneCirclePlaced) {
                const dx = projectedPoint.x - placedCollisionCircles[placedCollisionCircles.length - 4];
                const dy = projectedPoint.y - placedCollisionCircles[placedCollisionCircles.length - 3];
                // The circle edges touch when the distance between their centers is 2x the radius
                // When the distance is 1x the radius, they're doubled up, and we could remove
                // every other circle while keeping them all in touch.
                // We actually start removing circles when the distance is √2x the radius:
                //  thinning the number of circles as much as possible is a major performance win,
                //  and the small gaps introduced don't make a very noticeable difference.
                const placedTooDensely = radius * radius * 2 > dx * dx + dy * dy;
                if (placedTooDensely) {
                    const atLeastOneMoreCircle = (k + 8) < collisionCircles.length;
                    if (atLeastOneMoreCircle) {
                        const nextBoxDistanceToAnchor = collisionCircles[k + 8];
                        if ((nextBoxDistanceToAnchor > -firstTileDistance) &&
                        (nextBoxDistanceToAnchor < lastTileDistance)) {
                            // Hide significantly overlapping circles, unless this is the last one we can
                            // use, in which case we want to keep it in place even if it's tightly packed
                            // with the one before it.
                            markCollisionCircleUsed(collisionCircles, k, false);
                            continue;
                        }
                    }
                }
            }
            const collisionBoxArrayIndex = k / 5;
            placedCollisionCircles.push(projectedPoint.x, projectedPoint.y, radius, collisionBoxArrayIndex);
            markCollisionCircleUsed(collisionCircles, k, true);

            const x1 = projectedPoint.x - radius;
            const y1 = projectedPoint.y - radius;
            const x2 = projectedPoint.x + radius;
            const y2 = projectedPoint.y + radius;
            entirelyOffscreen = entirelyOffscreen && this.isOffscreen(x1, y1, x2, y2);
            inGrid = inGrid || this.isInsideGrid(x1, y1, x2, y2);

            if (!allowOverlap) {
                if (this.grid.hitTestCircle(projectedPoint.x, projectedPoint.y, radius, collisionGroupPredicate)) {
                    if (!showCollisionCircles) {
                        return {
                            circles: [],
                            offscreen: false
                        };
                    } else {
                        // Don't early exit if we're showing the debug circles because we still want to calculate
                        // which circles are in use
                        collisionDetected = true;
                    }
                }
            }
        }

        return {
            circles: (collisionDetected || !inGrid) ? [] : placedCollisionCircles,
            offscreen: entirelyOffscreen
        };
    }

    /**
     * Because the geometries in the CollisionIndex are an approximation of the shape of
     * symbols on the map, we use the CollisionIndex to look up the symbol part of
     * `queryRenderedFeatures`.
     *
     * @private
     */
    queryRenderedSymbols(viewportQueryGeometry: Array<Point>) {
        if (viewportQueryGeometry.length === 0 || (this.grid.keysLength() === 0 && this.ignoredGrid.keysLength() === 0)) {
            return {};
        }

        const query = [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const point of viewportQueryGeometry) {
            const gridPoint = new Point(point.x + viewportPadding, point.y + viewportPadding);
            minX = Math.min(minX, gridPoint.x);
            minY = Math.min(minY, gridPoint.y);
            maxX = Math.max(maxX, gridPoint.x);
            maxY = Math.max(maxY, gridPoint.y);
            query.push(gridPoint);
        }

        const features = this.grid.query(minX, minY, maxX, maxY)
            .concat(this.ignoredGrid.query(minX, minY, maxX, maxY));

        const seenFeatures = {};
        const result = {};

        for (const feature of features) {
            const featureKey = feature.key;
            // Skip already seen features.
            if (seenFeatures[featureKey.bucketInstanceId] === undefined) {
                seenFeatures[featureKey.bucketInstanceId] = {};
            }
            if (seenFeatures[featureKey.bucketInstanceId][featureKey.featureIndex]) {
                continue;
            }

            // Check if query intersects with the feature box
            // "Collision Circles" for line labels are treated as boxes here
            // Since there's no actual collision taking place, the circle vs. square
            // distinction doesn't matter as much, and box geometry is easier
            // to work with.
            const bbox = [
                new Point(feature.x1, feature.y1),
                new Point(feature.x2, feature.y1),
                new Point(feature.x2, feature.y2),
                new Point(feature.x1, feature.y2)
            ];
            if (!intersectionTests.polygonIntersectsPolygon(query, bbox)) {
                continue;
            }

            seenFeatures[featureKey.bucketInstanceId][featureKey.featureIndex] = true;
            if (result[featureKey.bucketInstanceId] === undefined) {
                result[featureKey.bucketInstanceId] = [];
            }
            result[featureKey.bucketInstanceId].push(featureKey.featureIndex);
        }

        return result;
    }

    insertCollisionBox(collisionBox: Array<number>, ignorePlacement: boolean, bucketInstanceId: number, featureIndex: number, collisionGroupID: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        const key = { bucketInstanceId, featureIndex, collisionGroupID };
        grid.insert(key, collisionBox[0], collisionBox[1], collisionBox[2], collisionBox[3]);
    }

    insertCollisionCircles(collisionCircles: Array<number>, ignorePlacement: boolean, bucketInstanceId: number, featureIndex: number, collisionGroupID: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        const key = { bucketInstanceId, featureIndex, collisionGroupID };
        for (let k = 0; k < collisionCircles.length; k += 4) {
            grid.insertCircle(key, collisionCircles[k], collisionCircles[k + 1], collisionCircles[k + 2]);
        }
    }

    projectAnchor(posMatrix: mat4, x: number, y: number) {
        const p = [x, y, 0, 1];
        projection.xyTransformMat4(p, p, posMatrix);
        return {
            perspectiveRatio: 0.5 + 0.5 * (this.transform.cameraToCenterDistance / p[3]),
            cameraDistance: p[3]
        };
    }

    projectPoint(posMatrix: mat4, x: number, y: number) {
        const p = [x, y, 0, 1];
        projection.xyTransformMat4(p, p, posMatrix);
        return new Point(
            (((p[0] / p[3] + 1) / 2) * this.transform.width) + viewportPadding,
            (((-p[1] / p[3] + 1) / 2) * this.transform.height) + viewportPadding
        );
    }

    projectAndGetPerspectiveRatio(posMatrix: mat4, x: number, y: number) {
        const p = [x, y, 0, 1];
        projection.xyTransformMat4(p, p, posMatrix);
        const a = new Point(
            (((p[0] / p[3] + 1) / 2) * this.transform.width) + viewportPadding,
            (((-p[1] / p[3] + 1) / 2) * this.transform.height) + viewportPadding
        );
        return {
            point: a,
            // See perspective ratio comment in symbol_sdf.vertex
            // We're doing collision detection in viewport space so we need
            // to scale down boxes in the distance
            perspectiveRatio: 0.5 + 0.5 * (this.transform.cameraToCenterDistance / p[3])
        };
    }

    isOffscreen(x1: number, y1: number, x2: number, y2: number) {
        return x2 < viewportPadding || x1 >= this.screenRightBoundary || y2 < viewportPadding || y1 > this.screenBottomBoundary;
    }

    isInsideGrid(x1: number, y1: number, x2: number, y2: number) {
        return x2 >= 0 && x1 < this.gridRightBoundary && y2 >= 0 && y1 < this.gridBottomBoundary;
    }
}

function markCollisionCircleUsed(collisionCircles: Array<number>, index: number, used: boolean) {
    collisionCircles[index + 4] = used ? 1 : 0;
}

export default CollisionIndex;
