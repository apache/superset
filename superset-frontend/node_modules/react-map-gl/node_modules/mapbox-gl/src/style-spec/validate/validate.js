
import extend from '../util/extend';
import { unbundle, deepUnbundle } from '../util/unbundle_jsonlint';
import { isExpression } from '../expression';
import { isFunction } from '../function';

import validateFunction from './validate_function';
import validateExpression from './validate_expression';
import validateObject from './validate_object';
import validateArray from './validate_array';
import validateBoolean from './validate_boolean';
import validateNumber from './validate_number';
import validateColor from './validate_color';
import validateConstants from './validate_constants';
import validateEnum from './validate_enum';
import validateFilter from './validate_filter';
import validateLayer from './validate_layer';
import validateSource from './validate_source';
import validateLight from './validate_light';
import validateString from './validate_string';
import validateFormatted from './validate_formatted';

const VALIDATORS = {
    '*'() {
        return [];
    },
    'array': validateArray,
    'boolean': validateBoolean,
    'number': validateNumber,
    'color': validateColor,
    'constants': validateConstants,
    'enum': validateEnum,
    'filter': validateFilter,
    'function': validateFunction,
    'layer': validateLayer,
    'object': validateObject,
    'source': validateSource,
    'light': validateLight,
    'string': validateString,
    'formatted': validateFormatted
};


// Main recursive validation function. Tracks:
//
// - key: string representing location of validation in style tree. Used only
//   for more informative error reporting.
// - value: current value from style being evaluated. May be anything from a
//   high level object that needs to be descended into deeper or a simple
//   scalar value.
// - valueSpec: current spec being evaluated. Tracks value.
// - styleSpec: current full spec being evaluated.

export default function validate(options) {
    const value = options.value;
    const valueSpec = options.valueSpec;
    const styleSpec = options.styleSpec;

    if (valueSpec.expression && isFunction(unbundle(value))) {
        return validateFunction(options);

    } else if (valueSpec.expression && isExpression(deepUnbundle(value))) {
        return validateExpression(options);

    } else if (valueSpec.type && VALIDATORS[valueSpec.type]) {
        return VALIDATORS[valueSpec.type](options);

    } else {
        const valid = validateObject(extend({}, options, {
            valueSpec: valueSpec.type ? styleSpec[valueSpec.type] : valueSpec
        }));
        return valid;
    }
}
