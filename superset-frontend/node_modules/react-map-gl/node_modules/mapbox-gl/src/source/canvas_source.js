// @flow

import ImageSource from './image_source';

import window from '../util/window';
import rasterBoundsAttributes from '../data/raster_bounds_attributes';
import SegmentVector from '../data/segment';
import Texture from '../render/texture';
import { ErrorEvent } from '../util/evented';
import ValidationError from '../style-spec/error/validation_error';

import type Map from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type {Evented} from '../util/evented';

export type CanvasSourceSpecification = {|
    "type": "canvas",
    "coordinates": [[number, number], [number, number], [number, number], [number, number]],
    "animate"?: boolean,
    "canvas": string | HTMLCanvasElement
|};

/**
 * Options to add a canvas source type to the map.
 *
 * @typedef {Object} CanvasSourceOptions
 * @property {string} type Source type. Must be `"canvas"`.
 * @property {string|HTMLCanvasElement} canvas Canvas source from which to read pixels. Can be a string representing the ID of the canvas element, or the `HTMLCanvasElement` itself.
 * @property {Array<Array<number>>} coordinates Four geographical coordinates denoting where to place the corners of the canvas, specified in `[longitude, latitude]` pairs.
 * @property {boolean} [animate=true] Whether the canvas source is animated. If the canvas is static (i.e. pixels do not need to be re-read on every frame), `animate` should be set to `false` to improve performance.
 */

/**
 * A data source containing the contents of an HTML canvas. See {@link CanvasSourceOptions} for detailed documentation of options.
 *
 * @example
 * // add to map
 * map.addSource('some id', {
 *    type: 'canvas',
 *    canvas: 'idOfMyHTMLCanvas',
 *    animate: true,
 *    coordinates: [
 *        [-76.54, 39.18],
 *        [-76.52, 39.18],
 *        [-76.52, 39.17],
 *        [-76.54, 39.17]
 *    ]
 * });
 *
 * // update
 * var mySource = map.getSource('some id');
 * mySource.setCoordinates([
 *     [-76.54335737228394, 39.18579907229748],
 *     [-76.52803659439087, 39.1838364847587],
 *     [-76.5295386314392, 39.17683392507606],
 *     [-76.54520273208618, 39.17876344106642]
 * ]);
 *
 * map.removeSource('some id');  // remove
 */
class CanvasSource extends ImageSource {
    options: CanvasSourceSpecification;
    animate: boolean;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    play: () => void;
    pause: () => void;
    _playing: boolean;

    /**
     * @private
     */
    constructor(id: string, options: CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);

        // We build in some validation here, since canvas sources aren't included in the style spec:
        if (!options.coordinates) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, 'missing required property "coordinates"')));
        } else if (!Array.isArray(options.coordinates) || options.coordinates.length !== 4 ||
                options.coordinates.some(c => !Array.isArray(c) || c.length !== 2 || c.some(l => typeof l !== 'number'))) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, '"coordinates" property must be an array of 4 longitude/latitude array pairs')));
        }

        if (options.animate && typeof options.animate !== 'boolean') {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, 'optional "animate" property must be a boolean value')));
        }

        if (!options.canvas) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, 'missing required property "canvas"')));
        } else if (typeof options.canvas !== 'string' && !(options.canvas instanceof window.HTMLCanvasElement)) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, '"canvas" must be either a string representing the ID of the canvas element from which to read, or an HTMLCanvasElement instance')));
        }

        this.options = options;
        this.animate = options.animate !== undefined ? options.animate : true;
    }

    /**
     * Enables animation. The image will be copied from the canvas to the map on each frame.
     * @method play
     * @instance
     * @memberof CanvasSource
     */

    /**
     * Disables animation. The map will display a static copy of the canvas image.
     * @method pause
     * @instance
     * @memberof CanvasSource
     */

    load() {
        if (!this.canvas) {
            this.canvas = (this.options.canvas instanceof window.HTMLCanvasElement) ?
                this.options.canvas :
                window.document.getElementById(this.options.canvas);
        }
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        if (this._hasInvalidDimensions()) {
            this.fire(new ErrorEvent(new Error('Canvas dimensions cannot be less than or equal to zero.')));
            return;
        }

        this.play = function() {
            this._playing = true;
            this.map.triggerRepaint();
        };

        this.pause = function() {
            if (this._playing) {
                this.prepare();
                this._playing = false;
            }
        };

        this._finishLoading();
    }

    /**
     * Returns the HTML `canvas` element.
     *
     * @returns {HTMLCanvasElement} The HTML `canvas` element.
     */
    getCanvas() {
        return this.canvas;
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
        if (this.canvas) {
            if (this.animate) this.play();
        }
    }

    onRemove() {
        this.pause();
    }

    /**
     * Sets the canvas's coordinates and re-renders the map.
     *
     * @method setCoordinates
     * @instance
     * @memberof CanvasSource
     * @param {Array<Array<number>>} coordinates Four geographical coordinates,
     *   represented as arrays of longitude and latitude numbers, which define the corners of the canvas.
     *   The coordinates start at the top left corner of the canvas and proceed in clockwise order.
     *   They do not have to represent a rectangle.
     * @returns {CanvasSource} this
     */
    // setCoordinates inherited from ImageSource

    prepare() {
        let resize = false;
        if (this.canvas.width !== this.width) {
            this.width = this.canvas.width;
            resize = true;
        }
        if (this.canvas.height !== this.height) {
            this.height = this.canvas.height;
            resize = true;
        }

        if (this._hasInvalidDimensions()) return;

        if (Object.keys(this.tiles).length === 0) return; // not enough data for current position

        const context = this.map.painter.context;
        const gl = context.gl;

        if (!this.boundsBuffer) {
            this.boundsBuffer = context.createVertexBuffer(this._boundsArray, rasterBoundsAttributes.members);
        }

        if (!this.boundsSegments) {
            this.boundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
        }

        if (!this.texture) {
            this.texture = new Texture(context, this.canvas, gl.RGBA, { premultiply: true });
        } else if (resize || this._playing) {
            this.texture.update(this.canvas, { premultiply: true });
        }

        for (const w in this.tiles) {
            const tile = this.tiles[w];
            if (tile.state !== 'loaded') {
                tile.state = 'loaded';
                tile.texture = this.texture;
            }
        }
    }

    serialize(): Object {
        return {
            type: 'canvas',
            coordinates: this.coordinates
        };
    }

    hasTransition() {
        return this._playing;
    }

    _hasInvalidDimensions() {
        for (const x of [this.canvas.width, this.canvas.height]) {
            if (isNaN(x) || x <= 0) return true;
        }
        return false;
    }
}

export default CanvasSource;
