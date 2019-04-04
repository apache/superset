// @flow

import assert from 'assert';
import type {StylePropertySpecification} from '../style-spec';

export default convertFunction;

function convertLiteral(value) {
    return typeof value === 'object' ? ['literal', value] : value;
}

function convertFunction(parameters: any, propertySpec: StylePropertySpecification) {
    let stops = parameters.stops;
    if (!stops) {
        // identity function
        return convertIdentityFunction(parameters, propertySpec);
    }

    const zoomAndFeatureDependent = stops && typeof stops[0][0] === 'object';
    const featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
    const zoomDependent = zoomAndFeatureDependent || !featureDependent;

    stops = stops.map((stop) => {
        if (!featureDependent && propertySpec.tokens && typeof stop[1] === 'string') {
            return [stop[0], convertTokenString(stop[1])];
        }
        return [stop[0], convertLiteral(stop[1])];
    });

    if (zoomAndFeatureDependent) {
        return convertZoomAndPropertyFunction(parameters, propertySpec, stops);
    } else if (zoomDependent) {
        return convertZoomFunction(parameters, propertySpec, stops);
    } else {
        return convertPropertyFunction(parameters, propertySpec, stops);
    }
}

function convertIdentityFunction(parameters, propertySpec): Array<mixed> {
    const get = ['get', parameters.property];

    if (parameters.default === undefined) {
        // By default, expressions for string-valued properties get coerced. To preserve
        // legacy function semantics, insert an explicit assertion instead.
        return propertySpec.type === 'string' ? ['string', get] : get;
    } else if (propertySpec.type === 'enum') {
        return [
            'match',
            get,
            Object.keys(propertySpec.values),
            get,
            parameters.default
        ];
    } else {
        const expression = [propertySpec.type === 'color' ? 'to-color' : propertySpec.type, get, convertLiteral(parameters.default)];
        if (propertySpec.type === 'array') {
            expression.splice(1, 0, propertySpec.value, propertySpec.length || null);
        }
        return expression;
    }
}

function getInterpolateOperator(parameters) {
    switch (parameters.colorSpace) {
    case 'hcl': return 'interpolate-hcl';
    case 'lab': return 'interpolate-lab';
    default: return 'interpolate';
    }
}

function convertZoomAndPropertyFunction(parameters, propertySpec, stops) {
    const featureFunctionParameters = {};
    const featureFunctionStops = {};
    const zoomStops = [];
    for (let s = 0; s < stops.length; s++) {
        const stop = stops[s];
        const zoom = stop[0].zoom;
        if (featureFunctionParameters[zoom] === undefined) {
            featureFunctionParameters[zoom] = {
                zoom,
                type: parameters.type,
                property: parameters.property,
                default: parameters.default,
            };
            featureFunctionStops[zoom] = [];
            zoomStops.push(zoom);
        }
        featureFunctionStops[zoom].push([stop[0].value, stop[1]]);
    }

    // the interpolation type for the zoom dimension of a zoom-and-property
    // function is determined directly from the style property specification
    // for which it's being used: linear for interpolatable properties, step
    // otherwise.
    const functionType = getFunctionType({}, propertySpec);
    if (functionType === 'exponential') {
        const expression = [getInterpolateOperator(parameters), ['linear'], ['zoom']];

        for (const z of zoomStops) {
            const output = convertPropertyFunction(featureFunctionParameters[z], propertySpec, featureFunctionStops[z]);
            appendStopPair(expression, z, output, false);
        }

        return expression;
    } else {
        const expression = ['step', ['zoom']];

        for (const z of zoomStops) {
            const output = convertPropertyFunction(featureFunctionParameters[z], propertySpec, featureFunctionStops[z]);
            appendStopPair(expression, z, output, true);
        }

        fixupDegenerateStepCurve(expression);

        return expression;
    }
}

function coalesce(a, b) {
    if (a !== undefined) return a;
    if (b !== undefined) return b;
}

