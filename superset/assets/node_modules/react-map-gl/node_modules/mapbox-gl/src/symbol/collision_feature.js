// @flow

import type {CollisionBoxArray} from '../data/array_types';
import Point from '@mapbox/point-geometry';
import type Anchor from './anchor';

/**
 * A CollisionFeature represents the area of the tile covered by a single label.
 * It is used with CollisionIndex to check if the label overlaps with any
 * previous labels. A CollisionFeature is mostly just a set of CollisionBox
 * objects.
 *
 * @private
 */
class CollisionFeature {
    boxStartIndex: number;
    boxEndIndex: number;

    /**
     * Create a CollisionFeature, adding its collision box data to the given collisionBoxArray in the process.
     *
     * @param line The geometry the label is placed on.
     * @param anchor The point along the line around which the label is anchored.
     * @param shaped The text or icon shaping results.
     * @param boxScale A magic number used to convert from glyph metrics units to geometry units.
     * @param padding The amount of padding to add around the label edges.
     * @param alignLine Whether the label is aligned with the line or the viewport.
     */
    constructor(collisionBoxArray: CollisionBoxArray,
                line: Array<Point>,
                anchor: Anchor,
                featureIndex: number,
                sourceLayerIndex: number,
                bucketIndex: number,
                shaped: Object,
                boxScale: number,
                padding: number,
                alignLine: boolean,
                overscaling: number,
                rotate: number) {
        let y1 = shaped.top * boxScale - padding;
        let y2 = shaped.bottom * boxScale + padding;
        let x1 = shaped.left * boxScale - padding;
        let x2 = shaped.right * boxScale + padding;

        this.boxStartIndex = collisionBoxArray.length;

        if (alignLine) {

            let height = y2 - y1;
            const length = x2 - x1;

            if (height > 0) {
                // set minimum box height to avoid very many small labels
                height = Math.max(10 * boxScale, height);

                this._addLineCollisionCircles(collisionBoxArray, line, anchor, (anchor.segment: any), length, height, featureIndex, sourceLayerIndex, bucketIndex, overscaling);
            }

        } else {
            if (rotate) {
                // Account for *-rotate in point collision boxes
                // See https://github.com/mapbox/mapbox-gl-js/issues/6075
                // Doesn't account for icon-text-fit

                const tl = new Point(x1, y1);
                const tr = new Point(x2, y1);
                const bl = new Point(x1, y2);
                const br = new Point(x2, y2);

                const rotateRadians = rotate * Math.PI / 180;

                tl._rotate(rotateRadians);
                tr._rotate(rotateRadians);
                bl._rotate(rotateRadians);
                br._rotate(rotateRadians);

                // Collision features require an "on-axis" geometry,
                // so take the envelope of the rotated geometry
                // (may be quite large for wide labels rotated 45 degrees)
                x1 = Math.min(tl.x, tr.x, bl.x, br.x);
                x2 = Math.max(tl.x, tr.x, bl.x, br.x);
                y1 = Math.min(tl.y, tr.y, bl.y, br.y);
                y2 = Math.max(tl.y, tr.y, bl.y, br.y);
            }
            collisionBoxArray.emplaceBack(anchor.x, anchor.y, x1, y1, x2, y2, featureIndex, sourceLayerIndex, bucketIndex,
                0, 0);
        }

        this.boxEndIndex = collisionBoxArray.length;
    }

