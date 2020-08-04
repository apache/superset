// @flow

import DOM from '../util/dom';
import window from '../util/window';
import LngLat from '../geo/lng_lat';
import Point from '@mapbox/point-geometry';
import smartWrap from '../util/smart_wrap';
import { bindAll, extend } from '../util/util';
import { type Anchor, anchorTranslate, applyAnchorClass } from './anchor';
import { Event, Evented } from '../util/evented';
import type Map from './map';
import type Popup from './popup';
import type {LngLatLike} from "../geo/lng_lat";
import type {MapMouseEvent, MapTouchEvent} from './events';
import type {PointLike} from '@mapbox/point-geometry';

type Options = {
    element?: HTMLElement,
    offset?: PointLike,
    anchor?: Anchor,
    color?: string,
    draggable?: boolean
};

/**
 * Creates a marker component
 * @param {Object} [options]
 * @param {HTMLElement} [options.element] DOM element to use as a marker. The default is a light blue, droplet-shaped SVG marker.
 * @param {string} [options.anchor='center'] A string indicating the part of the Marker that should be positioned closest to the coordinate set via {@link Marker#setLngLat}.
 *   Options are `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`.
 * @param {PointLike} [options.offset] The offset in pixels as a {@link PointLike} object to apply relative to the element's center. Negatives indicate left and up.
 * @param {string} [options.color='#3FB1CE'] The color to use for the default marker if options.element is not provided. The default is light blue.
 * @param {boolean} [options.draggable=false] A boolean indicating whether or not a marker is able to be dragged to a new position on the map.
 * @example
 * var marker = new mapboxgl.Marker()
 *   .setLngLat([30.5, 50.5])
 *   .addTo(map);
 * @see [Add custom icons with Markers](https://www.mapbox.com/mapbox-gl-js/example/custom-marker-icons/)
 * @see [Create a draggable Marker](https://www.mapbox.com/mapbox-gl-js/example/drag-a-marker/)
 */
export default class Marker extends Evented {
    _map: Map;
    _anchor: Anchor;
    _offset: Point;
    _element: HTMLElement;
    _popup: ?Popup;
    _lngLat: LngLat;
    _pos: ?Point;
    _color: ?string;
    _defaultMarker: boolean;
    _draggable: boolean;
    _state: 'inactive' | 'pending' | 'active'; // used for handling drag events
    _positionDelta: ?number;

