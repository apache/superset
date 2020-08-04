// @flow

import {
    bindAll,
    extend,
    deepEqual,
    warnOnce,
    clamp,
    wrap,
    ease as defaultEasing
} from '../util/util';
import { number as interpolate } from '../style-spec/util/interpolate';
import browser from '../util/browser';
import LngLat from '../geo/lng_lat';
import LngLatBounds from '../geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import { Event, Evented } from '../util/evented';

import type Transform from '../geo/transform';
import type {LngLatLike} from '../geo/lng_lat';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds';
import type {TaskID} from '../util/task_queue';
import type {PointLike} from '@mapbox/point-geometry';

/**
 * Options common to {@link Map#jumpTo}, {@link Map#easeTo}, and {@link Map#flyTo}, controlling the desired location,
 * zoom, bearing, and pitch of the camera. All properties are optional, and when a property is omitted, the current
 * camera value for that property will remain unchanged.
 *
 * @typedef {Object} CameraOptions
 * @property {LngLatLike} center The desired center.
 * @property {number} zoom The desired zoom level.
 * @property {number} bearing The desired bearing, in degrees. The bearing is the compass direction that
 * is "up"; for example, a bearing of 90° orients the map so that east is up.
 * @property {number} pitch The desired pitch, in degrees.
 * @property {LngLatLike} around If `zoom` is specified, `around` determines the point around which the zoom is centered.
 */
export type CameraOptions = {
    center?: LngLatLike,
    zoom?: number,
    bearing?: number,
    pitch?: number,
    around?: LngLatLike
};

/**
 * Options common to map movement methods that involve animation, such as {@link Map#panBy} and
 * {@link Map#easeTo}, controlling the duration and easing function of the animation. All properties
 * are optional.
 *
 * @typedef {Object} AnimationOptions
 * @property {number} duration The animation's duration, measured in milliseconds.
 * @property {Function} easing A function taking a time in the range 0..1 and returning a number where 0 is
 *   the initial state and 1 is the final state.
 * @property {PointLike} offset of the target center relative to real map container center at the end of animation.
 * @property {boolean} animate If `false`, no animation will occur.
 */
export type AnimationOptions = {
    duration?: number,
    easing?: (number) => number,
    offset?: PointLike,
    animate?: boolean
};

/**
 * Options for setting padding on a call to {@link Map#fitBounds}. All properties of this object must be
 * non-negative integers.
 *
 * @typedef {Object} PaddingOptions
 * @property {number} top Padding in pixels from the top of the map canvas.
 * @property {number} bottom Padding in pixels from the bottom of the map canvas.
 * @property {number} left Padding in pixels from the left of the map canvas.
 * @property {number} right Padding in pixels from the right of the map canvas.
 */

class Camera extends Evented {
    transform: Transform;
    _moving: boolean;
    _zooming: boolean;
    _rotating: boolean;
    _pitching: boolean;

    _bearingSnap: number;
    _easeEndTimeoutID: TimeoutID;
    _easeStart: number;
    _easeOptions: {duration: number, easing: (number) => number};

    _onEaseFrame: (number) => void;
    _onEaseEnd: () => void;
    _easeFrameId: ?TaskID;

    +_requestRenderFrame: (() => void) => TaskID;
    +_cancelRenderFrame: (TaskID) => void;

    constructor(transform: Transform, options: {bearingSnap: number}) {
        super();
        this._moving = false;
        this._zooming = false;
        this.transform = transform;
        this._bearingSnap = options.bearingSnap;

        bindAll(['_renderFrameCallback'], this);
    }

    /**
     * Returns the map's geographical centerpoint.
     *
     * @memberof Map#
     * @returns The map's geographical centerpoint.
     */
    getCenter(): LngLat { return new LngLat(this.transform.center.lng, this.transform.center.lat); }

    /**
     * Sets the map's geographical centerpoint. Equivalent to `jumpTo({center: center})`.
     *
     * @memberof Map#
     * @param center The centerpoint to set.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * map.setCenter([-74, 38]);
     */
    setCenter(center: LngLatLike, eventData?: Object) {
        return this.jumpTo({center}, eventData);
    }

