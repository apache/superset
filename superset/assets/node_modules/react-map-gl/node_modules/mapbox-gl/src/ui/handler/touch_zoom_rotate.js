// @flow

import DOM from '../../util/dom';
import { bezier, bindAll } from '../../util/util';
import window from '../../util/window';
import browser from '../../util/browser';
import { Event } from '../../util/evented';

import type Map from '../map';
import type Point from '@mapbox/point-geometry';
import type LngLat from '../../geo/lng_lat';
import type {TaskID} from '../../util/task_queue';

const inertiaLinearity = 0.15,
    inertiaEasing = bezier(0, 0, inertiaLinearity, 1),
    inertiaDeceleration = 12, // scale / s^2
    inertiaMaxSpeed = 2.5, // scale / s
    significantScaleThreshold = 0.15,
    significantRotateThreshold = 10;

/**
 * The `TouchZoomRotateHandler` allows the user to zoom and rotate the map by
 * pinching on a touchscreen.
 */
class TouchZoomRotateHandler {
    _map: Map;
    _el: HTMLElement;
    _enabled: boolean;
    _aroundCenter: boolean;
    _rotationDisabled: boolean;
    _startVec: Point;
    _startAround: LngLat;
    _startScale: number;
    _startBearing: number;
    _gestureIntent: 'rotate' | 'zoom' | void;
    _inertia: Array<[number, number, Point]>;
    _lastTouchEvent: TouchEvent;
    _frameId: ?TaskID;

