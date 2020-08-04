// @flow

import type {SymbolFeature} from '../data/bucket/symbol_bucket';

export default function (features: Array<SymbolFeature>): Array<SymbolFeature> {
    const leftIndex: {[string]: number} = {};
    const rightIndex: {[string]: number} = {};
    const mergedFeatures = [];
    let mergedIndex = 0;

    function add(k) {
        mergedFeatures.push(features[k]);
        mergedIndex++;
    }

    function mergeFromRight(leftKey: string, rightKey: string, geom) {
        const i = rightIndex[leftKey];
        delete rightIndex[leftKey];
        rightIndex[rightKey] = i;

        mergedFeatures[i].geometry[0].pop();
        mergedFeatures[i].geometry[0] = mergedFeatures[i].geometry[0].concat(geom[0]);
        return i;
    }

    function mergeFromLeft(leftKey: string, rightKey: string, geom) {
        const i = leftIndex[rightKey];
        delete leftIndex[rightKey];
        leftIndex[leftKey] = i;

        mergedFeatures[i].geometry[0].shift();
        mergedFeatures[i].geometry[0] = geom[0].concat(mergedFeatures[i].geometry[0]);
        return i;
    }

    function getKey(text, geom, onRight) {
        const point = onRight ? geom[0][geom[0].length - 1] : geom[0][0];
        return `${text}:${point.x}:${point.y}`;
    }

    for (let k = 0; k < features.length; k++) {
        const feature = features[k];
        const geom = feature.geometry;
        const text = feature.text ? feature.text.toString() : null;

        if (!text) {
            add(k);
            continue;
        }

        const leftKey = getKey(text, geom),
            rightKey = getKey(text, geom, true);

        if ((leftKey in rightIndex) && (rightKey in leftIndex) && (rightIndex[leftKey] !== leftIndex[rightKey])) {
            // found lines with the same text adjacent to both ends of the current line, merge all three
            const j = mergeFromLeft(leftKey, rightKey, geom);
            const i = mergeFromRight(leftKey, rightKey, mergedFeatures[j].geometry);

            delete leftIndex[leftKey];
            delete rightIndex[rightKey];

            rightIndex[getKey(text, mergedFeatures[i].geometry, true)] = i;
            mergedFeatures[j].geometry = (null: any);

        } else if (leftKey in rightIndex) {
            // found mergeable line adjacent to the start of the current line, merge
            mergeFromRight(leftKey, rightKey, geom);

        } else if (rightKey in leftIndex) {
            // found mergeable line adjacent to the end of the current line, merge
            mergeFromLeft(leftKey, rightKey, geom);

        } else {
            // no adjacent lines, add as a new item
            add(k);
            leftIndex[leftKey] = mergedIndex - 1;
            rightIndex[rightKey] = mergedIndex - 1;
        }
    }

    return mergedFeatures.filter((f) => f.geometry);
}
