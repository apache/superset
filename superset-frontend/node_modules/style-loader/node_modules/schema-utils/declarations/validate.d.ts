export default validate;
export type JSONSchema4 = import('json-schema').JSONSchema4;
export type JSONSchema6 = import('json-schema').JSONSchema6;
export type JSONSchema7 = import('json-schema').JSONSchema7;
export type ErrorObject = Ajv.ErrorObject;
export type Schema =
  | import('json-schema').JSONSchema4
  | import('json-schema').JSONSchema6
  | import('json-schema').JSONSchema7;
export type SchemaUtilErrorObject = Ajv.ErrorObject & {
  children?: Ajv.ErrorObject[] | undefined;
};
export type PostFormatter = (
  formattedError: string,
  error: Ajv.ErrorObject & {
    children?: Ajv.ErrorObject[] | undefined;
  }
) => string;
export type ValidationErrorConfiguration = {
  name?: string | undefined;
  baseDataPath?: string | undefined;
  postFormatter?: PostFormatter | undefined;
};
/**
 * @param {Schema} schema
 * @param {Array<object> | object} options
 * @param {ValidationErrorConfiguration=} configuration
 * @returns {void}
 */
declare function validate(
  schema:
    | import('json-schema').JSONSchema4
    | import('json-schema').JSONSchema6
    | import('json-schema').JSONSchema7,
  options: any,
  configuration?: ValidationErrorConfiguration | undefined
): void;
declare namespace validate {
  export { ValidationError };
  export { ValidationError as ValidateError };
}
import Ajv from 'ajv';
import ValidationError from './ValidationError';
