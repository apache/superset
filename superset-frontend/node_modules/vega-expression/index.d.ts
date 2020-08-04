// TODO: add missing types

export function parse(expression: string): any;

export function codegen(params: {
  constants?: object;
  functions?: { [fn: string]: Function };
  blacklist?: string[];
  whitelist?: string[];
  fieldvar?: string;
  globalvar: string;
}): (
  ast: any
) => {
  /** The generated code as a string. */
  code: string;
  /** A hash of all properties referenced within the fieldvar scope. */
  fields: string[];
  /** A hash of all properties referenced outside a provided whitelist */
  globals: string[];
};
