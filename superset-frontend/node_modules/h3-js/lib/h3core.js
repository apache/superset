/*
 * Copyright 2018-2019 Uber Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @module h3
 */

import C from '../out/libh3';
import BINDINGS from './bindings';

const H3 = {};

// Create the bound functions themselves
BINDINGS.forEach(function bind(def) {
    H3[def[0]] = C.cwrap(...def);
});

// Alias the hexidecimal base for legibility
const BASE_16 = 16;

// ----------------------------------------------------------------------------
// Byte size imports

const SZ_INT = 4;
const SZ_PTR = 4;
const SZ_DBL = 8;
const SZ_H3INDEX = H3.sizeOfH3Index();
const SZ_GEOCOORD = H3.sizeOfGeoCoord();
const SZ_GEOBOUNDARY = H3.sizeOfGeoBoundary();
const SZ_GEOPOLYGON = H3.sizeOfGeoPolygon();
const SZ_GEOFENCE = H3.sizeOfGeofence();
const SZ_LINKED_GEOPOLYGON = H3.sizeOfLinkedGeoPolygon();
const SZ_COORDIJ = H3.sizeOfCoordIJ();

// ----------------------------------------------------------------------------
// Custom types

/**
 * 64-bit hexidecimal string representation of an H3 index
 * @static
 * @typedef {string} H3Index
 */

/**
 * Coordinates as an `{i, j}` pair
 * @static
 * @typedef CoordIJ
 * @type {Object}
 * @property {number} i
 * @property {number} j
 */

// ----------------------------------------------------------------------------
// Unit constants
export const UNITS = {
    m: 'm',
    km: 'km',
    m2: 'm2',
    km2: 'km2'
};

// ----------------------------------------------------------------------------
// Utilities and helpers

/**
 * Validate a resolution, throwing an error if invalid
 * @private
 * @param  {mixed} res Value to validate
 * @throws {Error}     Error if invalid
 */
function validateRes(res) {
    if (typeof res !== 'number' || res < 0 || res > 15 || Math.floor(res) !== res) {
        throw new Error(`Invalid resolution: ${res}`);
    }
}

/**
 * Convert an H3 index (64-bit hexidecimal string) into a "split long" - a pair of 32-bit ints
 * @private
 * @param  {H3Index} h3Index  H3 index to check
 * @return {number[]}         A two-element array with 32 lower bits and 32 upper bits
 */
function h3IndexToSplitLong(h3Index) {
    if (typeof h3Index !== 'string') {
        return [0, 0];
    }
    const upper = parseInt(h3Index.substring(0, h3Index.length - 8), BASE_16);
    const lower = parseInt(h3Index.substring(h3Index.length - 8), BASE_16);
    return [lower, upper];
}

/**
 * Convert a 32-bit int to a hexdecimal string
 * @private
 * @param  {number} num  Integer to convert
 * @return {H3Index}     Hexidecimal string
 */
function hexFrom32Bit(num) {
    if (num >= 0) {
        return num.toString(BASE_16);
    }

    // Handle negative numbers
    num = num & 0x7fffffff;
    let tempStr = zeroPad(8, num.toString(BASE_16));
    const topNum = (parseInt(tempStr[0], BASE_16) + 8).toString(BASE_16);
    tempStr = topNum + tempStr.substring(1);
    return tempStr;
}

/**
 * Get a H3 index from a split long (pair of 32-bit ints)
 * @private
 * @param  {number} lower Lower 32 bits
 * @param  {number} upper Upper 32 bits
 * @return {H3Index}       H3 index
 */
function splitLongToh3Index(lower, upper) {
    return hexFrom32Bit(upper) + zeroPad(8, hexFrom32Bit(lower));
}

/**
 * Zero-pad a string to a given length
 * @private
 * @param  {number} fullLen Target length
 * @param  {string} numStr  String to zero-pad
 * @return {string}         Zero-padded string
 */
function zeroPad(fullLen, numStr) {
    const numZeroes = fullLen - numStr.length;
    let outStr = '';
    for (let i = 0; i < numZeroes; i++) {
        outStr += '0';
    }
    outStr = outStr + numStr;
    return outStr;
}

/**
 * Populate a C-appropriate Geofence struct from a polygon array
 * @private
 * @param  {Array[]} polygonArray Polygon, as an array of coordinate pairs
 * @param  {number}  geofence     C pointer to a Geofence struct
 * @param  {boolean} isGeoJson    Whether coordinates are in [lng, lat] order per GeoJSON spec
 * @return {number}               C pointer to populated Geofence struct
 */
function polygonArrayToGeofence(polygonArray, geofence, isGeoJson) {
    const numVerts = polygonArray.length;
    const geoCoordArray = C._calloc(numVerts, SZ_GEOCOORD);
    // Support [lng, lat] pairs if GeoJSON is specified
    const latIndex = isGeoJson ? 1 : 0;
    const lngIndex = isGeoJson ? 0 : 1;
    for (let i = 0; i < numVerts * 2; i += 2) {
        C.HEAPF64.set(
            [polygonArray[i / 2][latIndex], polygonArray[i / 2][lngIndex]].map(degsToRads),
            geoCoordArray / SZ_DBL + i
        );
    }
    C.HEAPU32.set([numVerts, geoCoordArray], geofence / SZ_INT);
    return geofence;
}

/**
 * Create a C-appropriate GeoPolygon struct from an array of polygons
 * @private
 * @param  {Array[]} coordinates  Array of polygons, each an array of coordinate pairs
 * @param  {boolean} isGeoJson    Whether coordinates are in [lng, lat] order per GeoJSON spec
 * @return {number}               C pointer to populated GeoPolygon struct
 */
