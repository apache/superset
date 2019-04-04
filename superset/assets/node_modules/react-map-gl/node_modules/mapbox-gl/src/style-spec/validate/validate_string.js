
import getType from '../util/get_type';
import ValidationError from '../error/validation_error';

export default function validateString(options) {
    const value = options.value;
    const key = options.key;
    const type = getType(value);

    if (type !== 'string') {
        return [new ValidationError(key, value, `string expected, ${type} found`)];
    }

    return [];
}
