import { EncodedQueryWithNulls } from './types';
/**
 * Update a location, wiping out parameters not included in encodedQuery
 */
export declare function updateLocation(encodedQuery: EncodedQueryWithNulls, location: Location): Location;
/**
 * Update a location while retaining existing parameters
 */
export declare function updateInLocation(encodedQueryReplacements: EncodedQueryWithNulls, location: Location): Location;