function coordinatesToGeoPolygon(coordinates, isGeoJson) {
    // Any loops beyond the first loop are holes
    const numHoles = coordinates.length - 1;
    const geoPolygon = C._calloc(SZ_GEOPOLYGON);
    // Byte positions within the struct
    const geofenceOffset = 0;
    const numHolesOffset = geofenceOffset + SZ_GEOFENCE;
    const holesOffset = numHolesOffset + SZ_INT;
    // geofence is first part of struct
    polygonArrayToGeofence(coordinates[0], geoPolygon + geofenceOffset, isGeoJson);
    let holes;
    if (numHoles > 0) {
        holes = C._calloc(numHoles, SZ_GEOFENCE);
        for (let i = 0; i < numHoles; i++) {
            polygonArrayToGeofence(coordinates[i + 1], holes + SZ_GEOFENCE * i, isGeoJson);
        }
    }
    C.setValue(geoPolygon + numHolesOffset, numHoles, 'i32');
    C.setValue(geoPolygon + holesOffset, holes, 'i32');
    return geoPolygon;
}

/**
 * Free memory allocated for a GeoPolygon struct. It is an error to access the struct
 * after passing it to this method.
 * @private
 * @return {number} geoPolygon C pointer to populated GeoPolygon struct
 */
function destroyGeoPolygon(geoPolygon) {
    // Byte positions within the struct
    const geofenceOffset = 0;
    const numHolesOffset = geofenceOffset + SZ_GEOFENCE;
    const holesOffset = numHolesOffset + SZ_INT;
    // Free the outer loop
    C._free(C.getValue(geoPolygon + geofenceOffset, 'i8*'));
    // Free the holes, if any
    const numHoles = C.getValue(geoPolygon + numHolesOffset, 'i32');
    for (let i = 0; i < numHoles; i++) {
        C._free(C.getValue(geoPolygon + holesOffset + SZ_GEOFENCE * i, 'i8*'));
    }
    C._free(geoPolygon);
}

/**
 * Read a long value, returning the lower and upper portions as separate 32-bit integers.
 * Because the upper bits are returned via side effect, the argument to this function is
 * intended to be the invocation that caused the side effect, e.g. readLong(H3.getSomeLong())
 * @private
 * @param  {number} invocation Invoked function returning a long value. The actual return
 *                             value of these functions is a 32-bit integer.
 * @return {number}            Long value as a [lower, upper] pair
 */
function readLong(invocation) {
    // Upper 32-bits of the long set via side-effect
    const upper = C.getTempRet0();
    return [invocation, upper];
}

/**
 * Read an H3 index from a C return value. As with readLong, the argument to this function
 * is intended to be an invocation, e.g. readH3Index(H3.getSomeAddress()), to help ensure that
 * the temp value storing the upper bits of the long is still set.
 * @private
 * @param  {number} invocation  Invoked function returning a single H3 index
 * @return {H3Index}            H3 index, or null if index was invalid
 */
function readH3Index(invocation) {
    const [lower, upper] = readLong(invocation);
    // The lower bits are allowed to be 0s, but if the upper bits are 0
    // this represents an invalid H3 index
    return upper ? splitLongToh3Index(lower, upper) : null;
}

/**
 * Read an H3 index from a pointer to C memory.
 * @private
 * @param  {number} cAddress  Pointer to allocated C memory
 * @param {number} offset     Offset, in number of H3 indexes, in case we're
 *                            reading an array
 * @return {H3Index}          H3 index, or null if index was invalid
 */
function readH3IndexFromPointer(cAddress, offset = 0) {
    const lower = C.getValue(cAddress + SZ_INT * offset * 2, 'i32');
    const upper = C.getValue(cAddress + SZ_INT * (offset * 2 + 1), 'i32');
    // The lower bits are allowed to be 0s, but if the upper bits are 0
    // this represents an invalid H3 index
    return upper ? splitLongToh3Index(lower, upper) : null;
}

/**
 * Store an H3 index in C memory. Primarily used as an efficient way to
 * write sets of hexagons.
 * @private
 * @param  {H3Index} h3Index  H3 index to store
 * @param  {number} cAddress  Pointer to allocated C memory
 * @param {number} offset     Offset, in number of H3 indexes from beginning
 *                            of the current array
 */
function storeH3Index(h3Index, cAddress, offset) {
    // HEAPU32 is a typed array projection on the index space
    // as unsigned 32-bit integers. This means the index needs
    // to be divided by SZ_INT (4) to access correctly. Also,
    // the H3 index is 64 bits, so we skip by twos as we're writing
    // to 32-bit integers in the proper order.
    C.HEAPU32.set(h3IndexToSplitLong(h3Index), cAddress / SZ_INT + 2 * offset);
}

/**
 * Read an array of 64-bit H3 indexes from C and convert to a JS array of
 * H3 index strings
 * @private
 * @param  {number} cAddress    Pointer to C ouput array
 * @param  {number} maxCount    Max number of hexagons in array. Hexagons with
 *                              the value 0 will be skipped, so this isn't
 *                              necessarily the length of the output array.
 * @return {H3Index[]}          Array of H3 indexes
 */
function readArrayOfHexagons(cAddress, maxCount) {
    const out = [];
    for (let i = 0; i < maxCount; i++) {
        const h3Index = readH3IndexFromPointer(cAddress, i);
        if (h3Index !== null) {
            out.push(h3Index);
        }
    }
    return out;
}

