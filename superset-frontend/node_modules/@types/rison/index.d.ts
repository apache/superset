// Type definitions for Rison
// Project: https://github.com/Nanonid/rison
// Definitions by: Andrei Kurosh <https://github.com/impworks>
// Definitions: https://github.com/borisyankov/DefinitelyTyped
export = rison;
export as namespace rison;
declare var rison: IRison;

interface IRison {
    /**
     * Rison-encodes a javascript structure.
     * @param obj Object to encode.
     * @returns {} Encoded string.
     */
    encode(obj: any): string;

    /**
     * Rison-encodes a javascript object without surrounding parens (O-Rison).
     * @param obj Object to encode.
     * @returns {} Encoded string.
     */
    encode_object<T>(obj: T): string;

    /**
     * Rison-encodes a javascript array without surrounding parens (A-Rison).
     * @param obj Object to encode.
     * @returns {} Encoded string.
     */
    encode_array<T>(arr: T[]): string;

    /**
     * Rison-encodes and then url-escapes a javascript structure.
     * @param obj Object to encode.
     * @returns {} Encoded string.
     */
    encode_uri(obj: any): string;

    /**
     * Parses a Rison string into a javascript structure.
     * @param encoded Encoded string.
     * @returns {} Resulting array or object.
     */
    decode<T>(encoded: string): T;

    /**
     * Parses a O-Rison string into a javascript object.
     * @param encoded Encoded string.
     * @returns {} Resulting object.
     */
    decode_object<T>(encoded: string): T;

    /**
     * Parses a A-Rison string into a javascript array.
     * @param encoded Encoded string.
     * @returns {} Resulting array.
     */
    decode_array<T>(encoded: string): T[];
}