function convertPropertyFunction(parameters, propertySpec, stops) {
    const type = getFunctionType(parameters, propertySpec);
    const get = ['get', parameters.property];
    if (type === 'categorical' && typeof stops[0][0] === 'boolean') {
        assert(parameters.stops.length > 0 && parameters.stops.length <= 2);
        const expression = ['case'];
        for (const stop of stops) {
            expression.push(['==', get, stop[0]], stop[1]);
        }
        expression.push(convertLiteral(coalesce(parameters.default, propertySpec.default)));
        return expression;
    } else if (type === 'categorical') {
        const expression = ['match', get];
        for (const stop of stops) {
            appendStopPair(expression, stop[0], stop[1], false);
        }
        expression.push(convertLiteral(coalesce(parameters.default, propertySpec.default)));
        return expression;
    } else if (type === 'interval') {
        const expression = ['step', ['number', get]];
        for (const stop of stops) {
            appendStopPair(expression, stop[0], stop[1], true);
        }
        fixupDegenerateStepCurve(expression);
        return parameters.default === undefined ? expression : [
            'case',
            ['==', ['typeof', get], 'number'],
            expression,
            convertLiteral(parameters.default)
        ];
    } else if (type === 'exponential') {
        const base = parameters.base !== undefined ? parameters.base : 1;
        const expression = [getInterpolateOperator(parameters), ['exponential', base], ['number', get]];
        for (const stop of stops) {
            appendStopPair(expression, stop[0], stop[1], false);
        }
        return parameters.default === undefined ? expression : [
            'case',
            ['==', ['typeof', get], 'number'],
            expression,
            convertLiteral(parameters.default)
        ];
    } else {
        throw new Error(`Unknown property function type ${type}`);
    }
}

function convertZoomFunction(parameters, propertySpec, stops, input = ['zoom']) {
    const type = getFunctionType(parameters, propertySpec);
    let expression;
    let isStep = false;
    if (type === 'interval') {
        expression = ['step', input];
        isStep = true;
    } else if (type === 'exponential') {
        const base = parameters.base !== undefined ? parameters.base : 1;
        expression = [getInterpolateOperator(parameters), ['exponential', base], input];
    } else {
        throw new Error(`Unknown zoom function type "${type}"`);
    }

    for (const stop of stops) {
        appendStopPair(expression, stop[0], stop[1], isStep);
    }

    fixupDegenerateStepCurve(expression);

    return expression;
}

function fixupDegenerateStepCurve(expression) {
    // degenerate step curve (i.e. a constant function): add a noop stop
    if (expression[0] === 'step' && expression.length === 3) {
        expression.push(0);
        expression.push(expression[3]);
    }
}

function appendStopPair(curve, input, output, isStep) {
    // Skip duplicate stop values. They were not validated for functions, but they are for expressions.
    // https://github.com/mapbox/mapbox-gl-js/issues/4107
    if (curve.length > 3 && input === curve[curve.length - 2]) {
        return;
    }
    // step curves don't get the first input value, as it is redundant.
    if (!(isStep && curve.length === 2)) {
        curve.push(input);
    }
    curve.push(output);
}

function getFunctionType(parameters, propertySpec) {
    if (parameters.type) {
        return parameters.type;
    } else {
        assert(propertySpec.expression);
        return (propertySpec.expression: any).interpolated ? 'exponential' : 'interval';
    }
}

// "String with {name} token" => ["concat", "String with ", ["get", "name"], " token"]
export function convertTokenString(s: string) {
    const result = ['concat'];
    const re = /{([^{}]+)}/g;
    let pos = 0;
    for (let match = re.exec(s); match !== null; match = re.exec(s)) {
        const literal = s.slice(pos, re.lastIndex - match[0].length);
        pos = re.lastIndex;
        if (literal.length > 0) result.push(literal);
        result.push(['get', match[1]]);
    }

    if (result.length === 1) {
        return s;
    }

    if (pos < s.length) {
        result.push(s.slice(pos));
    } else if (result.length === 2) {
        return ['to-string', result[1]];
    }

    return result;
}