/**
 * Store an array of H3 index strings as a C array of 64-bit integers.
 * @private
 * @param  {number} cAddress    Pointer to C input array
 * @param  {H3Index[]} hexagons H3 indexes to pass to the C lib
 */
function storeArrayOfHexagons(cAddress, hexagons) {
    // Assuming the cAddress points to an already appropriately
    // allocated space
    const count = hexagons.length;
    for (let i = 0; i < count; i++) {
        storeH3Index(hexagons[i], cAddress, i);
    }
}

function readSingleCoord(cAddress) {
    return radsToDegs(C.getValue(cAddress, 'double'));
}

/**
 * Read a GeoCoord from C and return a [lat, lng] pair.
 * @private
 * @param  {number} cAddress    Pointer to C struct
 * @return {number[]}           [lat, lng] pair
 */
function readGeoCoord(cAddress) {
    return [readSingleCoord(cAddress), readSingleCoord(cAddress + SZ_DBL)];
}

/**
 * Read a GeoCoord from C and return a GeoJSON-style [lng, lat] pair.
 * @private
 * @param  {number} cAddress    Pointer to C struct
 * @return {number[]}           [lng, lat] pair
 */
function readGeoCoordGeoJson(cAddress) {
    return [readSingleCoord(cAddress + SZ_DBL), readSingleCoord(cAddress)];
}

/**
 * Read the GeoBoundary structure into a list of geo coordinate pairs
 * @private
 * @param {number}  geoBoundary     C pointer to GeoBoundary struct
 * @param {boolean} geoJsonCoords   Whether to provide GeoJSON coordinate order: [lng, lat]
 * @param {boolean} closedLoop      Whether to close the loop
 * @return {Array[]}                Array of geo coordinate pairs
 */
function readGeoBoundary(geoBoundary, geoJsonCoords, closedLoop) {
    const numVerts = C.getValue(geoBoundary, 'i32');
    // Note that though numVerts is an int, the coordinate doubles have to be
    // aligned to 8 bytes, hence the 8-byte offset here
    const vertsPos = geoBoundary + SZ_DBL;
    const out = [];
    // Support [lng, lat] pairs if GeoJSON is specified
    const readCoord = geoJsonCoords ? readGeoCoordGeoJson : readGeoCoord;
    for (let i = 0; i < numVerts * 2; i += 2) {
        out.push(readCoord(vertsPos + SZ_DBL * i));
    }
    if (closedLoop) {
        // Close loop if GeoJSON is specified
        out.push(out[0]);
    }
    return out;
}

/**
 * Read the LinkedGeoPolygon structure into a nested array of MultiPolygon coordinates
 * @private
 * @param {number}  polygon         C pointer to LinkedGeoPolygon struct
 * @param {boolean} formatAsGeoJson Whether to provide GeoJSON output: [lng, lat], closed loops
 * @return {number[][][][]}         MultiPolygon-style output.
 */
function readMultiPolygon(polygon, formatAsGeoJson) {
    const output = [];
    const readCoord = formatAsGeoJson ? readGeoCoordGeoJson : readGeoCoord;
    let loops;
    let loop;
    let coords;
    let coord;
    // Loop through the linked structure, building the output
    while (polygon) {
        output.push((loops = []));
        // Follow ->first pointer
        loop = C.getValue(polygon, 'i8*');
        while (loop) {
            loops.push((coords = []));
            // Follow ->first pointer
            coord = C.getValue(loop, 'i8*');
            while (coord) {
                coords.push(readCoord(coord));
                // Follow ->next pointer
                coord = C.getValue(coord + SZ_DBL * 2, 'i8*');
            }
            if (formatAsGeoJson) {
                // Close loop if GeoJSON is requested
                coords.push(coords[0]);
            }
            // Follow ->next pointer
            loop = C.getValue(loop + SZ_PTR * 2, 'i8*');
        }
        // Follow ->next pointer
        polygon = C.getValue(polygon + SZ_PTR * 2, 'i8*');
    }
    return output;
}

/**
 * Read a CoordIJ from C and return an {i, j} pair.
 * @private
 * @param  {number} cAddress    Pointer to C struct
 * @return {CoordIJ}            {i, j} pair
 */
function readCoordIJ(cAddress) {
    return {
        i: C.getValue(cAddress, 'i32'),
        j: C.getValue(cAddress + SZ_INT, 'i32')
    };
}

/**
 * Store an {i, j} pair to a C CoordIJ struct.
 * @private
 * @param  {number} cAddress    Pointer to C struct
 * @return {CoordIJ}            {i, j} pair
 */
function storeCoordIJ(cAddress, {i, j}) {
    C.setValue(cAddress, i, 'i32');
    C.setValue(cAddress + SZ_INT, j, 'i32');
}

/**
 * Read an array of positive integers array from C. Negative
 * values are considered invalid and ignored in output.
 * @private
 * @param  {number} cAddress    Pointer to C array
 * @param  {number} count       Length of C array
 * @return {number[]}           Javascript integer array
 */
function readArrayOfPositiveIntegers(cAddress, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
        const int = C.getValue(cAddress + SZ_INT * i, 'i32');
        if (int >= 0) {
            out.push(int);
        }
    }
    return out;
}

// ----------------------------------------------------------------------------
// Public API functions: Core

/**
 * Whether a given string represents a valid H3 index
 * @static
 * @param  {H3Index} h3Index  H3 index to check
 * @return {boolean}          Whether the index is valid
 */
export function h3IsValid(h3Index) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    return Boolean(H3.h3IsValid(lower, upper));
}

