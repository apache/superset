// @flow

import {
    eachLayer,
    eachProperty
} from '../visit';
import { isExpression } from '../expression';
import convertFunction, {convertTokenString} from '../function/convert';
import convertFilter from '../feature_filter/convert';

import type { StyleSpecification } from '../types';

/**
 * Migrate the given style object in place to use expressions. Specifically,
 * this will convert (a) "stop" functions, and (b) legacy filters to their
 * expression equivalents.
 */
export default function(style: StyleSpecification) {
    const converted = [];

    eachLayer(style, (layer) => {
        if (layer.filter) {
            layer.filter = (convertFilter(layer.filter): any);
        }
    });

    eachProperty(style, {paint: true, layout: true}, ({path, value, reference, set}) => {
        if (isExpression(value)) return;
        if (typeof value === 'object' && !Array.isArray(value)) {
            set(convertFunction(value, reference));
            converted.push(path.join('.'));
        } else if (reference.tokens && typeof value === 'string') {
            set(convertTokenString(value));
        }
    });

    return style;
}