    constructor(options?: Options, legacyOptions?: Options) {
        super();
        // For backward compatibility -- the constructor used to accept the element as a
        // required first argument, before it was made optional.
        if (options instanceof window.HTMLElement || legacyOptions) {
            options = extend({element: options}, legacyOptions);
        }

        bindAll([
            '_update',
            '_onMove',
            '_onUp',
            '_addDragHandler',
            '_onMapClick'
        ], this);

        this._anchor = options && options.anchor || 'center';
        this._color = options && options.color || '#3FB1CE';
        this._draggable = options && options.draggable || false;
        this._state = 'inactive';

        if (!options || !options.element) {
            this._defaultMarker = true;
            this._element = DOM.create('div');

            // create default map marker SVG
            const svg = DOM.createNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttributeNS(null, 'display', 'block');
            svg.setAttributeNS(null, 'height', '41px');
            svg.setAttributeNS(null, 'width', '27px');
            svg.setAttributeNS(null, 'viewBox', '0 0 27 41');

            const markerLarge = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            markerLarge.setAttributeNS(null, 'stroke', 'none');
            markerLarge.setAttributeNS(null, 'stroke-width', '1');
            markerLarge.setAttributeNS(null, 'fill', 'none');
            markerLarge.setAttributeNS(null, 'fill-rule', 'evenodd');

            const page1 = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            page1.setAttributeNS(null, 'fill-rule', 'nonzero');

            const shadow = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            shadow.setAttributeNS(null, 'transform', 'translate(3.0, 29.0)');
            shadow.setAttributeNS(null, 'fill', '#000000');

            const ellipses = [
                {'rx': '10.5', 'ry': '5.25002273'},
                {'rx': '10.5', 'ry': '5.25002273'},
                {'rx': '9.5', 'ry': '4.77275007'},
                {'rx': '8.5', 'ry': '4.29549936'},
                {'rx': '7.5', 'ry': '3.81822308'},
                {'rx': '6.5', 'ry': '3.34094679'},
                {'rx': '5.5', 'ry': '2.86367051'},
                {'rx': '4.5', 'ry': '2.38636864'}
            ];

            for (const data of ellipses) {
                const ellipse = DOM.createNS('http://www.w3.org/2000/svg', 'ellipse');
                ellipse.setAttributeNS(null, 'opacity', '0.04');
                ellipse.setAttributeNS(null, 'cx', '10.5');
                ellipse.setAttributeNS(null, 'cy', '5.80029008');
                ellipse.setAttributeNS(null, 'rx', data['rx']);
                ellipse.setAttributeNS(null, 'ry', data['ry']);
                shadow.appendChild(ellipse);
            }

            const background = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            background.setAttributeNS(null, 'fill', this._color);

            const bgPath = DOM.createNS('http://www.w3.org/2000/svg', 'path');
            bgPath.setAttributeNS(null, 'd', 'M27,13.5 C27,19.074644 20.250001,27.000002 14.75,34.500002 C14.016665,35.500004 12.983335,35.500004 12.25,34.500002 C6.7499993,27.000002 0,19.222562 0,13.5 C0,6.0441559 6.0441559,0 13.5,0 C20.955844,0 27,6.0441559 27,13.5 Z');

            background.appendChild(bgPath);

            const border = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            border.setAttributeNS(null, 'opacity', '0.25');
            border.setAttributeNS(null, 'fill', '#000000');

            const borderPath = DOM.createNS('http://www.w3.org/2000/svg', 'path');
            borderPath.setAttributeNS(null, 'd', 'M13.5,0 C6.0441559,0 0,6.0441559 0,13.5 C0,19.222562 6.7499993,27 12.25,34.5 C13,35.522727 14.016664,35.500004 14.75,34.5 C20.250001,27 27,19.074644 27,13.5 C27,6.0441559 20.955844,0 13.5,0 Z M13.5,1 C20.415404,1 26,6.584596 26,13.5 C26,15.898657 24.495584,19.181431 22.220703,22.738281 C19.945823,26.295132 16.705119,30.142167 13.943359,33.908203 C13.743445,34.180814 13.612715,34.322738 13.5,34.441406 C13.387285,34.322738 13.256555,34.180814 13.056641,33.908203 C10.284481,30.127985 7.4148684,26.314159 5.015625,22.773438 C2.6163816,19.232715 1,15.953538 1,13.5 C1,6.584596 6.584596,1 13.5,1 Z');

            border.appendChild(borderPath);

            const maki = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            maki.setAttributeNS(null, 'transform', 'translate(6.0, 7.0)');
            maki.setAttributeNS(null, 'fill', '#FFFFFF');

            const circleContainer = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            circleContainer.setAttributeNS(null, 'transform', 'translate(8.0, 8.0)');

            const circle1 = DOM.createNS('http://www.w3.org/2000/svg', 'circle');
            circle1.setAttributeNS(null, 'fill', '#000000');
            circle1.setAttributeNS(null, 'opacity', '0.25');
            circle1.setAttributeNS(null, 'cx', '5.5');
            circle1.setAttributeNS(null, 'cy', '5.5');
            circle1.setAttributeNS(null, 'r', '5.4999962');

            const circle2 = DOM.createNS('http://www.w3.org/2000/svg', 'circle');
            circle2.setAttributeNS(null, 'fill', '#FFFFFF');
            circle2.setAttributeNS(null, 'cx', '5.5');
            circle2.setAttributeNS(null, 'cy', '5.5');
            circle2.setAttributeNS(null, 'r', '5.4999962');

            circleContainer.appendChild(circle1);
            circleContainer.appendChild(circle2);

            page1.appendChild(shadow);
            page1.appendChild(background);
            page1.appendChild(border);
            page1.appendChild(maki);
            page1.appendChild(circleContainer);

            svg.appendChild(page1);

            this._element.appendChild(svg);

            // if no element and no offset option given apply an offset for the default marker
            // the -14 as the y value of the default marker offset was determined as follows
            //
            // the marker tip is at the center of the shadow ellipse from the default svg
            // the y value of the center of the shadow ellipse relative to the svg top left is "shadow transform translate-y (29.0) + ellipse cy (5.80029008)"
            // offset to the svg center "height (41 / 2)" gives (29.0 + 5.80029008) - (41 / 2) and rounded for an integer pixel offset gives 14
            // negative is used to move the marker up from the center so the tip is at the Marker lngLat
            this._offset = Point.convert(options && options.offset || [0, -14]);
        } else {
            this._element = options.element;
            this._offset = Point.convert(options && options.offset || [0, 0]);
        }

        this._element.classList.add('mapboxgl-marker');
        this._element.addEventListener('dragstart', (e: DragEvent) => {
            e.preventDefault();
        });
        applyAnchorClass(this._element, this._anchor, 'marker');

        this._popup = null;
    }