/**
 * Whether the given H3 index is a pentagon
 * @static
 * @param  {H3Index} h3Index  H3 index to check
 * @return {boolean}          isPentagon
 */
export function h3IsPentagon(h3Index) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    return Boolean(H3.h3IsPentagon(lower, upper));
}

/**
 * Whether the given H3 index is in a Class III resolution (rotated versus
 * the icosahedron and subject to shape distortion adding extra points on
 * icosahedron edges, making them not true hexagons).
 * @static
 * @param  {H3Index} h3Index  H3 index to check
 * @return {boolean}          isResClassIII
 */
export function h3IsResClassIII(h3Index) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    return Boolean(H3.h3IsResClassIII(lower, upper));
}

/**
 * Get the number of the base cell for a given H3 index
 * @static
 * @param  {H3Index} h3Index  H3 index to get the base cell for
 * @return {number}           Index of the base cell (0-121)
 */
export function h3GetBaseCell(h3Index) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    return H3.h3GetBaseCell(lower, upper);
}

/**
 * Get the indices of all icosahedron faces intersected by a given H3 index
 * @static
 * @param  {H3Index} h3Index  H3 index to get faces for
 * @return {number[]}         Indices (0-19) of all intersected faces
 */
export function h3GetFaces(h3Index) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    const count = H3.maxFaceCount(lower, upper);
    const faces = C._malloc(SZ_INT * count);
    H3.h3GetFaces(lower, upper, faces);
    const out = readArrayOfPositiveIntegers(faces, count);
    C._free(faces);
    return out;
}

/**
 * Returns the resolution of an H3 index
 * @static
 * @param  {H3Index} h3Index H3 index to get resolution
 * @return {number}          The number (0-15) resolution, or -1 if invalid
 */
export function h3GetResolution(h3Index) {
    if (typeof h3Index !== 'string') {
        return -1;
    }
    return parseInt(h3Index.charAt(1), BASE_16);
}

/**
 * Get the hexagon containing a lat,lon point
 * @static
 * @param  {number} lat Latitude of point
 * @param  {number} lng Longtitude of point
 * @param  {number} res Resolution of hexagons to return
 * @return {H3Index}    H3 index
 */
export function geoToH3(lat, lng, res) {
    const latlng = C._malloc(SZ_GEOCOORD);
    // Slightly more efficient way to set the memory
    C.HEAPF64.set([lat, lng].map(degsToRads), latlng / SZ_DBL);
    // Read value as a split long
    const h3Index = readH3Index(H3.geoToH3(latlng, res));
    C._free(latlng);
    return h3Index;
}

/**
 * Get the lat,lon center of a given hexagon
 * @static
 * @param  {H3Index} h3Index  H3 index
 * @return {number[]}         Point as a [lat, lng] pair
 */
export function h3ToGeo(h3Index) {
    const latlng = C._malloc(SZ_GEOCOORD);
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    H3.h3ToGeo(lower, upper, latlng);
    const out = readGeoCoord(latlng);
    C._free(latlng);
    return out;
}

/**
 * Get the vertices of a given hexagon (or pentagon), as an array of [lat, lng]
 * points. For pentagons and hexagons on the edge of an icosahedron face, this
 * function may return up to 10 vertices.
 * @static
 * @param  {H3Index} h3Index          H3 index
 * @param {boolean} [formatAsGeoJson] Whether to provide GeoJSON output: [lng, lat], closed loops
 * @return {number[][]}               Array of [lat, lng] pairs
 */
export function h3ToGeoBoundary(h3Index, formatAsGeoJson) {
    const geoBoundary = C._malloc(SZ_GEOBOUNDARY);
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    H3.h3ToGeoBoundary(lower, upper, geoBoundary);
    const out = readGeoBoundary(geoBoundary, formatAsGeoJson, formatAsGeoJson);
    C._free(geoBoundary);
    return out;
}

// ----------------------------------------------------------------------------
// Public API functions: Algorithms

/**
 * Get the parent of the given hexagon at a particular resolution
 * @static
 * @param  {H3Index} h3Index  H3 index to get parent for
 * @param  {number} res       Resolution of hexagon to return
 * @return {H3Index}          H3 index of parent, or null for invalid input
 */
export function h3ToParent(h3Index, res) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    return readH3Index(H3.h3ToParent(lower, upper, res));
}

/**
 * Get the children/descendents of the given hexagon at a particular resolution
 * @static
 * @param  {H3Index} h3Index  H3 index to get children for
 * @param  {number} res       Resolution of hexagons to return
 * @return {H3Index[]}        H3 indexes of children, or empty array for invalid input
 */
export function h3ToChildren(h3Index, res) {
    // Bad input in this case can potentially result in high computation volume
    // using the current C algorithm. Validate and return an empty array on failure.
    if (!h3IsValid(h3Index)) {
        return [];
    }
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    const maxCount = H3.maxH3ToChildrenSize(lower, upper, res);
    const hexagons = C._calloc(maxCount, SZ_H3INDEX);
    H3.h3ToChildren(lower, upper, res, hexagons);
    const out = readArrayOfHexagons(hexagons, maxCount);
    C._free(hexagons);
    return out;
}

/**
 * Get the center child of the given hexagon at a particular resolution
 * @static
 * @param  {H3Index} h3Index  H3 index to get center child for
 * @param  {number} res       Resolution of hexagon to return
 * @return {H3Index}          H3 index of child, or null for invalid input
 */
export function h3ToCenterChild(h3Index, res) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    return readH3Index(H3.h3ToCenterChild(lower, upper, res));
}