    /**
     * Pans the map by the specified offset.
     *
     * @memberof Map#
     * @param offset `x` and `y` coordinates by which to pan the map.
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @see [Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    panBy(offset: PointLike, options?: AnimationOptions, eventData?: Object) {
        offset = Point.convert(offset).mult(-1);
        return this.panTo(this.transform.center, extend({offset}, options), eventData);
    }

    /**
     * Pans the map to the specified location, with an animated transition.
     *
     * @memberof Map#
     * @param lnglat The location to pan the map to.
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    panTo(lnglat: LngLatLike, options?: AnimationOptions, eventData?: Object) {
        return this.easeTo(extend({
            center: lnglat
        }, options), eventData);
    }

    /**
     * Returns the map's current zoom level.
     *
     * @memberof Map#
     * @returns The map's current zoom level.
     */
    getZoom(): number { return this.transform.zoom; }

    /**
     * Sets the map's zoom level. Equivalent to `jumpTo({zoom: zoom})`.
     *
     * @memberof Map#
     * @param zoom The zoom level to set (0-20).
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     * @example
     * // zoom the map to 5
     * map.setZoom(5);
     */
    setZoom(zoom: number, eventData?: Object) {
        this.jumpTo({zoom}, eventData);
        return this;
    }

    /**
     * Zooms the map to the specified zoom level, with an animated transition.
     *
     * @memberof Map#
     * @param zoom The zoom level to transition to.
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     */
    zoomTo(zoom: number, options: ? AnimationOptions, eventData?: Object) {
        return this.easeTo(extend({
            zoom
        }, options), eventData);
    }

    /**
     * Increases the map's zoom level by 1.
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     */
    zoomIn(options?: AnimationOptions, eventData?: Object) {
        this.zoomTo(this.getZoom() + 1, options, eventData);
        return this;
    }

    /**
     * Decreases the map's zoom level by 1.
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     */
    zoomOut(options?: AnimationOptions, eventData?: Object) {
        this.zoomTo(this.getZoom() - 1, options, eventData);
        return this;
    }

    /**
     * Returns the map's current bearing. The bearing is the compass direction that is \"up\"; for example, a bearing
     * of 90° orients the map so that east is up.
     *
     * @memberof Map#
     * @returns The map's current bearing.
     * @see [Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    getBearing(): number { return this.transform.bearing; }

    /**
     * Sets the map's bearing (rotation). The bearing is the compass direction that is \"up\"; for example, a bearing
     * of 90° orients the map so that east is up.
     *
     * Equivalent to `jumpTo({bearing: bearing})`.
     *
     * @memberof Map#
     * @param bearing The desired bearing.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * // rotate the map to 90 degrees
     * map.setBearing(90);
     */
    setBearing(bearing: number, eventData?: Object) {
        this.jumpTo({bearing}, eventData);
        return this;
    }

    /**
     * Rotates the map to the specified bearing, with an animated transition. The bearing is the compass direction
     * that is \"up\"; for example, a bearing of 90° orients the map so that east is up.
     *
     * @memberof Map#
     * @param bearing The desired bearing.
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    rotateTo(bearing: number, options?: AnimationOptions, eventData?: Object) {
        return this.easeTo(extend({
            bearing
        }, options), eventData);
    }

    /**
     * Rotates the map so that north is up (0° bearing), with an animated transition.
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    resetNorth(options?: AnimationOptions, eventData?: Object) {
        this.rotateTo(0, extend({duration: 1000}, options), eventData);
        return this;
    }

    /**
     * Snaps the map so that north is up (0° bearing), if the current bearing is close enough to it (i.e. within the
     * `bearingSnap` threshold).
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    snapToNorth(options?: AnimationOptions, eventData?: Object) {
        if (Math.abs(this.getBearing()) < this._bearingSnap) {
            return this.resetNorth(options, eventData);
        }
        return this;
    }

    /**
     * Returns the map's current pitch (tilt).
     *
     * @memberof Map#
     * @returns The map's current pitch, measured in degrees away from the plane of the screen.
     */
    getPitch(): number { return this.transform.pitch; }

