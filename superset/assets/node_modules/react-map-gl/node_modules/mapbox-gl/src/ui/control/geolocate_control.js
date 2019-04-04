// @flow

import { Event, Evented } from '../../util/evented';
import DOM from '../../util/dom';
import window from '../../util/window';
import { extend, bindAll, warnOnce } from '../../util/util';
import assert from 'assert';
import LngLat from '../../geo/lng_lat';
import Marker from '../marker';

import type Map from '../map';
import type { AnimationOptions, CameraOptions } from '../camera';

type Options = {
    positionOptions?: PositionOptions,
    fitBoundsOptions?: AnimationOptions & CameraOptions,
    trackUserLocation?: boolean,
    showUserLocation?: boolean
};

const defaultOptions: Options = {
    positionOptions: {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 6000 /* 6 sec */
    },
    fitBoundsOptions: {
        maxZoom: 15
    },
    trackUserLocation: false,
    showUserLocation: true
};
const className = 'mapboxgl-ctrl';

let supportsGeolocation;

function checkGeolocationSupport(callback) {
    if (supportsGeolocation !== undefined) {
        callback(supportsGeolocation);

    } else if (window.navigator.permissions !== undefined) {
        // navigator.permissions has incomplete browser support
        // http://caniuse.com/#feat=permissions-api
        // Test for the case where a browser disables Geolocation because of an
        // insecure origin
        window.navigator.permissions.query({ name: 'geolocation' }).then((p) => {
            supportsGeolocation = p.state !== 'denied';
            callback(supportsGeolocation);
        });

    } else {
        supportsGeolocation = !!window.navigator.geolocation;
        callback(supportsGeolocation);
    }
}

/**
 * A `GeolocateControl` control provides a button that uses the browser's geolocation
 * API to locate the user on the map.
 *
 * Not all browsers support geolocation,
 * and some users may disable the feature. Geolocation support for modern
 * browsers including Chrome requires sites to be served over HTTPS. If
 * geolocation support is not available, the GeolocateControl will not
 * be visible.
 *
 * The zoom level applied will depend on the accuracy of the geolocation provided by the device.
 *
 * The GeolocateControl has two modes. If `trackUserLocation` is `false` (default) the control acts as a button, which when pressed will set the map's camera to target the user location. If the user moves, the map won't update. This is most suited for the desktop. If `trackUserLocation` is `true` the control acts as a toggle button that when active the user's location is actively monitored for changes. In this mode the GeolocateControl has three states:
 * * active - the map's camera automatically updates as the user's location changes, keeping the location dot in the center.
 * * passive - the user's location dot automatically updates, but the map's camera does not.
 * * disabled
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {Object} [options.positionOptions={enableHighAccuracy: false, timeout: 6000}] A Geolocation API [PositionOptions](https://developer.mozilla.org/en-US/docs/Web/API/PositionOptions) object.
 * @param {Object} [options.fitBoundsOptions={maxZoom: 15}] A [`fitBounds`](#Map#fitBounds) options object to use when the map is panned and zoomed to the user's location. The default is to use a `maxZoom` of 15 to limit how far the map will zoom in for very accurate locations.
 * @param {Object} [options.trackUserLocation=false] If `true` the Geolocate Control becomes a toggle button and when active the map will receive updates to the user's location as it changes.
 * @param {Object} [options.showUserLocation=true] By default a dot will be shown on the map at the user's location. Set to `false` to disable.
 *
 * @example
 * map.addControl(new mapboxgl.GeolocateControl({
 *     positionOptions: {
 *         enableHighAccuracy: true
 *     },
 *     trackUserLocation: true
 * }));
 * @see [Locate the user](https://www.mapbox.com/mapbox-gl-js/example/locate-user/)
 */
class GeolocateControl extends Evented {
    _map: Map;
    options: Options;
    _container: HTMLElement;
    _dotElement: HTMLElement;
    _geolocateButton: HTMLElement;
    _geolocationWatchID: number;
    _timeoutId: ?TimeoutID;
    _watchState: string;
    _lastKnownPosition: any;
    _userLocationDotMarker: Marker;
    _setup: boolean; // set to true once the control has been setup

    constructor(options: Options) {
        super();
        this.options = extend({}, defaultOptions, options);

        bindAll([
            '_onSuccess',
            '_onError',
            '_finish',
            '_setupUI',
            '_updateCamera',
            '_updateMarker'
        ], this);
    }

    onAdd(map: Map) {
        this._map = map;
        this._container = DOM.create('div', `${className} ${className}-group`);
        checkGeolocationSupport(this._setupUI);
        return this._container;
    }

    onRemove() {
        // clear the geolocation watch if exists
        if (this._geolocationWatchID !== undefined) {
            window.navigator.geolocation.clearWatch(this._geolocationWatchID);
            this._geolocationWatchID = (undefined: any);
        }

        // clear the marker from the map
        if (this.options.showUserLocation && this._userLocationDotMarker) {
            this._userLocationDotMarker.remove();
        }

        DOM.remove(this._container);
        this._map = (undefined: any);
    }

