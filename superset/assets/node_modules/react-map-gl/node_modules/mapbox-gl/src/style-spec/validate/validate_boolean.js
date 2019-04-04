
import getType from '../util/get_type';
import ValidationError from '../error/validation_error';

export default function validateBoolean(options) {
    const value = options.value;
    const key = options.key;
    const type = getType(value);

    if (type !== 'boolean') {
        return [new ValidationError(key, value, `boolean expected, ${type} found`)];
    }

    return [];
}