    /**
     * Sets the map's pitch (tilt). Equivalent to `jumpTo({pitch: pitch})`.
     *
     * @memberof Map#
     * @param pitch The pitch to set, measured in degrees away from the plane of the screen (0-60).
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires pitchstart
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setPitch(pitch: number, eventData?: Object) {
        this.jumpTo({pitch}, eventData);
        return this;
    }

    /**
     * @memberof Map#
     * @param {LatLngBoundsLike} bounds Calculate the center for these bounds in the viewport and use
     *      the highest zoom level up to and including `Map#getMaxZoom()` that fits
     *      in the viewport. LatLngBounds represent a box that is always axis-aligned with bearing 0.
     * @param options
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the camera would transition to the specified bounds.
     * @returns {CameraOptions | void} If map is able to fit to provided bounds, returns `CameraOptions` with
     *      `center`, `zoom`, and `bearing`. If map is unable to fit, method will warn and return undefined.
     * @example
     * var bbox = [[-79, 43], [-73, 45]];
     * var newCameraTransform = map.cameraForBounds(bbox, {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     */
    cameraForBounds(bounds: LngLatBoundsLike, options?: CameraOptions): void | CameraOptions & AnimationOptions {
        bounds = LngLatBounds.convert(bounds);
        return this._cameraForBoxAndBearing(bounds.getNorthWest(), bounds.getSouthEast(), 0, options);
    }

    /**
     * Calculate the center of these two points in the viewport and use
     * the highest zoom level up to and including `Map#getMaxZoom()` that fits
     * the points in the viewport at the specified bearing.
     * @memberof Map#
     * @param {LngLatLike} p0 First point
     * @param {LngLatLike} p1 Second point
     * @param bearing Desired map bearing at end of animation, in degrees
     * @param options
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the camera would transition to the specified bounds.
     * @returns {CameraOptions | void} If map is able to fit to provided bounds, returns `CameraOptions` with
     *      `center`, `zoom`, and `bearing`. If map is unable to fit, method will warn and return undefined.
     * @private
     * @example
     * var p0 = [-79, 43];
     * var p1 = [-73, 45];
     * var bearing = 90;
     * var newCameraTransform = map._cameraForBoxAndBearing(p0, p1, bearing, {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     */
    _cameraForBoxAndBearing(p0: LngLatLike, p1: LngLatLike, bearing: number, options?: CameraOptions): void | CameraOptions & AnimationOptions {
        options = extend({
            padding: {
                top: 0,
                bottom: 0,
                right: 0,
                left: 0
            },
            offset: [0, 0],
            maxZoom: this.transform.maxZoom
        }, options);

        if (typeof options.padding === 'number') {
            const p = options.padding;
            options.padding = {
                top: p,
                bottom: p,
                right: p,
                left: p
            };
        }
        if (!deepEqual(Object.keys(options.padding).sort((a, b) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        }), ["bottom", "left", "right", "top"])) {
            warnOnce(
                "options.padding must be a positive number, or an Object with keys 'bottom', 'left', 'right', 'top'"
            );
            return;
        }

        const tr = this.transform;

        // We want to calculate the upper right and lower left of the box defined by p0 and p1
        // in a coordinate system rotate to match the destination bearing.
        const p0world = tr.project(LngLat.convert(p0));
        const p1world = tr.project(LngLat.convert(p1));
        const p0rotated = p0world.rotate(-bearing * Math.PI / 180);
        const p1rotated = p1world.rotate(-bearing * Math.PI / 180);

        const upperRight = new Point(Math.max(p0rotated.x, p1rotated.x), Math.max(p0rotated.y, p1rotated.y));
        const lowerLeft = new Point(Math.min(p0rotated.x, p1rotated.x), Math.min(p0rotated.y, p1rotated.y));

