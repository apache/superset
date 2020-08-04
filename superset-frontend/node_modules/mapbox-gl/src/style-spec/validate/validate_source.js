
import ValidationError from '../error/validation_error';
import { unbundle } from '../util/unbundle_jsonlint';
import validateObject from './validate_object';
import validateEnum from './validate_enum';
import validateExpression from './validate_expression';

export default function validateSource(options) {
    const value = options.value;
    const key = options.key;
    const styleSpec = options.styleSpec;
    const style = options.style;

    if (!value.type) {
        return [new ValidationError(key, value, '"type" is required')];
    }

    const type = unbundle(value.type);
    let errors;

    switch (type) {
    case 'vector':
    case 'raster':
    case 'raster-dem':
        errors = validateObject({
            key,
            value,
            valueSpec: styleSpec[`source_${type.replace('-', '_')}`],
            style: options.style,
            styleSpec
        });
        if ('url' in value) {
            for (const prop in value) {
                if (['type', 'url', 'tileSize'].indexOf(prop) < 0) {
                    errors.push(new ValidationError(`${key}.${prop}`, value[prop], `a source with a "url" property may not include a "${prop}" property`));
                }
            }
        }
        return errors;

    case 'geojson':
        errors = validateObject({
            key,
            value,
            valueSpec: styleSpec.source_geojson,
            style,
            styleSpec
        });
        if (value.cluster) {
            for (const prop in value.clusterProperties) {
                const [operator, mapExpr] = value.clusterProperties[prop];
                const reduceExpr = typeof operator === 'string' ? [operator, ['accumulated'], ['get', prop]] : operator;

                errors.push(...validateExpression({
                    key: `${key}.${prop}.map`,
                    value: mapExpr,
                    expressionContext: 'cluster-map'
                }));
                errors.push(...validateExpression({
                    key: `${key}.${prop}.reduce`,
                    value: reduceExpr,
                    expressionContext: 'cluster-reduce'
                }));
            }
        }
        return errors;

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
        return [new ValidationError(key, null, `Please use runtime APIs to add canvas sources, rather than including them in stylesheets.`, 'source.canvas')];

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