    /**
     * @private
     */
    constructor(map: Map) {
        this._map = map;
        this._el = map.getCanvasContainer();

        bindAll([
            '_onMove',
            '_onEnd',
            '_onTouchFrame'
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "pinch to rotate and zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "pinch to rotate and zoom" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    /**
     * Enables the "pinch to rotate and zoom" interaction.
     *
     * @param {Object} [options]
     * @param {string} [options.around] If "center" is passed, map will zoom around the center
     *
     * @example
     *   map.touchZoomRotate.enable();
     * @example
     *   map.touchZoomRotate.enable({ around: 'center' });
     */
    enable(options: ?{around?: 'center'}) {
        if (this.isEnabled()) return;
        this._el.classList.add('mapboxgl-touch-zoom-rotate');
        this._enabled = true;
        this._aroundCenter = !!options && options.around === 'center';
    }

    /**
     * Disables the "pinch to rotate and zoom" interaction.
     *
     * @example
     *   map.touchZoomRotate.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        this._el.classList.remove('mapboxgl-touch-zoom-rotate');
        this._enabled = false;
    }

    /**
     * Disables the "pinch to rotate" interaction, leaving the "pinch to zoom"
     * interaction enabled.
     *
     * @example
     *   map.touchZoomRotate.disableRotation();
     */
    disableRotation() {
        this._rotationDisabled = true;
    }

    /**
     * Enables the "pinch to rotate" interaction.
     *
     * @example
     *   map.touchZoomRotate.enable();
     *   map.touchZoomRotate.enableRotation();
     */
    enableRotation() {
        this._rotationDisabled = false;
    }

    onStart(e: TouchEvent) {
        if (!this.isEnabled()) return;
        if (e.touches.length !== 2) return;

        const p0 = DOM.mousePos(this._el, e.touches[0]),
            p1 = DOM.mousePos(this._el, e.touches[1]),
            center = p0.add(p1).div(2);

        this._startVec = p0.sub(p1);
        this._startAround = this._map.transform.pointLocation(center);
        this._gestureIntent = undefined;
        this._inertia = [];

        DOM.addEventListener(window.document, 'touchmove', this._onMove, {passive: false});
        DOM.addEventListener(window.document, 'touchend', this._onEnd);
    }

    _getTouchEventData(e: TouchEvent) {
        const p0 = DOM.mousePos(this._el, e.touches[0]),
            p1 = DOM.mousePos(this._el, e.touches[1]);

        const vec = p0.sub(p1);
        return {
            vec,
            center: p0.add(p1).div(2),
            scale: vec.mag() / this._startVec.mag(),
            bearing: this._rotationDisabled ? 0 : vec.angleWith(this._startVec) * 180 / Math.PI
        };
    }

    _onMove(e: TouchEvent) {
        if (e.touches.length !== 2) return;

        const {vec, scale, bearing} = this._getTouchEventData(e);

        // Determine 'intent' by whichever threshold is surpassed first,
        // then keep that state for the duration of this gesture.
        if (!this._gestureIntent) {
            // when rotation is disabled, any scale change triggers the zoom gesture to start
            const scalingSignificantly = (this._rotationDisabled && scale !== 1) || (Math.abs(1 - scale) > significantScaleThreshold),
                rotatingSignificantly = (Math.abs(bearing) > significantRotateThreshold);

            if (rotatingSignificantly) {
                this._gestureIntent = 'rotate';
            } else if (scalingSignificantly) {
                this._gestureIntent = 'zoom';
            }

            if (this._gestureIntent) {
                this._map.fire(new Event(`${this._gestureIntent}start`, { originalEvent: e }));
                this._map.fire(new Event('movestart', { originalEvent: e }));
                this._startVec = vec;
            }
        }

        this._lastTouchEvent = e;
        if (!this._frameId) {
            this._frameId = this._map._requestRenderFrame(this._onTouchFrame);
        }

        e.preventDefault();
    }

    _onTouchFrame() {
        this._frameId = null;

        const gestureIntent = this._gestureIntent;
        if (!gestureIntent) return;

        const tr = this._map.transform;

        if (!this._startScale) {
            this._startScale = tr.scale;
            this._startBearing = tr.bearing;
        }

        const {center, bearing, scale} = this._getTouchEventData(this._lastTouchEvent);
        const around = tr.pointLocation(center);
        const aroundPoint = tr.locationPoint(around);

        if (gestureIntent === 'rotate') {
            tr.bearing = this._startBearing + bearing;
        }

        tr.zoom = tr.scaleZoom(this._startScale * scale);

        tr.setLocationAtPoint(this._startAround, aroundPoint);

        this._map.fire(new Event(gestureIntent, {originalEvent: this._lastTouchEvent}));
        this._map.fire(new Event('move', {originalEvent: this._lastTouchEvent}));

        this._drainInertiaBuffer();
        this._inertia.push([browser.now(), scale, center]);
    }

    _onEnd(e: TouchEvent) {
        DOM.removeEventListener(window.document, 'touchmove', this._onMove, {passive: false});
        DOM.removeEventListener(window.document, 'touchend', this._onEnd);

        const gestureIntent = this._gestureIntent;
        const startScale = this._startScale;

        if (this._frameId) {
            this._map._cancelRenderFrame(this._frameId);
            this._frameId = null;
        }
        delete this._gestureIntent;
        delete this._startScale;
        delete this._startBearing;
        delete this._lastTouchEvent;

        if (!gestureIntent) return;

        this._map.fire(new Event(`${gestureIntent}end`, { originalEvent: e }));

        this._drainInertiaBuffer();

        const inertia = this._inertia,
            map = this._map;

        if (inertia.length < 2) {
            map.snapToNorth({}, { originalEvent: e });
            return;
        }

        const last = inertia[inertia.length - 1],
            first = inertia[0],
            lastScale = map.transform.scaleZoom(startScale * last[1]),
            firstScale = map.transform.scaleZoom(startScale * first[1]),
            scaleOffset = lastScale - firstScale,
            scaleDuration = (last[0] - first[0]) / 1000,
            p = last[2];

        if (scaleDuration === 0 || lastScale === firstScale) {
            map.snapToNorth({}, { originalEvent: e });
            return;
        }

        // calculate scale/s speed and adjust for increased initial animation speed when easing
        let speed = scaleOffset * inertiaLinearity / scaleDuration; // scale/s

        if (Math.abs(speed) > inertiaMaxSpeed) {
            if (speed > 0) {
                speed = inertiaMaxSpeed;
            } else {
                speed = -inertiaMaxSpeed;
            }
        }

        const duration = Math.abs(speed / (inertiaDeceleration * inertiaLinearity)) * 1000;
        let targetScale = lastScale + speed * duration / 2000;

        if (targetScale < 0) {
            targetScale = 0;
        }

        map.easeTo({
            zoom: targetScale,
            duration,
            easing: inertiaEasing,
            around: this._aroundCenter ? map.getCenter() : map.unproject(p),
            noMoveStart: true
        }, { originalEvent: e });
    }

    _drainInertiaBuffer() {
        const inertia = this._inertia,
            now = browser.now(),
            cutoff = 160; // msec

        while (inertia.length > 2 && now - inertia[0][0] > cutoff) inertia.shift();
    }
}

export default TouchZoomRotateHandler;