    /**
     * Attaches the marker to a map
     * @param {Map} map
     * @returns {Marker} `this`
     */
    addTo(map: Map) {
        this.remove();
        this._map = map;
        map.getCanvasContainer().appendChild(this._element);
        map.on('move', this._update);
        map.on('moveend', this._update);
        this.setDraggable(this._draggable);
        this._update();

        // If we attached the `click` listener to the marker element, the popup
        // would close once the event propogated to `map` due to the
        // `Popup#_onClickClose` listener.
        this._map.on('click', this._onMapClick);

        return this;
    }

    /**
     * Removes the marker from a map
     * @example
     * var marker = new mapboxgl.Marker().addTo(map);
     * marker.remove();
     * @returns {Marker} `this`
     */
    remove() {
        if (this._map) {
            this._map.off('click', this._onMapClick);
            this._map.off('move', this._update);
            this._map.off('moveend', this._update);
            this._map.off('mousedown', this._addDragHandler);
            this._map.off('touchstart', this._addDragHandler);
            this._map.off('mouseup', this._onUp);
            this._map.off('touchend', this._onUp);
            delete this._map;
        }
        DOM.remove(this._element);
        if (this._popup) this._popup.remove();
        return this;
    }

    /**
     * Get the marker's geographical location.
     *
     * The longitude of the result may differ by a multiple of 360 degrees from the longitude previously
     * set by `setLngLat` because `Marker` wraps the anchor longitude across copies of the world to keep
     * the marker on screen.
     *
     * @returns {LngLat}
     */
    getLngLat() {
        return this._lngLat;
    }

    /**
     * Set the marker's geographical position and move it.
     * @returns {Marker} `this`
     */
    setLngLat(lnglat: LngLatLike) {
        this._lngLat = LngLat.convert(lnglat);
        this._pos = null;
        if (this._popup) this._popup.setLngLat(this._lngLat);
        this._update();
        return this;
    }

    /**
     * Returns the `Marker`'s HTML element.
     * @returns {HTMLElement} element
     */
    getElement() {
        return this._element;
    }

    /**
     * Binds a Popup to the Marker
     * @param popup an instance of the `Popup` class. If undefined or null, any popup
     * set on this `Marker` instance is unset
     * @returns {Marker} `this`
     */
    setPopup(popup: ?Popup) {
        if (this._popup) {
            this._popup.remove();
            this._popup = null;
        }

        if (popup) {
            if (!('offset' in popup.options)) {
                const markerHeight = 41 - (5.8 / 2);
                const markerRadius = 13.5;
                const linearOffset = Math.sqrt(Math.pow(markerRadius, 2) / 2);
                popup.options.offset = this._defaultMarker ? {
                    'top': [0, 0],
                    'top-left': [0, 0],
                    'top-right': [0, 0],
                    'bottom': [0, -markerHeight],
                    'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
                    'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
                    'left': [markerRadius, (markerHeight - markerRadius) * -1],
                    'right': [-markerRadius, (markerHeight - markerRadius) * -1]
                } : this._offset;
            }
            this._popup = popup;
            if (this._lngLat) this._popup.setLngLat(this._lngLat);
        }

        return this;
    }

    _onMapClick(e: MapMouseEvent) {
        const targetElement = e.originalEvent.target;
        const element = this._element;

        if (this._popup && (targetElement === element || element.contains((targetElement: any)))) {
            this.togglePopup();
        }
    }

    /**
     * Returns the Popup instance that is bound to the Marker
     * @returns {Popup} popup
     */
    getPopup() {
        return this._popup;
    }

    /**
     * Opens or closes the bound popup, depending on the current state
     * @returns {Marker} `this`
     */
    togglePopup() {
        const popup = this._popup;

        if (!popup) return this;
        else if (popup.isOpen()) popup.remove();
        else popup.addTo(this._map);
        return this;
    }