/**
 * Get all hexagons in a k-ring around a given center. The order of the hexagons is undefined.
 * @static
 * @param  {H3Index} h3Index  H3 index of center hexagon
 * @param  {number} ringSize  Radius of k-ring
 * @return {H3Index[]}        H3 indexes for all hexagons in ring
 */
export function kRing(h3Index, ringSize) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    const maxCount = H3.maxKringSize(ringSize);
    const hexagons = C._calloc(maxCount, SZ_H3INDEX);
    H3.kRing(lower, upper, ringSize, hexagons);
    const out = readArrayOfHexagons(hexagons, maxCount);
    C._free(hexagons);
    return out;
}

/**
 * Get all hexagons in a k-ring around a given center, in an array of arrays
 * ordered by distance from the origin. The order of the hexagons within each ring is undefined.
 * @static
 * @param  {H3Index} h3Index  H3 index of center hexagon
 * @param  {number} ringSize  Radius of k-ring
 * @return {H3Index[][]}      Array of arrays with H3 indexes for all hexagons each ring
 */
export function kRingDistances(h3Index, ringSize) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    const maxCount = H3.maxKringSize(ringSize);
    const kRings = C._calloc(maxCount, SZ_H3INDEX);
    const distances = C._calloc(maxCount, SZ_INT);
    H3.kRingDistances(lower, upper, ringSize, kRings, distances);
    // Create an array of empty arrays to hold the output
    const out = [];
    for (let i = 0; i < ringSize + 1; i++) {
        out.push([]);
    }
    // Read the array of hexagons, putting them into the appropriate rings
    for (let i = 0; i < maxCount * 2; i += 2) {
        const hexLower = C.getValue(kRings + SZ_INT * i, 'i32');
        const hexUpper = C.getValue(kRings + SZ_INT * (i + 1), 'i32');
        const index = C.getValue(distances + SZ_INT * (i / 2), 'i32');
        if (hexLower !== 0 || hexUpper !== 0) {
            out[index].push(splitLongToh3Index(hexLower, hexUpper));
        }
    }
    C._free(kRings);
    C._free(distances);
    return out;
}

/**
 * Get all hexagons in a hollow hexagonal ring centered at origin with sides of a given length.
 * Unlike kRing, this function will throw an error if there is a pentagon anywhere in the ring.
 * @static
 * @param  {H3Index} h3Index  H3 index of center hexagon
 * @param  {number} ringSize  Radius of ring
 * @return {H3Index[]}        H3 indexes for all hexagons in ring
 * @throws {Error}            If the algorithm could not calculate the ring
 */
export function hexRing(h3Index, ringSize) {
    const maxCount = ringSize === 0 ? 1 : 6 * ringSize;
    const hexagons = C._calloc(maxCount, SZ_H3INDEX);
    const retVal = H3.hexRing(...h3IndexToSplitLong(h3Index), ringSize, hexagons);
    if (retVal !== 0) {
        C._free(hexagons);
        throw new Error('Failed to get hexRing (encountered a pentagon?)');
    }
    const out = readArrayOfHexagons(hexagons, maxCount);
    C._free(hexagons);
    return out;
}

/**
 * Get all hexagons with centers contained in a given polygon. The polygon
 * is specified with GeoJson semantics as an array of loops. Each loop is
 * an array of [lat, lng] pairs (or [lng, lat] if isGeoJson is specified).
 * The first loop is the perimeter of the polygon, and subsequent loops are
 * expected to be holes.
 * @static
 * @param  {number[][] | number[][][]} coordinates
 *                                  Array of loops, or a single loop
 * @param  {number} res             Resolution of hexagons to return
 * @param  {boolean} [isGeoJson]    Whether to expect GeoJson-style [lng, lat]
 *                                  pairs instead of [lat, lng]
 * @return {H3Index[]}              H3 indexes for all hexagons in polygon
 */
export function polyfill(coordinates, res, isGeoJson) {
    validateRes(res);
    isGeoJson = Boolean(isGeoJson);
    // Guard against empty input
    if (coordinates.length === 0 || coordinates[0].length === 0) {
        return [];
    }
    // Wrap to expected format if a single loop is provided
    if (typeof coordinates[0][0] === 'number') {
        coordinates = [coordinates];
    }
    const geoPolygon = coordinatesToGeoPolygon(coordinates, isGeoJson);
    const arrayLen = H3.maxPolyfillSize(geoPolygon, res);
    const hexagons = C._calloc(arrayLen, SZ_H3INDEX);
    H3.polyfill(geoPolygon, res, hexagons);
    const out = readArrayOfHexagons(hexagons, arrayLen);
    C._free(hexagons);
    destroyGeoPolygon(geoPolygon);
    return out;
}

/**
 * Get the outlines of a set of H3 hexagons, returned in GeoJSON MultiPolygon
 * format (an array of polygons, each with an array of loops, each an array of
 * coordinates). Coordinates are returned as [lat, lng] pairs unless GeoJSON
 * is requested.
 * @static
 * @param {H3Index[]} h3Indexes       H3 indexes to get outlines for
 * @param {boolean} [formatAsGeoJson] Whether to provide GeoJSON output:
 *                                    [lng, lat], closed loops
 * @return {number[][][][]}           MultiPolygon-style output.
 */