    _onSuccess(position: Position) {
        if (this.options.trackUserLocation) {
            // keep a record of the position so that if the state is BACKGROUND and the user
            // clicks the button, we can move to ACTIVE_LOCK immediately without waiting for
            // watchPosition to trigger _onSuccess
            this._lastKnownPosition = position;

            switch (this._watchState) {
            case 'WAITING_ACTIVE':
            case 'ACTIVE_LOCK':
            case 'ACTIVE_ERROR':
                this._watchState = 'ACTIVE_LOCK';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active-error');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active');
                break;
            case 'BACKGROUND':
            case 'BACKGROUND_ERROR':
                this._watchState = 'BACKGROUND';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background-error');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background');
                break;
            default:
                assert(false, `Unexpected watchState ${this._watchState}`);
            }
        }

        // if showUserLocation and the watch state isn't off then update the marker location
        if (this.options.showUserLocation && this._watchState !== 'OFF') {
            this._updateMarker(position);
        }

        // if in normal mode (not watch mode), or if in watch mode and the state is active watch
        // then update the camera
        if (!this.options.trackUserLocation || this._watchState === 'ACTIVE_LOCK') {
            this._updateCamera(position);
        }

        if (this.options.showUserLocation) {
            this._dotElement.classList.remove('mapboxgl-user-location-dot-stale');
        }

        this.fire(new Event('geolocate', position));
        this._finish();
    }

    _updateCamera(position: Position) {
        const center = new LngLat(position.coords.longitude, position.coords.latitude);
        const radius = position.coords.accuracy;

        this._map.fitBounds(center.toBounds(radius), this.options.fitBoundsOptions, {
            geolocateSource: true // tag this camera change so it won't cause the control to change to background state
        });
    }

    _updateMarker(position: ?Position) {
        if (position) {
            this._userLocationDotMarker.setLngLat([position.coords.longitude, position.coords.latitude]).addTo(this._map);
        } else {
            this._userLocationDotMarker.remove();
        }
    }

    _onError(error: PositionError) {
        if (this.options.trackUserLocation) {
            if (error.code === 1) {
                // PERMISSION_DENIED
                this._watchState = 'OFF';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active-error');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background-error');

                if (this._geolocationWatchID !== undefined) {
                    this._clearWatch();
                }
            } else {
                switch (this._watchState) {
                case 'WAITING_ACTIVE':
                    this._watchState = 'ACTIVE_ERROR';
                    this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');
                    this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active-error');
                    break;
                case 'ACTIVE_LOCK':
                    this._watchState = 'ACTIVE_ERROR';
                    this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');
                    this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active-error');
                    this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                    // turn marker grey
                    break;
                case 'BACKGROUND':
                    this._watchState = 'BACKGROUND_ERROR';
                    this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background');
                    this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background-error');
                    this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                    // turn marker grey
                    break;
                case 'ACTIVE_ERROR':
                    break;
                default:
                    assert(false, `Unexpected watchState ${this._watchState}`);
                }
            }
        }

        if (this._watchState !== 'OFF' && this.options.showUserLocation) {
            this._dotElement.classList.add('mapboxgl-user-location-dot-stale');
        }

        this.fire(new Event('error', error));

        this._finish();
    }

    _finish() {
        if (this._timeoutId) { clearTimeout(this._timeoutId); }
        this._timeoutId = undefined;
    }

    _setupUI(supported: boolean) {
        if (supported === false) {
            warnOnce('Geolocation support is not available, the GeolocateControl will not be visible.');
            return;
        }
        this._container.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
        this._geolocateButton = DOM.create('button',
            `${className}-icon ${className}-geolocate`,
            this._container);
        this._geolocateButton.type = 'button';
        this._geolocateButton.setAttribute('aria-label', 'Geolocate');

        if (this.options.trackUserLocation) {
            this._geolocateButton.setAttribute('aria-pressed', 'false');
            this._watchState = 'OFF';
        }

        // when showUserLocation is enabled, keep the Geolocate button disabled until the device location marker is setup on the map
        if (this.options.showUserLocation) {
            this._dotElement = DOM.create('div', 'mapboxgl-user-location-dot');

            this._userLocationDotMarker = new Marker(this._dotElement);

            if (this.options.trackUserLocation) this._watchState = 'OFF';
        }

        this._geolocateButton.addEventListener('click',
            this.trigger.bind(this));

        this._setup = true;

        // when the camera is changed (and it's not as a result of the Geolocation Control) change
        // the watch mode to background watch, so that the marker is updated but not the camera.
        if (this.options.trackUserLocation) {
            this._map.on('movestart', (event) => {
                if (!event.geolocateSource && this._watchState === 'ACTIVE_LOCK') {
                    this._watchState = 'BACKGROUND';
                    this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background');
                    this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');

                    this.fire(new Event('trackuserlocationend'));
                }
            });
        }
    }

    /**
     * Trigger a geolocation
     *
     * @returns {boolean} Returns `false` if called before control was added to a map, otherwise returns `true`.
     */
    trigger() {
        if (!this._setup) {
            warnOnce('Geolocate control triggered before added to a map');
            return false;
        }
        if (this.options.trackUserLocation) {
            // update watchState and do any outgoing state cleanup
            switch (this._watchState) {
            case 'OFF':
                // turn on the Geolocate Control
                this._watchState = 'WAITING_ACTIVE';

                this.fire(new Event('trackuserlocationstart'));
                break;
            case 'WAITING_ACTIVE':
            case 'ACTIVE_LOCK':
            case 'ACTIVE_ERROR':
            case 'BACKGROUND_ERROR':
                // turn off the Geolocate Control
                this._watchState = 'OFF';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active-error');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background-error');

                this.fire(new Event('trackuserlocationend'));
                break;
            case 'BACKGROUND':
                this._watchState = 'ACTIVE_LOCK';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background');
                // set camera to last known location
                if (this._lastKnownPosition) this._updateCamera(this._lastKnownPosition);

                this.fire(new Event('trackuserlocationstart'));
                break;
            default:
                assert(false, `Unexpected watchState ${this._watchState}`);
            }

            // incoming state setup
            switch (this._watchState) {
            case 'WAITING_ACTIVE':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active');
                break;
            case 'ACTIVE_LOCK':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active');
                break;
            case 'ACTIVE_ERROR':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active-error');
                break;
            case 'BACKGROUND':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background');
                break;
            case 'BACKGROUND_ERROR':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background-error');
                break;
            case 'OFF':
                break;
            default:
                assert(false, `Unexpected watchState ${this._watchState}`);
            }

            // manage geolocation.watchPosition / geolocation.clearWatch
            if (this._watchState === 'OFF' && this._geolocationWatchID !== undefined) {
                // clear watchPosition as we've changed to an OFF state
                this._clearWatch();
            } else if (this._geolocationWatchID === undefined) {
                // enable watchPosition since watchState is not OFF and there is no watchPosition already running

                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.setAttribute('aria-pressed', 'true');

                this._geolocationWatchID = window.navigator.geolocation.watchPosition(
                    this._onSuccess, this._onError, this.options.positionOptions);
            }
        } else {
            window.navigator.geolocation.getCurrentPosition(
                this._onSuccess, this._onError, this.options.positionOptions);

            // This timeout ensures that we still call finish() even if
            // the user declines to share their location in Firefox
            this._timeoutId = setTimeout(this._finish, 10000 /* 10sec */);
        }

        return true;
    }

    _clearWatch() {
        window.navigator.geolocation.clearWatch(this._geolocationWatchID);

        this._geolocationWatchID = (undefined: any);
        this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
        this._geolocateButton.setAttribute('aria-pressed', 'false');

        if (this.options.showUserLocation) {
            this._updateMarker(null);
        }
    }
}

