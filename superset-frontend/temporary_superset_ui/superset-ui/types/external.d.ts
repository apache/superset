declare module 'json-bigint' {
  interface JSONbig {
    /**
     * Converts a JavaScript Object Notation (JSON) string into an object, preserving precision for numeric values.
     * @param text A valid JSON string.
     * @param reviver A function that transforms the results. This function is called for each member of the object.
     * If a member contains nested objects, the nested objects are transformed before the parent object is.
     */
    parse(text: string, reviver?: (key: any, value: any) => any): any;

    /**
     * Converts a JavaScript value to a JavaScript Object Notation (JSON) string, preserving precision for numeric values.
     * @param value A JavaScript value, usually an object or array, to be converted.
     * @param replacer A function that transforms the results, or an array of strings and numbers that acts
     *                 as a approved list for selecting the object properties that will be stringified.
     * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
     */
    stringify(
      value: any,
      replacer?: (number | string)[] | null | ((key: string, value: any) => any),
      space?: string | number,
    ): string;
  }

  /**
   * An intrinsic object that provides functions to convert JavaScript values to and from the JavaScript Object Notation (JSON) format.
   */
  const JSONbig: JSONbig;
  export = JSONbig;
}