export function h3SetToMultiPolygon(h3Indexes, formatAsGeoJson) {
    // Early exit on empty input
    if (!h3Indexes || !h3Indexes.length) {
        return [];
    }
    // Set up input set
    const indexCount = h3Indexes.length;
    const set = C._calloc(indexCount, SZ_H3INDEX);
    storeArrayOfHexagons(set, h3Indexes);
    // Allocate memory for output linked polygon
    const polygon = C._calloc(SZ_LINKED_GEOPOLYGON);
    // Store a reference to the first polygon - that's the one we need for
    // memory deallocation
    const originalPolygon = polygon;
    H3.h3SetToLinkedGeo(set, indexCount, polygon);
    const multiPolygon = readMultiPolygon(polygon, formatAsGeoJson);
    // Clean up
    H3.destroyLinkedPolygon(originalPolygon);
    C._free(originalPolygon);
    C._free(set);
    return multiPolygon;
}

/**
 * Compact a set of hexagons of the same resolution into a set of hexagons across
 * multiple levels that represents the same area.
 * @static
 * @param  {H3Index[]} h3Set H3 indexes to compact
 * @return {H3Index[]}       Compacted H3 indexes
 * @throws {Error}           If the input is invalid (e.g. duplicate hexagons)
 */
export function compact(h3Set) {
    if (!h3Set || !h3Set.length) {
        return [];
    }
    // Set up input set
    const count = h3Set.length;
    const set = C._calloc(count, SZ_H3INDEX);
    storeArrayOfHexagons(set, h3Set);
    // Allocate memory for compacted hexagons, worst-case is no compaction
    const compactedSet = C._calloc(count, SZ_H3INDEX);
    const retVal = H3.compact(set, compactedSet, count);
    if (retVal !== 0) {
        C._free(set);
        C._free(compactedSet);
        throw new Error('Failed to compact, malformed input data (duplicate hexagons?)');
    }
    const out = readArrayOfHexagons(compactedSet, count);
    C._free(set);
    C._free(compactedSet);
    return out;
}

/**
 * Uncompact a compacted set of hexagons to hexagons of the same resolution
 * @static
 * @param  {H3Index[]} compactedSet H3 indexes to uncompact
 * @param  {number}    res          The resolution to uncompact to
 * @return {H3Index[]}              The uncompacted H3 indexes
 * @throws {Error}                  If the input is invalid (e.g. invalid resolution)
 */
export function uncompact(compactedSet, res) {
    validateRes(res);
    if (!compactedSet || !compactedSet.length) {
        return [];
    }
    // Set up input set
    const count = compactedSet.length;
    const set = C._calloc(count, SZ_H3INDEX);
    storeArrayOfHexagons(set, compactedSet);
    // Estimate how many hexagons we need (always overestimates if in error)
    const maxUncompactedNum = H3.maxUncompactSize(set, count, res);
    // Allocate memory for uncompacted hexagons
    const uncompactedSet = C._calloc(maxUncompactedNum, SZ_H3INDEX);
    const retVal = H3.uncompact(set, count, uncompactedSet, maxUncompactedNum, res);
    if (retVal !== 0) {
        C._free(set);
        C._free(uncompactedSet);
        throw new Error('Failed to uncompact (bad resolution?)');
    }
    const out = readArrayOfHexagons(uncompactedSet, maxUncompactedNum);
    C._free(set);
    C._free(uncompactedSet);
    return out;
}

// ----------------------------------------------------------------------------
// Public API functions: Unidirectional edges

/**
 * Whether two H3 indexes are neighbors (share an edge)
 * @static
 * @param  {H3Index} origin      Origin hexagon index
 * @param  {H3Index} destination Destination hexagon index
 * @return {boolean}             Whether the hexagons share an edge
 */
export function h3IndexesAreNeighbors(origin, destination) {
    const [oLower, oUpper] = h3IndexToSplitLong(origin);
    const [dLower, dUpper] = h3IndexToSplitLong(destination);
    return Boolean(H3.h3IndexesAreNeighbors(oLower, oUpper, dLower, dUpper));
}

/**
 * Get an H3 index representing a unidirectional edge for a given origin and destination
 * @static
 * @param  {H3Index} origin      Origin hexagon index
 * @param  {H3Index} destination Destination hexagon index
 * @return {H3Index}             H3 index of the edge, or null if no edge is shared
 */
export function getH3UnidirectionalEdge(origin, destination) {
    const [oLower, oUpper] = h3IndexToSplitLong(origin);
    const [dLower, dUpper] = h3IndexToSplitLong(destination);
    return readH3Index(H3.getH3UnidirectionalEdge(oLower, oUpper, dLower, dUpper));
}

/**
 * Get the origin hexagon from an H3 index representing a unidirectional edge
 * @static
 * @param  {H3Index} edgeIndex H3 index of the edge
 * @return {H3Index}           H3 index of the edge origin
 */
export function getOriginH3IndexFromUnidirectionalEdge(edgeIndex) {
    const [lower, upper] = h3IndexToSplitLong(edgeIndex);
    return readH3Index(H3.getOriginH3IndexFromUnidirectionalEdge(lower, upper));
}

/**
 * Get the destination hexagon from an H3 index representing a unidirectional edge
 * @static
 * @param  {H3Index} edgeIndex H3 index of the edge
 * @return {H3Index}           H3 index of the edge destination
 */
export function getDestinationH3IndexFromUnidirectionalEdge(edgeIndex) {
    const [lower, upper] = h3IndexToSplitLong(edgeIndex);
    return readH3Index(H3.getDestinationH3IndexFromUnidirectionalEdge(lower, upper));
}

/**
 * Whether the input is a valid unidirectional edge
 * @static
 * @param  {H3Index} edgeIndex H3 index of the edge
 * @return {boolean}           Whether the index is valid
 */
export function h3UnidirectionalEdgeIsValid(edgeIndex) {
    const [lower, upper] = h3IndexToSplitLong(edgeIndex);
    return Boolean(H3.h3UnidirectionalEdgeIsValid(lower, upper));
}

