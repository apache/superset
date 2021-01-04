import {Inferred} from 'typings/Inferred'
/**
 * @interface TestInput
 * @param inputs test input to parse.  Can be a string array or an array of objects
 * @param event event to parse input for.
 */
export interface TestInput {
  inputs: string[] | string[][] | object | Inferred[]
  events: string | string[]
}
