// @flow

import ValidationError from '../error/validation_error';

import { createExpression, createPropertyExpression } from '../expression';
import { deepUnbundle } from '../util/unbundle_jsonlint';
import { isStateConstant, isGlobalPropertyConstant, isFeatureConstant } from '../expression/is_constant';

export default function validateExpression(options: any): Array<ValidationError> {
    const expression = (options.expressionContext === 'property' ? createPropertyExpression : createExpression)(deepUnbundle(options.value), options.valueSpec);
    if (expression.result === 'error') {
        return expression.value.map((error) => {
            return new ValidationError(`${options.key}${error.key}`, options.value, error.message);
        });
    }

    const expressionObj = (expression.value: any).expression || (expression.value: any)._styleExpression.expression;

    if (options.expressionContext === 'property' && (options.propertyKey === 'text-font') &&
        expressionObj.possibleOutputs().indexOf(undefined) !== -1) {
        return [new ValidationError(options.key, options.value, `Invalid data expression for "${options.propertyKey}". Output values must be contained as literals within the expression.`)];
    }

    if (options.expressionContext === 'property' && options.propertyType === 'layout' &&
        (!isStateConstant(expressionObj))) {
        return [new ValidationError(options.key, options.value, '"feature-state" data expressions are not supported with layout properties.')];
    }

    if (options.expressionContext === 'filter' && !isStateConstant(expressionObj)) {
        return [new ValidationError(options.key, options.value, '"feature-state" data expressions are not supported with filters.')];
    }

    if (options.expressionContext && options.expressionContext.indexOf('cluster') === 0) {
        if (!isGlobalPropertyConstant(expressionObj, ['zoom', 'feature-state'])) {
            return [new ValidationError(options.key, options.value, '"zoom" and "feature-state" expressions are not supported with cluster properties.')];
        }
        if (options.expressionContext === 'cluster-initial' && !isFeatureConstant(expressionObj)) {
            return [new ValidationError(options.key, options.value, 'Feature data expressions are not supported with initial expression part of cluster properties.')];
        }
    }

    return [];
}