/**
 * Get the [origin, destination] pair represented by a unidirectional edge
 * @static
 * @param  {H3Index} edgeIndex H3 index of the edge
 * @return {H3Index[]}         [origin, destination] pair as H3 indexes
 */
export function getH3IndexesFromUnidirectionalEdge(edgeIndex) {
    const [lower, upper] = h3IndexToSplitLong(edgeIndex);
    const count = 2;
    const hexagons = C._calloc(count, SZ_H3INDEX);
    H3.getH3IndexesFromUnidirectionalEdge(lower, upper, hexagons);
    const out = readArrayOfHexagons(hexagons, count);
    C._free(hexagons);
    return out;
}

/**
 * Get all of the unidirectional edges with the given H3 index as the origin (i.e. an edge to
 * every neighbor)
 * @static
 * @param  {H3Index} h3Index   H3 index of the origin hexagon
 * @return {H3Index[]}         List of unidirectional edges
 */
export function getH3UnidirectionalEdgesFromHexagon(h3Index) {
    const [lower, upper] = h3IndexToSplitLong(h3Index);
    const count = 6;
    const edges = C._calloc(count, SZ_H3INDEX);
    H3.getH3UnidirectionalEdgesFromHexagon(lower, upper, edges);
    const out = readArrayOfHexagons(edges, count);
    C._free(edges);
    return out;
}

/**
 * Get the vertices of a given edge as an array of [lat, lng] points. Note that for edges that
 * cross the edge of an icosahedron face, this may return 3 coordinates.
 * @static
 * @param  {H3Index} edgeIndex        H3 index of the edge
 * @param {boolean} [formatAsGeoJson] Whether to provide GeoJSON output: [lng, lat]
 * @return {number[][]}               Array of geo coordinate pairs
 */
export function getH3UnidirectionalEdgeBoundary(edgeIndex, formatAsGeoJson) {
    const geoBoundary = C._malloc(SZ_GEOBOUNDARY);
    const [lower, upper] = h3IndexToSplitLong(edgeIndex);
    H3.getH3UnidirectionalEdgeBoundary(lower, upper, geoBoundary);
    const out = readGeoBoundary(geoBoundary, formatAsGeoJson);
    C._free(geoBoundary);
    return out;
}

/**
 * Get the grid distance between two hex indexes. This function may fail
 * to find the distance between two indexes if they are very far apart or
 * on opposite sides of a pentagon.
 * @static
 * @param  {H3Index} origin      Origin hexagon index
 * @param  {H3Index} destination Destination hexagon index
 * @return {number}              Distance between hexagons, or a negative
 *                               number if the distance could not be computed
 */
export function h3Distance(origin, destination) {
    const [oLower, oUpper] = h3IndexToSplitLong(origin);
    const [dLower, dUpper] = h3IndexToSplitLong(destination);
    return H3.h3Distance(oLower, oUpper, dLower, dUpper);
}

/**
 * Given two H3 indexes, return the line of indexes between them (inclusive).
 *
 * This function may fail to find the line between two indexes, for
 * example if they are very far apart. It may also fail when finding
 * distances for indexes on opposite sides of a pentagon.
 *
 * Notes:
 *
 *  - The specific output of this function should not be considered stable
 *    across library versions. The only guarantees the library provides are
 *    that the line length will be `h3Distance(start, end) + 1` and that
 *    every index in the line will be a neighbor of the preceding index.
 *  - Lines are drawn in grid space, and may not correspond exactly to either
 *    Cartesian lines or great arcs.
 *
 * @static
 * @param  {H3Index} origin      Origin hexagon index
 * @param  {H3Index} destination Destination hexagon index
 * @return {H3Index[]}           H3 indexes connecting origin and destination
 * @throws {Error}               If the line cannot be calculated
 */
export function h3Line(origin, destination) {
    const [oLower, oUpper] = h3IndexToSplitLong(origin);
    const [dLower, dUpper] = h3IndexToSplitLong(destination);
    const count = H3.h3LineSize(oLower, oUpper, dLower, dUpper);
    if (count < 0) {
        // We can't get the specific error code here - may be any of
        // the errors possible in experimentalH3ToLocalIj
        throw new Error('Line cannot be calculated');
    }
    const hexagons = C._calloc(count, SZ_H3INDEX);
    H3.h3Line(oLower, oUpper, dLower, dUpper, hexagons);
    const out = readArrayOfHexagons(hexagons, count);
    C._free(hexagons);
    return out;
}

/**
 * Produces IJ coordinates for an H3 index anchored by an origin.
 *
 * - The coordinate space used by this function may have deleted
 * regions or warping due to pentagonal distortion.
 * - Coordinates are only comparable if they come from the same
 * origin index.
 * - Failure may occur if the index is too far away from the origin
 * or if the index is on the other side of a pentagon.
 * - This function is experimental, and its output is not guaranteed
 * to be compatible across different versions of H3.
 * @static
 * @param  {H3Index} origin      Origin H3 index
 * @param  {H3Index} destination H3 index for which to find relative coordinates
 * @return {CoordIJ}             Coordinates as an `{i, j}` pair
 * @throws {Error}               If the IJ coordinates cannot be calculated
 */
