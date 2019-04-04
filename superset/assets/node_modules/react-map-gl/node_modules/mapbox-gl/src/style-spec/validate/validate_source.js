
import ValidationError from '../error/validation_error';
import { unbundle } from '../util/unbundle_jsonlint';
import validateObject from './validate_object';
import validateEnum from './validate_enum';

export default function validateSource(options) {
    const value = options.value;
    const key = options.key;
    const styleSpec = options.styleSpec;
    const style = options.style;

    if (!value.type) {
        return [new ValidationError(key, value, '"type" is required')];
    }

    const type = unbundle(value.type);
    let errors = [];

    switch (type) {
    case 'vector':
    case 'raster':
    case 'raster-dem':
        errors = errors.concat(validateObject({
            key,
            value,
            valueSpec: styleSpec[`source_${type.replace('-', '_')}`],
            style: options.style,
            styleSpec
        }));
        if ('url' in value) {
            for (const prop in value) {
                if (['type', 'url', 'tileSize'].indexOf(prop) < 0) {
                    errors.push(new ValidationError(`${key}.${prop}`, value[prop], `a source with a "url" property may not include a "${prop}" property`));
                }
            }
        }
        return errors;

    case 'geojson':
        return validateObject({
            key,
            value,
            valueSpec: styleSpec.source_geojson,
            style,
            styleSpec
        });

    case 'video':
        return validateObject({
            key,
            value,
            valueSpec: styleSpec.source_video,
            style,
            styleSpec
        });

    case 'image':
        return validateObject({
            key,
            value,
            valueSpec: styleSpec.source_image,
            style,
            styleSpec
        });

    case 'canvas':
        errors.push(new ValidationError(key, null, `Please use runtime APIs to add canvas sources, rather than including them in stylesheets.`, 'source.canvas'));
        return errors;

    default:
        return validateEnum({
            key: `${key}.type`,
            value: value.type,
            valueSpec: {values: ['vector', 'raster', 'raster-dem', 'geojson', 'video', 'image']},
            style,
            styleSpec
        });
    }
}