    /**
     * Create a set of CollisionBox objects for a line.
     *
     * @param labelLength The length of the label in geometry units.
     * @param anchor The point along the line around which the label is anchored.
     * @param boxSize The size of the collision boxes that will be created.
     * @private
     */
    _addLineCollisionCircles(collisionBoxArray: CollisionBoxArray,
                           line: Array<Point>,
                           anchor: Anchor,
                           segment: number,
                           labelLength: number,
                           boxSize: number,
                           featureIndex: number,
                           sourceLayerIndex: number,
                           bucketIndex: number,
                           overscaling: number) {
        const step = boxSize / 2;
        const nBoxes = Math.floor(labelLength / step) || 1;
        // We calculate line collision circles out to 300% of what would normally be our
        // max size, to allow collision detection to work on labels that expand as
        // they move into the distance
        // Vertically oriented labels in the distant field can extend past this padding
        // This is a noticeable problem in overscaled tiles where the pitch 0-based
        // symbol spacing will put labels very close together in a pitched map.
        // To reduce the cost of adding extra collision circles, we slowly increase
        // them for overscaled tiles.
        const overscalingPaddingFactor = 1 + .4 * Math.log(overscaling) / Math.LN2;
        const nPitchPaddingBoxes = Math.floor(nBoxes * overscalingPaddingFactor / 2);

        // offset the center of the first box by half a box so that the edge of the
        // box is at the edge of the label.
        const firstBoxOffset = -boxSize / 2;

        let p = anchor;
        let index = segment + 1;
        let anchorDistance = firstBoxOffset;
        const labelStartDistance = -labelLength / 2;
        const paddingStartDistance = labelStartDistance - labelLength / 4;
        // move backwards along the line to the first segment the label appears on
        do {
            index--;

            if (index < 0) {
                if (anchorDistance > labelStartDistance) {
                    // there isn't enough room for the label after the beginning of the line
                    // checkMaxAngle should have already caught this
                    return;
                } else {
                    // The line doesn't extend far enough back for all of our padding,
                    // but we got far enough to show the label under most conditions.
                    index = 0;
                    break;
                }
            } else {
                anchorDistance -= line[index].dist(p);
                p = line[index];
            }
        } while (anchorDistance > paddingStartDistance);

        let segmentLength = line[index].dist(line[index + 1]);

        for (let i = -nPitchPaddingBoxes; i < nBoxes + nPitchPaddingBoxes; i++) {

            // the distance the box will be from the anchor
            const boxOffset = i * step;
            let boxDistanceToAnchor = labelStartDistance + boxOffset;

            // make the distance between pitch padding boxes bigger
            if (boxOffset < 0) boxDistanceToAnchor += boxOffset;
            if (boxOffset > labelLength) boxDistanceToAnchor += boxOffset - labelLength;

            if (boxDistanceToAnchor < anchorDistance) {
                // The line doesn't extend far enough back for this box, skip it
                // (This could allow for line collisions on distant tiles)
                continue;
            }

            // the box is not on the current segment. Move to the next segment.
            while (anchorDistance + segmentLength < boxDistanceToAnchor) {
                anchorDistance += segmentLength;
                index++;

                // There isn't enough room before the end of the line.
                if (index + 1 >= line.length) {
                    return;
                }

                segmentLength = line[index].dist(line[index + 1]);
            }

            // the distance the box will be from the beginning of the segment
            const segmentBoxDistance = boxDistanceToAnchor - anchorDistance;

            const p0 = line[index];
            const p1 = line[index + 1];
            const boxAnchorPoint = p1.sub(p0)._unit()._mult(segmentBoxDistance)._add(p0)._round();

            // If the box is within boxSize of the anchor, force the box to be used
            // (so even 0-width labels use at least one box)
            // Otherwise, the .8 multiplication gives us a little bit of conservative
            // padding in choosing which boxes to use (see CollisionIndex#placedCollisionCircles)
            const paddedAnchorDistance = Math.abs(boxDistanceToAnchor - firstBoxOffset) < step ?
                0 :
                (boxDistanceToAnchor - firstBoxOffset) * 0.8;

            collisionBoxArray.emplaceBack(boxAnchorPoint.x, boxAnchorPoint.y,
                -boxSize / 2, -boxSize / 2, boxSize / 2, boxSize / 2,
                featureIndex, sourceLayerIndex, bucketIndex,
                boxSize / 2, paddedAnchorDistance);
        }
    }
}

export default CollisionFeature;
