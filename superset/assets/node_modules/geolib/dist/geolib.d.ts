// Type definitions for geolib v2.0.22
// Project: https://github.com/manuelbieh/Geolib
// Definitions by: Vladimir Venegas <https://github.com/vvenegasv>
// Definitions: 

declare namespace geolib {    

    export interface PositionAsDecimal {
        latitude: number,
        longitude: number        
    }

    export interface PositionAsSexadecimal {
        latitude: string,
        longitude: string
    }

    export interface PositionWithElevation extends PositionAsDecimal {
        elevation?: number
    }

    export interface PositionInTime extends PositionAsDecimal {
        time: number
    }

    export interface Bound {
        minLat: number,
        maxLat: number,
        minLng: number,
        maxLng: number,
        minElev?: number,
        maxElev?: number
    }

    export interface CompassDirection {
        rough: string,
        exact: string
    }

    export interface Distance {
        latitude: number,
        longitude: number,
        distance: number,
        key: string
    }

    export interface SpeedOption {
        unit: string
    }

    /** Calculates the distance between two geo coordinates
     * 
     * Return value is always float and represents the distance in meters.
     */
    function getDistance(start: PositionAsDecimal|PositionAsSexadecimal, end: PositionAsDecimal|PositionAsSexadecimal): number;    
    

    /** Calculates the distance between two geo coordinates
     * 
     * Return value is always float and represents the distance in meters.
     */
    function getDistance(start: PositionAsDecimal|PositionAsSexadecimal, end: PositionAsDecimal|PositionAsSexadecimal, accuracy: number, precision: number): number;
    

    /** Calculates the distance between two geo coordinates but this method is far more inaccurate as compared to getDistance.
     * It can take up 2 to 3 arguments. start, end and accuracy can be defined in the same as in getDistance.
     * 
     * Return value is always float that represents the distance in meters.
     */
    function getDistanceSimple(start: PositionAsDecimal|PositionAsSexadecimal, end: PositionAsDecimal|PositionAsSexadecimal): number;
    
    
    /** Calculates the distance between two geo coordinates but this method is far more inaccurate as compared to getDistance.
     * It can take up 2 to 3 arguments. start, end and accuracy can be defined in the same as in getDistance.
     * 
     * Return value is always float that represents the distance in meters. 
     */
    function getDistanceSimple(start: PositionAsDecimal|PositionAsSexadecimal, end: PositionAsDecimal|PositionAsSexadecimal, accuracy: number): number;
    
    
    /** Calculates the geographical center of all points in a collection of geo coordinates 
     * Takes an object or array of coordinates and calculates the center of it. 
     */
    function getCenter(coords: PositionAsDecimal[]): PositionAsDecimal;
    
    
    /** Calculates the center of the bounds of geo coordinates. Takes an array of coordinates, 
     * calculate the border of those, and gives back the center of that rectangle. On polygons 
     * like political borders (eg. states), this may gives a closer result to human expectation, 
     * than getCenter, because that function can be disturbed by uneven distribution of point in 
     * different sides. Imagine the US state Oklahoma: getCenter on that gives a southern point, 
     * because the southern border contains a lot more nodes, than the others. 
     */
    function getCenterOfBounds(coords: PositionAsDecimal[]): PositionAsDecimal;
            

    /** Calculates the bounds of geo coordinates.
     * 
     * Returns maximum and minimum, latitude, longitude, and elevation (if provided) in form of an object 
     */
    function getBounds(coords: PositionWithElevation[]): Bound;
        
    
    /** Checks whether a point is inside of a polygon or not. Note: the polygon coords must be in correct order! 
     * 
     * Returns true or false 
     */
    function isPointInside(latlng: PositionAsDecimal, polygon: PositionAsDecimal[]): boolean;
        
    
    /** Similar to is point inside: checks whether a point is inside of a circle or not. 
     * 
     * Returns true or false 
     */
    function isPointInCircle(latlng: PositionAsDecimal, center: PositionAsDecimal, radius: number): boolean;
    
        
    /** Gets rhumb line bearing of two points. Find out about the difference between rhumb line and great circle bearing on Wikipedia. 
     * Rhumb line should be fine in most cases: http://en.wikipedia.org/wiki/Rhumb_line#General_and_mathematical_description Function 
     * is heavily based on Doug Vanderweide's great PHP version (licensed under GPL 3.0) 
     * http://www.dougv.com/2009/07/13/calculating-the-bearing-and-compass-rose-direction-between-two-latitude-longitude-coordinates-in-php/ 
     * 
     * Returns calculated bearing as integer. 
     */
    function getRhumbLineBearing(originLL: PositionAsDecimal, destLL: PositionAsDecimal): number;
        
    
    /** Gets great circle bearing of two points. See description of getRhumbLineBearing for more information. 
     * 
     * Returns calculated bearing as integer 
     */
    function getBearing(originLL: PositionAsDecimal, destLL: PositionAsDecimal): number;
        
    
    /** Gets the compass direction from an origin coordinate (originLL) to a destination coordinate (destLL). 
     * Bearing mode. Can be either circle or rhumbline (default). 
     * 
     * Returns an object with a rough (NESW) and an exact direction (NNE, NE, ENE, E, ESE, etc).
     */
    function getCompassDirection(originLL: PositionAsDecimal, destLL: PositionAsDecimal): CompassDirection;
    
    
    /** Gets the compass direction from an origin coordinate (originLL) to a destination coordinate (destLL). 
     * Bearing mode. Can be either circle or rhumbline (default). 
     * 
     * Returns an object with a rough (NESW) and an exact direction (NNE, NE, ENE, E, ESE, etc).
     */
    function getCompassDirection(originLL: PositionAsDecimal, destLL: PositionAsDecimal, bearingMode: string): CompassDirection;
    