    _update(e?: {type: 'move' | 'moveend'}) {
        if (!this._map) return;

        if (this._map.transform.renderWorldCopies) {
            this._lngLat = smartWrap(this._lngLat, this._pos, this._map.transform);
        }

        this._pos = this._map.project(this._lngLat)._add(this._offset);

        // because rounding the coordinates at every `move` event causes stuttered zooming
        // we only round them when _update is called with `moveend` or when its called with
        // no arguments (when the Marker is initialized or Marker#setLngLat is invoked).
        if (!e || e.type === "moveend") {
            this._pos = this._pos.round();
        }

        DOM.setTransform(this._element, `${anchorTranslate[this._anchor]} translate(${this._pos.x}px, ${this._pos.y}px)`);
    }

    /**
     * Get the marker's offset.
     * @returns {Point}
     */
    getOffset() {
        return this._offset;
    }

    /**
     * Sets the offset of the marker
     * @param {PointLike} offset The offset in pixels as a {@link PointLike} object to apply relative to the element's center. Negatives indicate left and up.
     * @returns {Marker} `this`
     */
    setOffset(offset: PointLike) {
        this._offset = Point.convert(offset);
        this._update();
        return this;
    }

    _onMove(e: MapMouseEvent | MapTouchEvent) {
        this._pos = e.point.sub(this._positionDelta);
        this._lngLat = this._map.unproject(this._pos);
        this.setLngLat(this._lngLat);
        // suppress click event so that popups don't toggle on drag
        this._element.style.pointerEvents = 'none';

        // make sure dragstart only fires on the first move event after mousedown.
        // this can't be on mousedown because that event doesn't necessarily
        // imply that a drag is about to happen.
        if (this._state === 'pending') {
            this._state = 'active';

            /**
             * Fired when dragging starts
             *
             * @event dragstart
             * @memberof Marker
             * @instance
             * @type {Object}
             * @property {Marker} marker object that is being dragged
             */
            this.fire(new Event('dragstart'));
        }

        /**
         * Fired while dragging
         *
         * @event drag
         * @memberof Marker
         * @instance
         * @type {Object}
         * @property {Marker} marker object that is being dragged
         */
        this.fire(new Event('drag'));
    }

    _onUp() {
        // revert to normal pointer event handling
        this._element.style.pointerEvents = 'auto';
        this._positionDelta = null;
        this._map.off('mousemove', this._onMove);
        this._map.off('touchmove', this._onMove);

        // only fire dragend if it was preceded by at least one drag event
        if (this._state === 'active') {
            /**
            * Fired when the marker is finished being dragged
            *
            * @event dragend
            * @memberof Marker
            * @instance
            * @type {Object}
            * @property {Marker} marker object that was dragged
            */
            this.fire(new Event('dragend'));
        }

        this._state = 'inactive';
    }

    _addDragHandler(e: MapMouseEvent | MapTouchEvent) {
        if (this._element.contains((e.originalEvent.target: any))) {
            e.preventDefault();

            // We need to calculate the pixel distance between the click point
            // and the marker position, with the offset accounted for. Then we
            // can subtract this distance from the mousemove event's position
            // to calculate the new marker position.
            // If we don't do this, the marker 'jumps' to the click position
            // creating a jarring UX effect.
            this._positionDelta = e.point.sub(this._pos).add(this._offset);

            this._state = 'pending';
            this._map.on('mousemove', this._onMove);
            this._map.on('touchmove', this._onMove);
            this._map.once('mouseup', this._onUp);
            this._map.once('touchend', this._onUp);
        }
    }

    /**
     * Sets the `draggable` property and functionality of the marker
     * @param {boolean} [shouldBeDraggable=false] Turns drag functionality on/off
     * @returns {Marker} `this`
     */
    setDraggable(shouldBeDraggable: boolean) {
        this._draggable = !!shouldBeDraggable; // convert possible undefined value to false

        // handle case where map may not exist yet
        // e.g. when setDraggable is called before addTo
        if (this._map) {
            if (shouldBeDraggable) {
                this._map.on('mousedown', this._addDragHandler);
                this._map.on('touchstart', this._addDragHandler);
            } else {
                this._map.off('mousedown', this._addDragHandler);
                this._map.off('touchstart', this._addDragHandler);
            }
        }

        return this;
    }

    /**
     * Returns true if the marker can be dragged
     * @returns {boolean}
     */
    isDraggable() {
        return this._draggable;
    }
}
