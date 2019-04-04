
import ValidationError from '../error/validation_error';
import getType from '../util/get_type';
import validate from './validate';
import validateObject from './validate_object';
import validateArray from './validate_array';
import validateNumber from './validate_number';
import { isExpression } from '../expression';
import { unbundle, deepUnbundle } from '../util/unbundle_jsonlint';
import {
    supportsPropertyExpression,
    supportsZoomExpression,
    supportsInterpolation
} from '../util/properties';

export default function validateFunction(options) {
    const functionValueSpec = options.valueSpec;
    const functionType = unbundle(options.value.type);
    let stopKeyType;
    let stopDomainValues = {};
    let previousStopDomainValue;
    let previousStopDomainZoom;

    const isZoomFunction = functionType !== 'categorical' && options.value.property === undefined;
    const isPropertyFunction = !isZoomFunction;
    const isZoomAndPropertyFunction =
        getType(options.value.stops) === 'array' &&
        getType(options.value.stops[0]) === 'array' &&
        getType(options.value.stops[0][0]) === 'object';

    const errors = validateObject({
        key: options.key,
        value: options.value,
        valueSpec: options.styleSpec.function,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: {
            stops: validateFunctionStops,
            default: validateFunctionDefault
        }
    });

    if (functionType === 'identity' && isZoomFunction) {
        errors.push(new ValidationError(options.key, options.value, 'missing required property "property"'));
    }

    if (functionType !== 'identity' && !options.value.stops) {
        errors.push(new ValidationError(options.key, options.value, 'missing required property "stops"'));
    }

    if (functionType === 'exponential' && options.valueSpec.expression && !supportsInterpolation(options.valueSpec)) {
        errors.push(new ValidationError(options.key, options.value, 'exponential functions not supported'));
    }

    if (options.styleSpec.$version >= 8) {
        if (isPropertyFunction && !supportsPropertyExpression(options.valueSpec)) {
            errors.push(new ValidationError(options.key, options.value, 'property functions not supported'));
        } else if (isZoomFunction && !supportsZoomExpression(options.valueSpec)) {
            errors.push(new ValidationError(options.key, options.value, 'zoom functions not supported'));
        }
    }

    if ((functionType === 'categorical' || isZoomAndPropertyFunction) && options.value.property === undefined) {
        errors.push(new ValidationError(options.key, options.value, '"property" property is required'));
    }

    return errors;

    function validateFunctionStops(options) {
        if (functionType === 'identity') {
            return [new ValidationError(options.key, options.value, 'identity function may not have a "stops" property')];
        }

        let errors = [];
        const value = options.value;

        errors = errors.concat(validateArray({
            key: options.key,
            value,
            valueSpec: options.valueSpec,
            style: options.style,
            styleSpec: options.styleSpec,
            arrayElementValidator: validateFunctionStop
        }));

        if (getType(value) === 'array' && value.length === 0) {
            errors.push(new ValidationError(options.key, value, 'array must have at least one stop'));
        }

        return errors;
    }

    function validateFunctionStop(options) {
        let errors = [];
        const value = options.value;
        const key = options.key;

        if (getType(value) !== 'array') {
            return [new ValidationError(key, value, `array expected, ${getType(value)} found`)];
        }

        if (value.length !== 2) {
            return [new ValidationError(key, value, `array length 2 expected, length ${value.length} found`)];
        }

        if (isZoomAndPropertyFunction) {
            if (getType(value[0]) !== 'object') {
                return [new ValidationError(key, value, `object expected, ${getType(value[0])} found`)];
            }
            if (value[0].zoom === undefined) {
                return [new ValidationError(key, value, 'object stop key must have zoom')];
            }
            if (value[0].value === undefined) {
                return [new ValidationError(key, value, 'object stop key must have value')];
            }
            if (previousStopDomainZoom && previousStopDomainZoom > unbundle(value[0].zoom)) {
                return [new ValidationError(key, value[0].zoom, 'stop zoom values must appear in ascending order')];
            }
            if (unbundle(value[0].zoom) !== previousStopDomainZoom) {
                previousStopDomainZoom = unbundle(value[0].zoom);
                previousStopDomainValue = undefined;
                stopDomainValues = {};
            }
            errors = errors.concat(validateObject({
                key: `${key}[0]`,
                value: value[0],
                valueSpec: { zoom: {} },
                style: options.style,
                styleSpec: options.styleSpec,
                objectElementValidators: { zoom: validateNumber, value: validateStopDomainValue }
            }));
        } else {
            errors = errors.concat(validateStopDomainValue({
                key: `${key}[0]`,
                value: value[0],
                valueSpec: {},
                style: options.style,
                styleSpec: options.styleSpec
            }, value));
        }

        if (isExpression(deepUnbundle(value[1]))) {
            return errors.concat([new ValidationError(`${key}[1]`, value[1], 'expressions are not allowed in function stops.')]);
        }

        return errors.concat(validate({
            key: `${key}[1]`,
            value: value[1],
            valueSpec: functionValueSpec,
            style: options.style,
            styleSpec: options.styleSpec
        }));
    }

    function validateStopDomainValue(options, stop) {
        const type = getType(options.value);
        const value = unbundle(options.value);

        const reportValue = options.value !== null ? options.value : stop;

        if (!stopKeyType) {
            stopKeyType = type;
        } else if (type !== stopKeyType) {
            return [new ValidationError(options.key, reportValue, `${type} stop domain type must match previous stop domain type ${stopKeyType}`)];
        }

        if (type !== 'number' && type !== 'string' && type !== 'boolean') {
            return [new ValidationError(options.key, reportValue, 'stop domain value must be a number, string, or boolean')];
        }

        if (type !== 'number' && functionType !== 'categorical') {
            let message = `number expected, ${type} found`;
            if (supportsPropertyExpression(functionValueSpec) && functionType === undefined) {
                message += '\nIf you intended to use a categorical function, specify `"type": "categorical"`.';
            }
            return [new ValidationError(options.key, reportValue, message)];
        }

        if (functionType === 'categorical' && type === 'number' && (!isFinite(value) || Math.floor(value) !== value)) {
            return [new ValidationError(options.key, reportValue, `integer expected, found ${value}`)];
        }

        if (functionType !== 'categorical' && type === 'number' && previousStopDomainValue !== undefined && value < previousStopDomainValue) {
            return [new ValidationError(options.key, reportValue, 'stop domain values must appear in ascending order')];
        } else {
            previousStopDomainValue = value;
        }

        if (functionType === 'categorical' && value in stopDomainValues) {
            return [new ValidationError(options.key, reportValue, 'stop domain values must be unique')];
        } else {
            stopDomainValues[value] = true;
        }

        return [];
    }

    function validateFunctionDefault(options) {
        return validate({
            key: options.key,
            value: options.value,
            valueSpec: functionValueSpec,
            style: options.style,
            styleSpec: options.styleSpec
        });
    }
}
