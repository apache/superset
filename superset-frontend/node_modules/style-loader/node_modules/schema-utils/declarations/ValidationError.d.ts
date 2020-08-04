export default ValidationError;
export type JSONSchema6 = import('json-schema').JSONSchema6;
export type JSONSchema7 = import('json-schema').JSONSchema7;
export type Schema =
  | import('json-schema').JSONSchema4
  | import('json-schema').JSONSchema6
  | import('json-schema').JSONSchema7;
export type ValidationErrorConfiguration = {
  name?: string | undefined;
  baseDataPath?: string | undefined;
  postFormatter?: import('./validate').PostFormatter | undefined;
};
export type PostFormatter = (
  formattedError: string,
  error: import('ajv').ErrorObject & {
    children?: import('ajv').ErrorObject[] | undefined;
  }
) => string;
export type SchemaUtilErrorObject = import('ajv').ErrorObject & {
  children?: import('ajv').ErrorObject[] | undefined;
};
export type SPECIFICITY = number;
declare class ValidationError extends Error {
  /**
   * @param {Array<SchemaUtilErrorObject>} errors
   * @param {Schema} schema
   * @param {ValidationErrorConfiguration} configuration
   */
  constructor(
    errors: (import('ajv').ErrorObject & {
      children?: import('ajv').ErrorObject[] | undefined;
    })[],
    schema:
      | import('json-schema').JSONSchema4
      | import('json-schema').JSONSchema6
      | import('json-schema').JSONSchema7,
    configuration?: import('./validate').ValidationErrorConfiguration
  );
  /** @type {Array<SchemaUtilErrorObject>} */
  errors: Array<SchemaUtilErrorObject>;
  /** @type {Schema} */
  schema: Schema;
  /** @type {string} */
  headerName: string;
  /** @type {string} */
  baseDataPath: string;
  /** @type {PostFormatter | null} */
  postFormatter: PostFormatter | null;
  /**
   * @param {string} path
   * @returns {Schema}
   */
  getSchemaPart(
    path: string
  ):
    | import('json-schema').JSONSchema4
    | import('json-schema').JSONSchema6
    | import('json-schema').JSONSchema7;
  /**
   * @param {Schema} schema
   * @param {Array<Object>} prevSchemas
   * @returns {string}
   */
  formatSchema(
    schema:
      | import('json-schema').JSONSchema4
      | import('json-schema').JSONSchema6
      | import('json-schema').JSONSchema7,
    prevSchemas?: Object[]
  ): string;
  /**
   * @param {Schema=} schemaPart
   * @param {(boolean | Array<string>)=} additionalPath
   * @param {boolean=} needDot
   * @returns {string}
   */
  getSchemaPartText(
    schemaPart?:
      | import('json-schema').JSONSchema4
      | import('json-schema').JSONSchema6
      | import('json-schema').JSONSchema7
      | undefined,
    additionalPath?: boolean | string[] | undefined,
    needDot?: boolean | undefined
  ): string;
  /**
   * @param {Schema=} schemaPart
   * @returns {string}
   */
  getSchemaPartDescription(
    schemaPart?:
      | import('json-schema').JSONSchema4
      | import('json-schema').JSONSchema6
      | import('json-schema').JSONSchema7
      | undefined
  ): string;
  /**
   * @param {SchemaUtilErrorObject} error
   * @returns {string}
   */
  formatValidationError(
    error: import('ajv').ErrorObject & {
      children?: import('ajv').ErrorObject[] | undefined;
    }
  ): string;
  /**
   * @param {Array<SchemaUtilErrorObject>} errors
   * @returns {string}
   */
  formatValidationErrors(
    errors: (import('ajv').ErrorObject & {
      children?: import('ajv').ErrorObject[] | undefined;
    })[]
  ): string;
}
