// @flow

import Reference from './reference/v8.json';
import type {StylePropertySpecification} from './style-spec';
import type {
    StyleSpecification,
    SourceSpecification,
    LayerSpecification,
    PropertyValueSpecification,
    DataDrivenPropertyValueSpecification
} from './types';

function getPropertyReference(propertyName): StylePropertySpecification {
    for (let i = 0; i < Reference.layout.length; i++) {
        for (const key in Reference[Reference.layout[i]]) {
            if (key === propertyName) return (Reference[Reference.layout[i]][key]: any);
        }
    }
    for (let i = 0; i < Reference.paint.length; i++) {
        for (const key in Reference[Reference.paint[i]]) {
            if (key === propertyName) return (Reference[Reference.paint[i]][key]: any);
        }
    }

    return (null: any);
}

export function eachSource(style: StyleSpecification, callback: (SourceSpecification) => void) {
    for (const k in style.sources) {
        callback(style.sources[k]);
    }
}

export function eachLayer(style: StyleSpecification, callback: (LayerSpecification) => void) {
    for (const layer of style.layers) {
        callback(layer);
    }
}

type PropertyCallback = ({
    path: [string, 'paint' | 'layout', string], // [layerid, paint/layout, property key]
    key: string,
    value: PropertyValueSpecification<mixed> | DataDrivenPropertyValueSpecification<mixed>,
    reference: StylePropertySpecification,
    set: (PropertyValueSpecification<mixed> | DataDrivenPropertyValueSpecification<mixed>) => void
}) => void;

export function eachProperty(
    style: StyleSpecification,
    options: {paint?: boolean, layout?: boolean},
    callback: PropertyCallback
) {
    function inner(layer, propertyType: 'paint' | 'layout') {
        const properties = (layer[propertyType]: any);
        if (!properties) return;
        Object.keys(properties).forEach((key) => {
            callback({
                path: [layer.id, propertyType, key],
                key,
                value: properties[key],
                reference: getPropertyReference(key),
                set(x) {
                    properties[key] = x;
                }
            });
        });
    }

    eachLayer(style, (layer) => {
        if (options.paint) {
            inner(layer, 'paint');
        }
        if (options.layout) {
            inner(layer, 'layout');
        }
    });
}
