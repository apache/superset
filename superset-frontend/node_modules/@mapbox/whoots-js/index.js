(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
typeof define === 'function' && define.amd ? define(['exports'], factory) :
(factory((global.WhooTS = {})));
}(this, (function (exports) {
/**
 * getURL
 *
 * @param    {String}  baseUrl  Base url of the WMS server
 * @param    {String}  layer    Layer name
 * @param    {Number}  x        Tile coordinate x
 * @param    {Number}  y        Tile coordinate y
 * @param    {Number}  z        Tile zoom
 * @param    {Object}  [options]
 * @param    {String}  [options.format='image/png']
 * @param    {String}  [options.service='WMS']
 * @param    {String}  [options.version='1.1.1']
 * @param    {String}  [options.request='GetMap']
 * @param    {String}  [options.srs='EPSG:3857']
 * @param    {Number}  [options.width='256']
 * @param    {Number}  [options.height='256']
 * @returns  {String}  url
 * @example
 * var baseUrl = 'http://geodata.state.nj.us/imagerywms/Natural2015';
 * var layer = 'Natural2015';
 * var url = whoots.getURL(baseUrl, layer, 154308, 197167, 19);
 */
function getURL(baseUrl, layer, x, y, z, options) {
    options = options || {};

    var url = baseUrl + '?' + [
        'bbox='    + getTileBBox(x, y, z),
        'format='  + (options.format || 'image/png'),
        'service=' + (options.service || 'WMS'),
        'version=' + (options.version || '1.1.1'),
        'request=' + (options.request || 'GetMap'),
        'srs='     + (options.srs || 'EPSG:3857'),
        'width='   + (options.width || 256),
        'height='  + (options.height || 256),
        'layers='  + layer
    ].join('&');

    return url;
}


/**
 * getTileBBox
 *
 * @param    {Number}  x  Tile coordinate x
 * @param    {Number}  y  Tile coordinate y
 * @param    {Number}  z  Tile zoom
 * @returns  {String}  String of the bounding box
 */
function getTileBBox(x, y, z) {
    // for Google/OSM tile scheme we need to alter the y
    y = (Math.pow(2, z) - y - 1);

    var min = getMercCoords(x * 256, y * 256, z),
        max = getMercCoords((x + 1) * 256, (y + 1) * 256, z);

    return min[0] + ',' + min[1] + ',' + max[0] + ',' + max[1];
}


/**
 * getMercCoords
 *
 * @param    {Number}  x  Pixel coordinate x
 * @param    {Number}  y  Pixel coordinate y
 * @param    {Number}  z  Tile zoom
 * @returns  {Array}   [x, y]
 */
function getMercCoords(x, y, z) {
    var resolution = (2 * Math.PI * 6378137 / 256) / Math.pow(2, z),
        merc_x = (x * resolution - 2 * Math.PI  * 6378137 / 2.0),
        merc_y = (y * resolution - 2 * Math.PI  * 6378137 / 2.0);

    return [merc_x, merc_y];
}

exports.getURL = getURL;
exports.getTileBBox = getTileBBox;
exports.getMercCoords = getMercCoords;

Object.defineProperty(exports, '__esModule', { value: true });

})));
