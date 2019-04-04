
import getType from '../util/get_type';
import ValidationError from '../error/validation_error';

export default function validateNumber(options) {
    const key = options.key;
    const value = options.value;
    const valueSpec = options.valueSpec;
    const type = getType(value);

    if (type !== 'number') {
        return [new ValidationError(key, value, `number expected, ${type} found`)];
    }

    if ('minimum' in valueSpec && value < valueSpec.minimum) {
        return [new ValidationError(key, value, `${value} is less than the minimum value ${valueSpec.minimum}`)];
    }

    if ('maximum' in valueSpec && value > valueSpec.maximum) {
        return [new ValidationError(key, value, `${value} is greater than the maximum value ${valueSpec.maximum}`)];
    }

    return [];
}
