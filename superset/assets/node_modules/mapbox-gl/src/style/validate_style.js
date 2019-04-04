// @flow
import validateStyleMin from '../style-spec/validate_style.min';
import { ErrorEvent } from '../util/evented';

import type {Evented} from '../util/evented';

type ValidationError = {
    message: string,
    line: number,
    identifier?: string
};

type Validator = (Object) => $ReadOnlyArray<ValidationError>;

export const validateStyle = (validateStyleMin: (Object, ?Object) => $ReadOnlyArray<ValidationError>);

export const validateSource = (validateStyleMin.source: Validator);
export const validateLight = (validateStyleMin.light: Validator);
export const validateFilter = (validateStyleMin.filter: Validator);
export const validatePaintProperty = (validateStyleMin.paintProperty: Validator);
export const validateLayoutProperty = (validateStyleMin.layoutProperty: Validator);

export function emitValidationErrors(emitter: Evented, errors: ?$ReadOnlyArray<{message: string, identifier?: string}>): boolean {
    let hasErrors = false;
    if (errors && errors.length) {
        for (const error of errors) {
            emitter.fire(new ErrorEvent(new Error(error.message)));
            hasErrors = true;
        }
    }
    return hasErrors;
}
