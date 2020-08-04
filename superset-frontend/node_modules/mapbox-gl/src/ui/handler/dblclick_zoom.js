// @flow

import { bindAll } from '../../util/util';

import type Map from '../map';
import type {MapMouseEvent, MapTouchEvent} from '../events';

/**
 * The `DoubleClickZoomHandler` allows the user to zoom the map at a point by
 * double clicking or double tapping.
 */
class DoubleClickZoomHandler {
    _map: Map;
    _enabled: boolean;
    _active: boolean;
    _tapped: ?TimeoutID;

    /**
     * @private
     */
    constructor(map: Map) {
        this._map = map;

        bindAll([
            '_onDblClick',
            '_onZoomEnd'
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "double click to zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "double click to zoom" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    /**
     * Returns a Boolean indicating whether the "double click to zoom" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "double click to zoom" interaction is active.
     */
    isActive() {
        return !!this._active;
    }

    /**
     * Enables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.enable();
     */
    enable() {
        if (this.isEnabled()) return;
        this._enabled = true;
    }

    /**
     * Disables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        this._enabled = false;
    }

    onTouchStart(e: MapTouchEvent) {
        if (!this.isEnabled()) return;
        if (e.points.length > 1) return;

        if (!this._tapped) {
            this._tapped = setTimeout(() => { this._tapped = null; }, 300);
        } else {
            clearTimeout(this._tapped);
            this._tapped = null;
            this._zoom(e);
        }
    }

    onDblClick(e: MapMouseEvent) {
        if (!this.isEnabled()) return;
        e.originalEvent.preventDefault();
        this._zoom(e);
    }

    _zoom(e: MapMouseEvent | MapTouchEvent) {
        this._active = true;
        this._map.on('zoomend', this._onZoomEnd);
        this._map.zoomTo(
            this._map.getZoom() + (e.originalEvent.shiftKey ? -1 : 1),
            {around: e.lngLat},
            e
        );
    }

    _onZoomEnd() {
        this._active = false;
        this._map.off('zoomend', this._onZoomEnd);
    }
}

export default DoubleClickZoomHandler;
