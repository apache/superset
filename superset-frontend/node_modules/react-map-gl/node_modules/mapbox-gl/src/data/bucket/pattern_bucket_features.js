// @flow
import type FillStyleLayer from '../../style/style_layer/fill_style_layer';
import type FillExtrusionStyleLayer from '../../style/style_layer/fill_extrusion_style_layer';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';

import type {
    BucketFeature,
    PopulateParameters
} from '../bucket';

type PatternStyleLayers =
    Array<LineStyleLayer> |
    Array<FillStyleLayer> |
    Array<FillExtrusionStyleLayer>;

export function hasPattern(type: string, layers: PatternStyleLayers, options: PopulateParameters) {
    const patterns = options.patternDependencies;
    let hasPattern = false;

    for (const layer of layers) {
        const patternProperty = layer.paint.get(`${type}-pattern`);
        if (!patternProperty.isConstant()) {
            hasPattern = true;
        }

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern) {
            hasPattern = true;
            patterns[constantPattern.to] =  true;
            patterns[constantPattern.from] =  true;
        }
    }

    return hasPattern;
}

export function addPatternDependencies(type: string, layers: PatternStyleLayers, patternFeature: BucketFeature, zoom: number, options: PopulateParameters) {
    const patterns = options.patternDependencies;
    for (const layer of layers) {
        const patternProperty = layer.paint.get(`${type}-pattern`);

        const patternPropertyValue = patternProperty.value;
        if (patternPropertyValue.kind !== "constant") {
            const min = patternPropertyValue.evaluate({zoom: zoom - 1}, patternFeature, {});
            const mid = patternPropertyValue.evaluate({zoom}, patternFeature, {});
            const max = patternPropertyValue.evaluate({zoom: zoom + 1}, patternFeature, {});
            // add to patternDependencies
            patterns[min] = true;
            patterns[mid] = true;
            patterns[max] = true;

            // save for layout
            patternFeature.patterns[layer.id] = { min, mid, max };
        }
    }
    return patternFeature;
}