export function experimentalH3ToLocalIj(origin, destination) {
    const ij = C._malloc(SZ_COORDIJ);
    const retVal = H3.experimentalH3ToLocalIj(
        ...h3IndexToSplitLong(origin),
        ...h3IndexToSplitLong(destination),
        ij
    );
    const coords = readCoordIJ(ij);
    C._free(ij);
    // Return the pair, or throw if an error code was returned.
    // Switch statement and error codes cribbed from h3-java's implementation.
    switch (retVal) {
        case 0:
            return coords;
        case 1:
            throw new Error('Incompatible origin and index.');
        case 2:
        default:
            throw new Error(
                'Local IJ coordinates undefined for this origin and index pair. ' +
                    'The index may be too far from the origin.'
            );
        case 3:
        case 4:
        case 5:
            throw new Error('Encountered possible pentagon distortion');
    }
}

/**
 * Produces an H3 index for IJ coordinates anchored by an origin.
 *
 * - The coordinate space used by this function may have deleted
 * regions or warping due to pentagonal distortion.
 * - Coordinates are only comparable if they come from the same
 * origin index.
 * - Failure may occur if the index is too far away from the origin
 * or if the index is on the other side of a pentagon.
 * - This function is experimental, and its output is not guaranteed
 * to be compatible across different versions of H3.
 * @static
 * @param  {H3Index} origin     Origin H3 index
 * @param  {CoordIJ} coords     Coordinates as an `{i, j}` pair
 * @return {H3Index}            H3 index at the relative coordinates
 * @throws {Error}              If the H3 index cannot be calculated
 */
export function experimentalLocalIjToH3(origin, coords) {
    // Validate input coords
    if (!coords || typeof coords.i !== 'number' || typeof coords.j !== 'number') {
        throw new Error('Coordinates must be provided as an {i, j} object');
    }
    // Allocate memory for the CoordIJ struct and an H3 index to hold the return value
    const ij = C._malloc(SZ_COORDIJ);
    const out = C._malloc(SZ_H3INDEX);
    storeCoordIJ(ij, coords);
    const retVal = H3.experimentalLocalIjToH3(...h3IndexToSplitLong(origin), ij, out);
    const h3Index = readH3IndexFromPointer(out);
    C._free(ij);
    C._free(out);
    if (retVal !== 0) {
        throw new Error(
            'Index not defined for this origin and IJ coordinates pair. ' +
                'IJ coordinates may be too far from origin, or ' +
                'a pentagon distortion was encountered.'
        );
    }
    return h3Index;
}

// ----------------------------------------------------------------------------
// Public informational utilities

/**
 * Average hexagon area at a given resolution
 * @static
 * @param  {number} res  Hexagon resolution
 * @param  {string} unit Area unit (either UNITS.m2 or UNITS.km2)
 * @return {number}      Average area
 * @throws {Error}       If the unit is invalid
 */
export function hexArea(res, unit) {
    validateRes(res);
    switch (unit) {
        case UNITS.m2:
            return H3.hexAreaM2(res);
        case UNITS.km2:
            return H3.hexAreaKm2(res);
        default:
            throw new Error(`Unknown unit: ${unit}`);
    }
}

/**
 * Average hexagon edge length at a given resolution
 * @static
 * @param  {number} res  Hexagon resolution
 * @param  {string} unit Area unit (either UNITS.m or UNITS.km)
 * @return {number}      Average edge length
 * @throws {Error}       If the unit is invalid
 */
export function edgeLength(res, unit) {
    validateRes(res);
    switch (unit) {
        case UNITS.m:
            return H3.edgeLengthM(res);
        case UNITS.km:
            return H3.edgeLengthKm(res);
        default:
            throw new Error(`Unknown unit: ${unit}`);
    }
}

/**
 * The total count of hexagons in the world at a given resolution. Note that above
 * resolution 8 the exact count cannot be represented in a JavaScript 32-bit number,
 * so consumers should use caution when applying further operations to the output.
 * @static
 * @param  {number} res  Hexagon resolution
 * @return {number}      Count
 */
export function numHexagons(res) {
    validateRes(res);
    // Get number as a long value
    const [lower, upper] = readLong(H3.numHexagons(res));
    // If we're using <= 32 bits we can use normal JS numbers
    if (!upper) {
        return lower;
    }
    // Above 32 bit, make a JS number that's correct in order of magnitude
    return upper * Math.pow(2, 32) + lower;
}

/**
 * Get all H3 indexes at resolution 0. As every index at every resolution > 0 is
 * the descendant of a res 0 index, this can be used with h3ToChildren to iterate
 * over H3 indexes at any resolution.
 * @static
 * @return {H3Index[]}  All H3 indexes at res 0
 */
export function getRes0Indexes() {
    const count = H3.res0IndexCount();
    const hexagons = C._malloc(SZ_H3INDEX * count);
    H3.getRes0Indexes(hexagons);
    const out = readArrayOfHexagons(hexagons, count);
    C._free(hexagons);
    return out;
}

/**
 * Get the twelve pentagon indexes at a given resolution.
 * @static
 * @param  {number} res  Hexagon resolution
 * @return {H3Index[]}  All H3 pentagon indexes at res
 */
export function getPentagonIndexes(res) {
    validateRes(res);
    const count = H3.pentagonIndexCount();
    const hexagons = C._malloc(SZ_H3INDEX * count);
    H3.getPentagonIndexes(res, hexagons);
    const out = readArrayOfHexagons(hexagons, count);
    C._free(hexagons);
    return out;
}

/**
 * Convert degrees to radians
 * @static
 * @param  {number} deg Value in degrees
 * @return {number}     Value in radians
 */
export function degsToRads(deg) {
    return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 * @static
 * @param  {number} rad Value in radians
 * @return {number}     Value in degrees
 */
export function radsToDegs(rad) {
    return (rad * 180) / Math.PI;
}
