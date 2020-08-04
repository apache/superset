export default addAbsolutePathKeyword;
export type Ajv = import('ajv').Ajv;
export type SchemaUtilErrorObject = import('ajv').ErrorObject & {
  children?: import('ajv').ErrorObject[] | undefined;
};
/**
 *
 * @param {Ajv} ajv
 * @returns {Ajv}
 */
declare function addAbsolutePathKeyword(
  ajv: import('ajv').Ajv
): import('ajv').Ajv;