        // Calculate zoom: consider the original bbox and padding.
        const size = upperRight.sub(lowerLeft);
        const scaleX = (tr.width - options.padding.left - options.padding.right) / size.x;
        const scaleY = (tr.height - options.padding.top - options.padding.bottom) / size.y;

        if (scaleY < 0 || scaleX < 0) {
            warnOnce(
                'Map cannot fit within canvas with the given bounds, padding, and/or offset.'
            );
            return;
        }

        const zoom = Math.min(tr.scaleZoom(tr.scale * Math.min(scaleX, scaleY)), options.maxZoom);

        // Calculate center: apply the zoom, the configured offset, as well as offset that exists as a result of padding.
        const offset = Point.convert(options.offset);
        const paddingOffsetX = (options.padding.left - options.padding.right) / 2;
        const paddingOffsetY = (options.padding.top - options.padding.bottom) / 2;
        const offsetAtInitialZoom = new Point(offset.x + paddingOffsetX, offset.y + paddingOffsetY);
        const offsetAtFinalZoom = offsetAtInitialZoom.mult(tr.scale / tr.zoomScale(zoom));

        const center =  tr.unproject(p0world.add(p1world).div(2).sub(offsetAtFinalZoom));

        return {
            center,
            zoom,
            bearing
        };
    }

    /**
     * Pans and zooms the map to contain its visible area within the specified geographical bounds.
     * This function will also reset the map's bearing to 0 if bearing is nonzero.
     *
     * @memberof Map#
     * @param bounds Center these bounds in the viewport and use the highest
     *      zoom level up to and including `Map#getMaxZoom()` that fits them in the viewport.
     * @param {Object} [options] Options supports all properties from {@link AnimationOptions} and {@link CameraOptions} in addition to the fields below.
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {boolean} [options.linear=false] If `true`, the map transitions using
     *     {@link Map#easeTo}. If `false`, the map transitions using {@link Map#flyTo}. See
     *     those functions and {@link AnimationOptions} for information about options available.
     * @param {Function} [options.easing] An easing function for the animated transition. See {@link AnimationOptions}.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the map view transitions to the specified bounds.
     * @param {Object} [eventData] Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
	 * @example
     * var bbox = [[-79, 43], [-73, 45]];
     * map.fitBounds(bbox, {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * @see [Fit a map to a bounding box](https://www.mapbox.com/mapbox-gl-js/example/fitbounds/)
     */
    fitBounds(bounds: LngLatBoundsLike, options?: AnimationOptions & CameraOptions, eventData?: Object) {
        return this._fitInternal(
            this.cameraForBounds(bounds, options),
            options,
            eventData);
    }

    /**
     * Pans, rotates and zooms the map to to fit the box made by points p0 and p1
     * once the map is rotated to the specified bearing. To zoom without rotating,
     * pass in the current map bearing.
     *
     * @memberof Map#
     * @param p0 First point on screen, in pixel coordinates
     * @param p1 Second point on screen, in pixel coordinates
     * @param bearing Desired map bearing at end of animation, in degrees
     * @param options
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {boolean} [options.linear=false] If `true`, the map transitions using
     *     {@link Map#easeTo}. If `false`, the map transitions using {@link Map#flyTo}. See
     *     those functions and {@link AnimationOptions} for information about options available.
     * @param {Function} [options.easing] An easing function for the animated transition. See {@link AnimationOptions}.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the map view transitions to the specified bounds.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
	 * @example
     * var p0 = [220, 400];
     * var p1 = [500, 900];
     * map.fitScreenCoordinates(p0, p1, map.getBearing(), {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * @see [Used by BoxZoomHandler](https://www.mapbox.com/mapbox-gl-js/api/#boxzoomhandler)
     */
    fitScreenCoordinates(p0: PointLike, p1: PointLike, bearing: number, options?: AnimationOptions & CameraOptions, eventData?: Object) {
        return this._fitInternal(
            this._cameraForBoxAndBearing(
                this.transform.pointLocation(Point.convert(p0)),
                this.transform.pointLocation(Point.convert(p1)),
                bearing,
                options),
            options,
            eventData);
    }

    _fitInternal(calculatedOptions?: CameraOptions & AnimationOptions, options?: AnimationOptions & CameraOptions, eventData?: Object) {
        // cameraForBounds warns + returns undefined if unable to fit:
        if (!calculatedOptions) return this;

        options = extend(calculatedOptions, options);

        return options.linear ?
            this.easeTo(options, eventData) :
            this.flyTo(options, eventData);
    }

    /**
     * Changes any combination of center, zoom, bearing, and pitch, without
     * an animated transition. The map will retain its current values for any
     * details not specified in `options`.
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires pitchstart
     * @fires rotate
     * @fires move
     * @fires zoom
     * @fires pitch
     * @fires moveend
     * @fires zoomend
     * @fires pitchend
     * @returns {Map} `this`
     */
    jumpTo(options: CameraOptions, eventData?: Object) {
        this.stop();

        const tr = this.transform;
        let zoomChanged = false,
            bearingChanged = false,
            pitchChanged = false;

        if ('zoom' in options && tr.zoom !== +options.zoom) {
            zoomChanged = true;
            tr.zoom = +options.zoom;
        }

        if (options.center !== undefined) {
            tr.center = LngLat.convert(options.center);
        }

        if ('bearing' in options && tr.bearing !== +options.bearing) {
            bearingChanged = true;
            tr.bearing = +options.bearing;
        }

        if ('pitch' in options && tr.pitch !== +options.pitch) {
            pitchChanged = true;
            tr.pitch = +options.pitch;
        }

        this.fire(new Event('movestart', eventData))
            .fire(new Event('move', eventData));

        if (zoomChanged) {
            this.fire(new Event('zoomstart', eventData))
                .fire(new Event('zoom', eventData))
                .fire(new Event('zoomend', eventData));
        }

        if (bearingChanged) {
            this.fire(new Event('rotatestart', eventData))
                .fire(new Event('rotate', eventData))
                .fire(new Event('rotateend', eventData));
        }

        if (pitchChanged) {
            this.fire(new Event('pitchstart', eventData))
                .fire(new Event('pitch', eventData))
                .fire(new Event('pitchend', eventData));
        }

        return this.fire(new Event('moveend', eventData));
    }

    /**
     * Changes any combination of center, zoom, bearing, and pitch, with an animated transition
     * between old and new values. The map will retain its current values for any
     * details not specified in `options`.
     *
     * @memberof Map#
     * @param options Options describing the destination and animation of the transition.
     *            Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires pitchstart
     * @fires rotate
     * @fires move
     * @fires zoom
     * @fires pitch
     * @fires moveend
     * @fires zoomend
     * @fires pitchend
     * @returns {Map} `this`
     * @see [Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    easeTo(options: CameraOptions & AnimationOptions & {delayEndEvents?: number}, eventData?: Object) {
        this.stop();

        options = extend({
            offset: [0, 0],
            duration: 500,
            easing: defaultEasing
        }, options);

        if (options.animate === false) options.duration = 0;

        const tr = this.transform,
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch(),

            zoom = 'zoom' in options ? +options.zoom : startZoom,
            bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing,
            pitch = 'pitch' in options ? +options.pitch : startPitch;

        const pointAtOffset = tr.centerPoint.add(Point.convert(options.offset));
        const locationAtOffset = tr.pointLocation(pointAtOffset);
        const center = LngLat.convert(options.center || locationAtOffset);
        this._normalizeCenter(center);

        const from = tr.project(locationAtOffset);
        const delta = tr.project(center).sub(from);
        const finalScale = tr.zoomScale(zoom - startZoom);

        let around, aroundPoint;

        if (options.around) {
            around = LngLat.convert(options.around);
            aroundPoint = tr.locationPoint(around);
        }

        this._zooming = (zoom !== startZoom);
        this._rotating = (startBearing !== bearing);
        this._pitching = (pitch !== startPitch);

        this._prepareEase(eventData, options.noMoveStart);

        clearTimeout(this._easeEndTimeoutID);

        this._ease((k) => {
            if (this._zooming) {
                tr.zoom = interpolate(startZoom, zoom, k);
            }
            if (this._rotating) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }
            if (this._pitching) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }

            if (around) {
                tr.setLocationAtPoint(around, aroundPoint);
            } else {
                const scale = tr.zoomScale(tr.zoom - startZoom);
                const base = zoom > startZoom ?
                    Math.min(2, finalScale) :
                    Math.max(0.5, finalScale);
                const speedup = Math.pow(base, 1 - k);
                const newCenter = tr.unproject(from.add(delta.mult(k * speedup)).mult(scale));
                tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
            }

            this._fireMoveEvents(eventData);

        }, () => {
            if (options.delayEndEvents) {
                this._easeEndTimeoutID = setTimeout(() => this._afterEase(eventData), options.delayEndEvents);
            } else {
                this._afterEase(eventData);
            }
        }, options);

        return this;
    }

    _prepareEase(eventData?: Object, noMoveStart: boolean) {
        this._moving = true;

        if (!noMoveStart) {
            this.fire(new Event('movestart', eventData));
        }
        if (this._zooming) {
            this.fire(new Event('zoomstart', eventData));
        }
        if (this._rotating) {
            this.fire(new Event('rotatestart', eventData));
        }
        if (this._pitching) {
            this.fire(new Event('pitchstart', eventData));
        }
    }

    _fireMoveEvents(eventData?: Object) {
        this.fire(new Event('move', eventData));
        if (this._zooming) {
            this.fire(new Event('zoom', eventData));
        }
        if (this._rotating) {
            this.fire(new Event('rotate', eventData));
        }
        if (this._pitching) {
            this.fire(new Event('pitch', eventData));
        }
    }

    _afterEase(eventData?: Object) {
        const wasZooming = this._zooming;
        const wasRotating = this._rotating;
        const wasPitching = this._pitching;
        this._moving = false;
        this._zooming = false;
        this._rotating = false;
        this._pitching = false;

        if (wasZooming) {
            this.fire(new Event('zoomend', eventData));
        }
        if (wasRotating) {
            this.fire(new Event('rotateend', eventData));
        }
        if (wasPitching) {
            this.fire(new Event('pitchend', eventData));
        }
        this.fire(new Event('moveend', eventData));
    }

    /**
     * Changes any combination of center, zoom, bearing, and pitch, animating the transition along a curve that
     * evokes flight. The animation seamlessly incorporates zooming and panning to help
     * the user maintain her bearings even after traversing a great distance.
     *
     * @memberof Map#
     * @param {Object} options Options describing the destination and animation of the transition.
     *     Accepts {@link CameraOptions}, {@link AnimationOptions},
     *     and the following additional options.
     * @param {number} [options.curve=1.42] The zooming "curve" that will occur along the
     *     flight path. A high value maximizes zooming for an exaggerated animation, while a low
     *     value minimizes zooming for an effect closer to {@link Map#easeTo}. 1.42 is the average
     *     value selected by participants in the user study discussed in
     *     [van Wijk (2003)](https://www.win.tue.nl/~vanwijk/zoompan.pdf). A value of
     *     `Math.pow(6, 0.25)` would be equivalent to the root mean squared average velocity. A
     *     value of 1 would produce a circular motion.
     * @param {number} [options.minZoom] The zero-based zoom level at the peak of the flight path. If
     *     `options.curve` is specified, this option is ignored.
     * @param {number} [options.speed=1.2] The average speed of the animation defined in relation to
     *     `options.curve`. A speed of 1.2 means that the map appears to move along the flight path
     *     by 1.2 times `options.curve` screenfuls every second. A _screenful_ is the map's visible span.
     *     It does not correspond to a fixed physical distance, but varies by zoom level.
     * @param {number} [options.screenSpeed] The average speed of the animation measured in screenfuls
     *     per second, assuming a linear timing curve. If `options.speed` is specified, this option is ignored.
     * @param {number} [options.maxDuration] The animation's maximum duration, measured in milliseconds.
     *     If duration exceeds maximum duration, it resets to 0.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires pitchstart
     * @fires move
     * @fires zoom
     * @fires rotate
     * @fires pitch
     * @fires moveend
     * @fires zoomend
     * @fires pitchend
     * @returns {Map} `this`
     * @example
     * // fly with default options to null island
     * map.flyTo({center: [0, 0], zoom: 9});
     * // using flyTo options
     * map.flyTo({
     *   center: [0, 0],
     *   zoom: 9,
     *   speed: 0.2,
     *   curve: 1,
     *   easing(t) {
     *     return t;
     *   }
     * });
     * @see [Fly to a location](https://www.mapbox.com/mapbox-gl-js/example/flyto/)
     * @see [Slowly fly to a location](https://www.mapbox.com/mapbox-gl-js/example/flyto-options/)
     * @see [Fly to a location based on scroll position](https://www.mapbox.com/mapbox-gl-js/example/scroll-fly-to/)
     */
    flyTo(options: Object, eventData?: Object) {
        // This method implements an “optimal path” animation, as detailed in:
        //
        // Van Wijk, Jarke J.; Nuij, Wim A. A. “Smooth and efficient zooming and panning.” INFOVIS
        //   ’03. pp. 15–22. <https://www.win.tue.nl/~vanwijk/zoompan.pdf#page=5>.
        //
        // Where applicable, local variable documentation begins with the associated variable or
        // function in van Wijk (2003).

        this.stop();

        options = extend({
            offset: [0, 0],
            speed: 1.2,
            curve: 1.42,
            easing: defaultEasing
        }, options);

        const tr = this.transform,
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch();

        const zoom = 'zoom' in options ? clamp(+options.zoom, tr.minZoom, tr.maxZoom) : startZoom;
        const bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = 'pitch' in options ? +options.pitch : startPitch;

        const scale = tr.zoomScale(zoom - startZoom);
        const pointAtOffset = tr.centerPoint.add(Point.convert(options.offset));
        const locationAtOffset = tr.pointLocation(pointAtOffset);
        const center = LngLat.convert(options.center || locationAtOffset);
        this._normalizeCenter(center);

        const from = tr.project(locationAtOffset);
        const delta = tr.project(center).sub(from);

        let rho = options.curve;

        // w₀: Initial visible span, measured in pixels at the initial scale.
        const w0 = Math.max(tr.width, tr.height),
            // w₁: Final visible span, measured in pixels with respect to the initial scale.
            w1 = w0 / scale,
            // Length of the flight path as projected onto the ground plane, measured in pixels from
            // the world image origin at the initial scale.
            u1 = delta.mag();

        if ('minZoom' in options) {
            const minZoom = clamp(Math.min(options.minZoom, startZoom, zoom), tr.minZoom, tr.maxZoom);
            // w<sub>m</sub>: Maximum visible span, measured in pixels with respect to the initial
            // scale.
            const wMax = w0 / tr.zoomScale(minZoom - startZoom);
            rho = Math.sqrt(wMax / u1 * 2);
        }

        // ρ²
        const rho2 = rho * rho;

        /**
         * rᵢ: Returns the zoom-out factor at one end of the animation.
         *
         * @param i 0 for the ascent or 1 for the descent.
         * @private
         */
        function r(i) {
            const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
            return Math.log(Math.sqrt(b * b + 1) - b);
        }

        function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
        function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
        function tanh(n) { return sinh(n) / cosh(n); }

        // r₀: Zoom-out factor during ascent.
        const r0 = r(0);

        // w(s): Returns the visible span on the ground, measured in pixels with respect to the
        // initial scale. Assumes an angular field of view of 2 arctan ½ ≈ 53°.
        let w: (number) => number = function (s) {
            return (cosh(r0) / cosh(r0 + rho * s));
        };

        // u(s): Returns the distance along the flight path as projected onto the ground plane,
        // measured in pixels from the world image origin at the initial scale.
        let u: (number) => number = function (s) {
            return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1;
        };

        // S: Total length of the flight path, measured in ρ-screenfuls.
        let S = (r(1) - r0) / rho;

        // When u₀ = u₁, the optimal path doesn’t require both ascent and descent.
        if (Math.abs(u1) < 0.000001 || !isFinite(S)) {
            // Perform a more or less instantaneous transition if the path is too short.
            if (Math.abs(w0 - w1) < 0.000001) return this.easeTo(options, eventData);

            const k = w1 < w0 ? -1 : 1;
            S = Math.abs(Math.log(w1 / w0)) / rho;

            u = function() { return 0; };
            w = function(s) { return Math.exp(k * rho * s); };
        }

        if ('duration' in options) {
            options.duration = +options.duration;
        } else {
            const V = 'screenSpeed' in options ? +options.screenSpeed / rho : +options.speed;
            options.duration = 1000 * S / V;
        }

        if (options.maxDuration && options.duration > options.maxDuration) {
            options.duration = 0;
        }

        this._zooming = true;
        this._rotating = (startBearing !== bearing);
        this._pitching = (pitch !== startPitch);

        this._prepareEase(eventData, false);

        this._ease((k) => {
            // s: The distance traveled along the flight path, measured in ρ-screenfuls.
            const s = k * S;
            const scale = 1 / w(s);
            tr.zoom = k === 1 ? zoom : startZoom + tr.scaleZoom(scale);

            if (this._rotating) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }
            if (this._pitching) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }

            const newCenter = k === 1 ? center : tr.unproject(from.add(delta.mult(u(s))).mult(scale));
            tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);

            this._fireMoveEvents(eventData);

        }, () => this._afterEase(eventData), options);

        return this;
    }

    isEasing() {
        return !!this._easeFrameId;
    }

    /**
     * Stops any animated transition underway.
     *
     * @memberof Map#
     * @returns {Map} `this`
     */
    stop(): this {
        if (this._easeFrameId) {
            this._cancelRenderFrame(this._easeFrameId);
            delete this._easeFrameId;
            delete this._onEaseFrame;
        }

        if (this._onEaseEnd) {
            // The _onEaseEnd function might emit events which trigger new
            // animation, which sets a new _onEaseEnd. Ensure we don't delete
            // it unintentionally.
            const onEaseEnd = this._onEaseEnd;
            delete this._onEaseEnd;
            onEaseEnd.call(this);
        }
        return this;
    }

    _ease(frame: (number) => void,
          finish: () => void,
          options: {animate: boolean, duration: number, easing: (number) => number}) {
        if (options.animate === false || options.duration === 0) {
            frame(1);
            finish();
        } else {
            this._easeStart = browser.now();
            this._easeOptions = options;
            this._onEaseFrame = frame;
            this._onEaseEnd = finish;
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        }
    }

    // Callback for map._requestRenderFrame
    _renderFrameCallback() {
        const t = Math.min((browser.now() - this._easeStart) / this._easeOptions.duration, 1);
        this._onEaseFrame(this._easeOptions.easing(t));
        if (t < 1) {
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        } else {
            this.stop();
        }
    }

    // convert bearing so that it's numerically close to the current one so that it interpolates properly
    _normalizeBearing(bearing: number, currentBearing: number) {
        bearing = wrap(bearing, -180, 180);
        const diff = Math.abs(bearing - currentBearing);
        if (Math.abs(bearing - 360 - currentBearing) < diff) bearing -= 360;
        if (Math.abs(bearing + 360 - currentBearing) < diff) bearing += 360;
        return bearing;
    }

    // If a path crossing the antimeridian would be shorter, extend the final coordinate so that
    // interpolating between the two endpoints will cross it.
    _normalizeCenter(center: LngLat) {
        const tr = this.transform;
        if (!tr.renderWorldCopies || tr.lngRange) return;

        const delta = center.lng - tr.center.lng;
        center.lng +=
            delta > 180 ? -360 :
            delta < -180 ? 360 : 0;
    }
}

export default Camera;
