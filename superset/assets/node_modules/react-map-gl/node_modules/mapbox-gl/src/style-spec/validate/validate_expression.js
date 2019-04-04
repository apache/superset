// @flow

import ValidationError from '../error/validation_error';

import { createExpression, createPropertyExpression } from '../expression';
import { deepUnbundle } from '../util/unbundle_jsonlint';
import { isStateConstant } from '../expression/is_constant';

export default function validateExpression(options: any): Array<ValidationError> {
    const expression = (options.expressionContext === 'property' ? createPropertyExpression : createExpression)(deepUnbundle(options.value), options.valueSpec);
    if (expression.result === 'error') {
        return expression.value.map((error) => {
            return new ValidationError(`${options.key}${error.key}`, options.value, error.message);
        });
    }

    if (options.expressionContext === 'property' && (options.propertyKey === 'text-font') &&
        (expression.value: any)._styleExpression.expression.possibleOutputs().indexOf(undefined) !== -1) {
        return [new ValidationError(options.key, options.value, `Invalid data expression for "${options.propertyKey}". Output values must be contained as literals within the expression.`)];
    }

    if (options.expressionContext === 'property' && options.propertyType === 'layout' &&
        (!isStateConstant((expression.value: any)._styleExpression.expression))) {
        return [new ValidationError(options.key, options.value, '"feature-state" data expressions are not supported with layout properties.')];
    }

    if (options.expressionContext === 'filter' && !isStateConstant((expression.value: any).expression)) {
        return [new ValidationError(options.key, options.value, '"feature-state" data expressions are not supported with filters.')];
    }

    return [];
}
