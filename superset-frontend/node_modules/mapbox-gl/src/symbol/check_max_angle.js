// @flow

export default checkMaxAngle;

import type Point from '@mapbox/point-geometry';
import type Anchor from './anchor';

/**
 * Labels placed around really sharp angles aren't readable. Check if any
 * part of the potential label has a combined angle that is too big.
 *
 * @param line
 * @param anchor The point on the line around which the label is anchored.
 * @param labelLength The length of the label in geometry units.
 * @param windowSize The check fails if the combined angles within a part of the line that is `windowSize` long is too big.
 * @param maxAngle The maximum combined angle that any window along the label is allowed to have.
 *
 * @returns {boolean} whether the label should be placed
 * @private
 */
function checkMaxAngle(line: Array<Point>, anchor: Anchor, labelLength: number, windowSize: number, maxAngle: number) {

    // horizontal labels always pass
    if (anchor.segment === undefined) return true;

    let p = anchor;
    let index = anchor.segment + 1;
    let anchorDistance = 0;

    // move backwards along the line to the first segment the label appears on
    while (anchorDistance > -labelLength / 2) {
        index--;

        // there isn't enough room for the label after the beginning of the line
        if (index < 0) return false;

        anchorDistance -= line[index].dist(p);
        p = line[index];
    }

    anchorDistance += line[index].dist(line[index + 1]);
    index++;

    // store recent corners and their total angle difference
    const recentCorners = [];
    let recentAngleDelta = 0;

    // move forwards by the length of the label and check angles along the way
    while (anchorDistance < labelLength / 2) {
        const prev = line[index - 1];
        const current = line[index];
        const next = line[index + 1];

        // there isn't enough room for the label before the end of the line
        if (!next) return false;

        let angleDelta = prev.angleTo(current) - current.angleTo(next);
        // restrict angle to -pi..pi range
        angleDelta = Math.abs(((angleDelta + 3 * Math.PI) % (Math.PI * 2)) - Math.PI);

        recentCorners.push({
            distance: anchorDistance,
            angleDelta
        });
        recentAngleDelta += angleDelta;

        // remove corners that are far enough away from the list of recent anchors
        while (anchorDistance - recentCorners[0].distance > windowSize) {
            recentAngleDelta -= recentCorners.shift().angleDelta;
        }

        // the sum of angles within the window area exceeds the maximum allowed value. check fails.
        if (recentAngleDelta > maxAngle) return false;

        index++;
        anchorDistance += current.dist(next);
    }

    // no part of the line had an angle greater than the maximum allowed. check passes.
    return true;
}