    /** Sorts an object or array of coords by distance from a reference coordinate */
    function orderByDistance(latlng: PositionAsDecimal, coords: PositionAsDecimal[]): Distance[];
    
    
    /** Finds the nearest coordinate to a reference coordinate. */
    function findNearest(latlng: PositionAsDecimal, coords: PositionAsDecimal[]): Distance[];
    

    /** Calculates the length of a collection of coordinates.
     * 
     * Returns the length of the path in meters */
    function getPathLength(coords: PositionAsDecimal[]): number;


    /** Calculates the speed between two points within a given time span. 
     * 
     * Returns the speed in options.unit (default is km/h). 
     */
    function getSpeed(coords: PositionInTime[]): number;


    /** Calculates the speed between two points within a given time span. 
     * 
     * Returns the speed in options.unit (default is km/h). 
     */
    function getSpeed(coords: PositionInTime[], option: SpeedOption): number;


    /** Calculates if given point lies in a line formed by start and end */
    function isPointInLine(point: PositionAsDecimal, start: PositionAsDecimal, end: PositionAsDecimal): boolean;


    /** Converts a given distance (in meters) to another unit. 
     * distance distance to be converted (source must be in meter). unit can be one of:
     * - m (meter)
     * - km (kilometers)
     * - cm (centimeters)
     * - mm (millimeters)
     * - mi (miles)
     * - sm (seamiles)
     * - ft (foot)
     * - in (inch)
     * - yd (yards)
    */
    function convertUnit(unit: string, distance: number): number;


    /** Converts a given distance (in meters) to another unit. 
     * distance distance to be converted (source must be in meter). unit can be one of:
     * - m (meter)
     * - km (kilometers)
     * - cm (centimeters)
     * - mm (millimeters)
     * - mi (miles)
     * - sm (seamiles)
     * - ft (foot)
     * - in (inch)
     * - yd (yards)
    */
    function convertUnit(unit: string, distance: number, round: number): number;


    /** Converts a sexagesimal coordinate to decimal format */
    function sexagesimal2decimal(coord: string): number;


    /** Converts a decimal coordinate to sexagesimal format */
    function decimal2sexagesimal(coord: number): string;

    /** Returns the latitude for a given point and converts it to decimal. 
     * Works with: latitude, lat, 1 (GeoJSON array) 
     */
    function latitude(latlng: any): number;

    /** Returns the longitude for a given point and converts it to decimal. 
     * Works with: longitude, lng, lon, 0 (GeoJSON array) 
     */
    function longitude(latlng: any): number;

    /** Returns the elevation for a given point and converts it to decimal. 
     * Works with: elevation, elev, alt, altitude, 2 (GeoJSON array) 
     */
    function elevation(latlng: any): number;


    /** Checks if a coordinate is already in decimal format and, if not, converts it to */
    function useDecimal(latlng: string|number): number;


    /** Computes the destination point given an initial point, a distance (in meters) and a bearing (in degrees). 
     * If no radius is given it defaults to the mean earth radius of 6371000 meter. 
     * 
     * Returns an object: `{"latitude": destLat, "longitude": destLng}` 
     * (Attention: this formula is not *100%* accurate (but very close though)) 
     */
    function computeDestinationPoint(start: PositionAsDecimal, distance: number, bearing: number): PositionAsDecimal;


    /** Computes the destination point given an initial point, a distance (in meters) and a bearing (in degrees). 
     * If no radius is given it defaults to the mean earth radius of 6371000 meter. 
     * 
     * Returns an object: `{"latitude": destLat, "longitude": destLng}` 
     * (Attention: this formula is not *100%* accurate (but very close though)) 
     */
    function computeDestinationPoint(start: PositionAsDecimal, distance: number, bearing: number, radius: number): PositionAsDecimal;
}

declare module "geolib" {
  export = geolib;
}
