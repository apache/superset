/**
 * Encoded query parameters (all strings)
 */
export interface EncodedQuery {
    [key: string]: string | string[];
}
/**
 * Encoded query parameters, possibly including null or undefined values
 */
export interface EncodedQueryWithNulls {
    [key: string]: string | string[] | null | undefined;
}
/**
 * Configuration for a query param specifying how to encode it
 * (convert it to a string) and decode it (convert it from a string
 * back to its native type)
 *
 * D = type to be encoded
 * D2 = type from decode (typically = D)
 */
export interface QueryParamConfig<D, D2 = D> {
    /** Convert the query param value to a string */
    encode: (value: D) => string | string[] | undefined;
    /** Convert the query param string value to its native type */
    decode: (value: string | string[]) => D2;
}
/**
 * Mapping from a query parameter name to a { encode, decode } config
 */
export interface QueryParamConfigMap {
    [paramName: string]: QueryParamConfig<any, any>;
}
/**
 * Mapping from a query parameter name to it's decoded value type
 */
export declare type DecodedValueMap<QPCMap extends QueryParamConfigMap> = {
    [P in keyof QPCMap]: ReturnType<QPCMap[P]['decode']>;
};
/**
 * Mapping from a query parameter name to it's encoded value type
 */
export declare type EncodedValueMap<QPCMap extends QueryParamConfigMap> = {
    [P in keyof QPCMap]: string | string[] | null | undefined;
};