export default GeolocateControl;

/* Geolocate Control Watch States
 * This is the private state of the control.
 *
 * OFF
 *    off/inactive
 * WAITING_ACTIVE
 *    Geolocate Control was clicked but still waiting for Geolocation API response with user location
 * ACTIVE_LOCK
 *    Showing the user location as a dot AND tracking the camera to be fixed to their location. If their location changes the map moves to follow.
 * ACTIVE_ERROR
 *    There was en error from the Geolocation API while trying to show and track the user location.
 * BACKGROUND
 *    Showing the user location as a dot but the camera doesn't follow their location as it changes.
 * BACKGROUND_ERROR
 *    There was an error from the Geolocation API while trying to show (but not track) the user location.
 */


/**
 * Fired on each Geolocation API position update which returned as success.
 *
 * @event geolocate
 * @memberof GeolocateControl
 * @instance
 * @property {Position} data The returned [Position](https://developer.mozilla.org/en-US/docs/Web/API/Position) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) or [Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
 *
 */

/**
 * Fired on each Geolocation API position update which returned as an error.
 *
 * @event error
 * @memberof GeolocateControl
 * @instance
 * @property {PositionError} data The returned [PositionError](https://developer.mozilla.org/en-US/docs/Web/API/PositionError) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) or [Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
 *
 */

/**
 * Fired when the Geolocate Control changes to the active lock state, which happens either upon first obtaining a successful Geolocation API position for the user (a geolocate event will follow), or the user clicks the geolocate button when in the background state which uses the last known position to recenter the map and enter active lock state (no geolocate event will follow unless the users's location changes).
 *
 * @event trackuserlocationstart
 * @memberof GeolocateControl
 * @instance
 *
 */

/**
 * Fired when the Geolocate Control changes to the background state, which happens when a user changes the camera during an active position lock. This only applies when trackUserLocation is true. In the background state, the dot on the map will update with location updates but the camera will not.
 *
 * @event trackuserlocationend
 * @memberof GeolocateControl
 * @instance
 *
 */
