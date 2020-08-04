// @flow

import DOM from '../../util/dom';

import { bezier, bindAll } from '../../util/util';
import window from '../../util/window';
import browser from '../../util/browser';
import { Event } from '../../util/evented';
import assert from 'assert';

import type Map from '../map';
import type Point from '@mapbox/point-geometry';
import type {TaskID} from '../../util/task_queue';

const inertiaLinearity = 0.25,
    inertiaEasing = bezier(0, 0, inertiaLinearity, 1),
    inertiaMaxSpeed = 180, // deg/s
    inertiaDeceleration = 720; // deg/s^2

/**
 * The `DragRotateHandler` allows the user to rotate the map by clicking and
 * dragging the cursor while holding the right mouse button or `ctrl` key.
 */
class DragRotateHandler {
    _map: Map;
    _el: HTMLElement;
    _state: 'disabled' | 'enabled' | 'pending' | 'active';
    _button: 'right' | 'left';
    _eventButton: number;
    _bearingSnap: number;
    _pitchWithRotate: boolean;

    _startPos: Point;
    _lastPos: Point;
    _lastMoveEvent: MouseEvent;
    _inertia: Array<[number, number]>;
    _center: Point;
    _frameId: ?TaskID;

    /**
     * @param {Map} map The Mapbox GL JS map to add the handler to.
     * @param {Object} [options]
     * @param {number} [options.bearingSnap] The threshold, measured in degrees, that determines when the map's
     *   bearing will snap to north.
     * @param {bool} [options.pitchWithRotate=true] Control the map pitch in addition to the bearing
     * @private
     */
    constructor(map: Map, options: {
        button?: 'right' | 'left',
        element?: HTMLElement,
        bearingSnap?: number,
        pitchWithRotate?: boolean
    }) {
        this._map = map;
        this._el = options.element || map.getCanvasContainer();
        this._state = 'disabled';
        this._button = options.button || 'right';
        this._bearingSnap = options.bearingSnap || 0;
        this._pitchWithRotate = options.pitchWithRotate !== false;

        bindAll([
            'onMouseDown',
            '_onMouseMove',
            '_onMouseUp',
            '_onBlur',
            '_onDragFrame'
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is enabled.
     *
     * @returns {boolean} `true` if the "drag to rotate" interaction is enabled.
     */
    isEnabled() {
        return this._state !== 'disabled';
    }

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "drag to rotate" interaction is active.
     */
    isActive() {
        return this._state === 'active';
    }

    /**
     * Enables the "drag to rotate" interaction.
     *
     * @example
     * map.dragRotate.enable();
     */
    enable() {
        if (this.isEnabled()) return;
        this._state = 'enabled';
    }

    /**
     * Disables the "drag to rotate" interaction.
     *
     * @example
     * map.dragRotate.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        switch (this._state) {
        case 'active':
            this._state = 'disabled';
            this._unbind();
            this._deactivate();
            this._fireEvent('rotateend');
            if (this._pitchWithRotate) {
                this._fireEvent('pitchend');
            }
            this._fireEvent('moveend');
            break;
        case 'pending':
            this._state = 'disabled';
            this._unbind();
            break;
        default:
            this._state = 'disabled';
            break;
        }
    }

    onMouseDown(e: MouseEvent) {
        if (this._state !== 'enabled') return;

        if (this._button === 'right') {
            this._eventButton = DOM.mouseButton(e);
            if (this._eventButton !== (e.ctrlKey ? 0 : 2)) return;
        } else {
            if (e.ctrlKey || DOM.mouseButton(e) !== 0) return;
            this._eventButton = 0;
        }

        DOM.disableDrag();

        // Bind window-level event listeners for move and up/end events. In the absence of
        // the pointer capture API, which is not supported by all necessary platforms,
        // window-level event listeners give us the best shot at capturing events that
        // fall outside the map canvas element. Use `{capture: true}` for the move event
        // to prevent map move events from being fired during a drag.
        window.document.addEventListener('mousemove', this._onMouseMove, {capture: true});
        window.document.addEventListener('mouseup', this._onMouseUp);

        // Deactivate when the window loses focus. Otherwise if a mouseup occurs when the window
        // isn't in focus, dragging will continue even though the mouse is no longer pressed.
        window.addEventListener('blur', this._onBlur);

        this._state = 'pending';
        this._inertia = [[browser.now(), this._map.getBearing()]];
        this._startPos = this._lastPos = DOM.mousePos(this._el, e);
        this._center = this._map.transform.centerPoint;  // Center of rotation

        e.preventDefault();
    }

    _onMouseMove(e: MouseEvent) {
        const pos = DOM.mousePos(this._el, e);
        if (this._lastPos.equals(pos)) {
            return;
        }

        this._lastMoveEvent = e;
        this._lastPos = pos;

        if (this._state === 'pending') {
            this._state = 'active';
            this._fireEvent('rotatestart', e);
            this._fireEvent('movestart', e);
            if (this._pitchWithRotate) {
                this._fireEvent('pitchstart', e);
            }
        }

        if (!this._frameId) {
            this._frameId = this._map._requestRenderFrame(this._onDragFrame);
        }
    }

    _onDragFrame() {
        this._frameId = null;

        const e = this._lastMoveEvent;
        if (!e) return;
        const tr = this._map.transform;

        const p1 = this._startPos,
            p2 = this._lastPos,
            bearingDiff = (p1.x - p2.x) * 0.8,
            pitchDiff = (p1.y - p2.y) * -0.5,
            bearing = tr.bearing - bearingDiff,
            pitch = tr.pitch - pitchDiff,
            inertia = this._inertia,
            last = inertia[inertia.length - 1];

        this._drainInertiaBuffer();
        inertia.push([browser.now(), this._map._normalizeBearing(bearing, last[1])]);

        tr.bearing = bearing;
        if (this._pitchWithRotate) {
            this._fireEvent('pitch', e);
            tr.pitch = pitch;
        }

        this._fireEvent('rotate', e);
        this._fireEvent('move', e);

        delete this._lastMoveEvent;
        this._startPos = this._lastPos;
    }

    _onMouseUp(e: MouseEvent) {
        if (DOM.mouseButton(e) !== this._eventButton) return;
        switch (this._state) {
        case 'active':
            this._state = 'enabled';
            DOM.suppressClick();
            this._unbind();
            this._deactivate();
            this._inertialRotate(e);
            break;
        case 'pending':
            this._state = 'enabled';
            this._unbind();
            break;
        default:
            assert(false);
            break;
        }
    }

    _onBlur(e: FocusEvent) {
        switch (this._state) {
        case 'active':
            this._state = 'enabled';
            this._unbind();
            this._deactivate();
            this._fireEvent('rotateend', e);
            if (this._pitchWithRotate) {
                this._fireEvent('pitchend', e);
            }
            this._fireEvent('moveend', e);
            break;
        case 'pending':
            this._state = 'enabled';
            this._unbind();
            break;
        default:
            assert(false);
            break;
        }
    }

    _unbind() {
        window.document.removeEventListener('mousemove', this._onMouseMove, {capture: true});
        window.document.removeEventListener('mouseup', this._onMouseUp);
        window.removeEventListener('blur', this._onBlur);
        DOM.enableDrag();
    }

    _deactivate() {
        if (this._frameId) {
            this._map._cancelRenderFrame(this._frameId);
            this._frameId = null;
        }
        delete this._lastMoveEvent;
        delete this._startPos;
        delete this._lastPos;
    }

    _inertialRotate(e: MouseEvent) {
        this._fireEvent('rotateend', e);
        this._drainInertiaBuffer();

        const map = this._map,
            mapBearing = map.getBearing(),
            inertia = this._inertia;

        const finish = () => {
            if (Math.abs(mapBearing) < this._bearingSnap) {
                map.resetNorth({noMoveStart: true}, { originalEvent: e });
            } else {
                this._fireEvent('moveend', e);
            }
            if (this._pitchWithRotate) this._fireEvent('pitchend', e);
        };

        if (inertia.length < 2) {
            finish();
            return;
        }

        const first = inertia[0],
            last = inertia[inertia.length - 1],
            previous = inertia[inertia.length - 2];
        let bearing = map._normalizeBearing(mapBearing, previous[1]);
        const flingDiff = last[1] - first[1],
            sign = flingDiff < 0 ? -1 : 1,
            flingDuration = (last[0] - first[0]) / 1000;

        if (flingDiff === 0 || flingDuration === 0) {
            finish();
            return;
        }

        let speed = Math.abs(flingDiff * (inertiaLinearity / flingDuration));  // deg/s
        if (speed > inertiaMaxSpeed) {
            speed = inertiaMaxSpeed;
        }

        const duration = speed / (inertiaDeceleration * inertiaLinearity),
            offset = sign * speed * (duration / 2);

        bearing += offset;

        if (Math.abs(map._normalizeBearing(bearing, 0)) < this._bearingSnap) {
            bearing = map._normalizeBearing(0, bearing);
        }

        map.rotateTo(bearing, {
            duration: duration * 1000,
            easing: inertiaEasing,
            noMoveStart: true
        }, { originalEvent: e });
    }

    _fireEvent(type: string, e: *) {
        return this._map.fire(new Event(type, e ? { originalEvent: e } : {}));
    }

    _drainInertiaBuffer() {
        const inertia = this._inertia,
            now = browser.now(),
            cutoff = 160;   //msec

        while (inertia.length > 0 && now - inertia[0][0] > cutoff)
            inertia.shift();
    }
}

export default DragRotateHandler;
