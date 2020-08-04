
import refProperties from './util/ref_properties';

function stringify(obj) {
    const type = typeof obj;
    if (type === 'number' || type === 'boolean' || type === 'string' || obj === undefined || obj === null)
        return JSON.stringify(obj);

    if (Array.isArray(obj)) {
        let str = '[';
        for (const val of obj) {
            str += `${stringify(val)},`;
        }
        return `${str}]`;
    }

    const keys = Object.keys(obj).sort();

    let str = '{';
    for (let i = 0; i < keys.length; i++) {
        str += `${JSON.stringify(keys[i])}:${stringify(obj[keys[i]])},`;
    }
    return `${str}}`;
}

function getKey(layer) {
    let key = '';
    for (const k of refProperties) {
        key += `/${stringify(layer[k])}`;
    }
    return key;
}

export default groupByLayout;

/**
 * Given an array of layers, return an array of arrays of layers where all
 * layers in each group have identical layout-affecting properties. These
 * are the properties that were formerly used by explicit `ref` mechanism
 * for layers: 'type', 'source', 'source-layer', 'minzoom', 'maxzoom',
 * 'filter', and 'layout'.
 *
 * The input is not modified. The output layers are references to the
 * input layers.
 *
 * @private
 * @param {Array<Layer>} layers
 * @returns {Array<Array<Layer>>}
 */
function groupByLayout(layers) {
    const groups = {};

    for (let i = 0; i < layers.length; i++) {
        const k = getKey(layers[i]);
        let group = groups[k];
        if (!group) {
            group = groups[k] = [];
        }
        group.push(layers[i]);
    }

    const result = [];

    for (const k in groups) {
        result.push(groups[k]);
    }

    return result;
}
