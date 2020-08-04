// @flow

import { extend, bindAll } from '../util/util';
import { Event, Evented } from '../util/evented';
import DOM from '../util/dom';
import LngLat from '../geo/lng_lat';
import Point from '@mapbox/point-geometry';
import window from '../util/window';
import smartWrap from '../util/smart_wrap';
import { type Anchor, anchorTranslate, applyAnchorClass } from './anchor';

import type Map from './map';
import type {LngLatLike} from '../geo/lng_lat';
import type {PointLike} from '@mapbox/point-geometry';

const defaultOptions = {
    closeButton: true,
    closeOnClick: true,
    className: '',
    maxWidth: "240px"
};

export type Offset = number | PointLike | {[Anchor]: PointLike};

export type PopupOptions = {
    closeButton?: boolean,
    closeOnClick?: boolean,
    anchor?: Anchor,
    offset?: Offset,
    className?: string,
    maxWidth?: string
};

/**
 * A popup component.
 *
 * @param {Object} [options]
 * @param {boolean} [options.closeButton=true] If `true`, a close button will appear in the
 *   top right corner of the popup.
 * @param {boolean} [options.closeOnClick=true] If `true`, the popup will closed when the
 *   map is clicked.
 * @param {string} [options.anchor] - A string indicating the part of the Popup that should
 *   be positioned closest to the coordinate set via {@link Popup#setLngLat}.
 *   Options are `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`,
 *   `'top-right'`, `'bottom-left'`, and `'bottom-right'`. If unset the anchor will be
 *   dynamically set to ensure the popup falls within the map container with a preference
 *   for `'bottom'`.
 * @param {number|PointLike|Object} [options.offset] -
 *  A pixel offset applied to the popup's location specified as:
 *   - a single number specifying a distance from the popup's location
 *   - a {@link PointLike} specifying a constant offset
 *   - an object of {@link Point}s specifing an offset for each anchor position
 *  Negative offsets indicate left and up.
 * @param {string} [options.className] Space-separated CSS class names to add to popup container
 * @param {string} [options.maxWidth] A string that sets the CSS property of the popup's maxWidth in pixels, eg "300px"
 * @example
 * var markerHeight = 50, markerRadius = 10, linearOffset = 25;
 * var popupOffsets = {
 *  'top': [0, 0],
 *  'top-left': [0,0],
 *  'top-right': [0,0],
 *  'bottom': [0, -markerHeight],
 *  'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 *  'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 *  'left': [markerRadius, (markerHeight - markerRadius) * -1],
 *  'right': [-markerRadius, (markerHeight - markerRadius) * -1]
 *  };
 * var popup = new mapboxgl.Popup({offset: popupOffsets, className: 'my-class'})
 *   .setLngLat(e.lngLat)
 *   .setHTML("<h1>Hello World!</h1>")
 *   .setMaxWidth("300px")
 *   .addTo(map);
 * @see [Display a popup](https://www.mapbox.com/mapbox-gl-js/example/popup/)
 * @see [Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
 * @see [Display a popup on click](https://www.mapbox.com/mapbox-gl-js/example/popup-on-click/)
 * @see [Attach a popup to a marker instance](https://www.mapbox.com/mapbox-gl-js/example/set-popup/)
 */
export default class Popup extends Evented {
    _map: Map;
    options: PopupOptions;
    _content: HTMLElement;
    _container: HTMLElement;
    _closeButton: HTMLElement;
    _tip: HTMLElement;
    _lngLat: LngLat;
    _pos: ?Point;

    constructor(options: PopupOptions) {
        super();
        this.options = extend(Object.create(defaultOptions), options);
        bindAll(['_update', '_onClickClose', 'remove'], this);
    }

    /**
     * Adds the popup to a map.
     *
     * @param {Map} map The Mapbox GL JS map to add the popup to.
     * @returns {Popup} `this`
     */
    addTo(map: Map) {
        this._map = map;
        this._map.on('move', this._update);
        if (this.options.closeOnClick) {
            this._map.on('click', this._onClickClose);
        }
        this._map.on('remove', this.remove);
        this._update();

        /**
         * Fired when the popup is opened manually or programatically.
         *
         * @event open
         * @memberof Popup
         * @instance
         * @type {Object}
         * @property {Popup} popup object that was opened
         */
        this.fire(new Event('open'));

        return this;
    }

    /**
     * @returns {boolean} `true` if the popup is open, `false` if it is closed.
     */
    isOpen() {
        return !!this._map;
    }

    /**
     * Removes the popup from the map it has been added to.
     *
     * @example
     * var popup = new mapboxgl.Popup().addTo(map);
     * popup.remove();
     * @returns {Popup} `this`
     */
    remove() {
        if (this._content) {
            DOM.remove(this._content);
        }

        if (this._container) {
            DOM.remove(this._container);
            delete this._container;
        }

        if (this._map) {
            this._map.off('move', this._update);
            this._map.off('click', this._onClickClose);
            this._map.off('remove', this.remove);
            delete this._map;
        }

        /**
         * Fired when the popup is closed manually or programatically.
         *
         * @event close
         * @memberof Popup
         * @instance
         * @type {Object}
         * @property {Popup} popup object that was closed
         */
        this.fire(new Event('close'));

        return this;
    }

    /**
     * Returns the geographical location of the popup's anchor.
     *
     * The longitude of the result may differ by a multiple of 360 degrees from the longitude previously
     * set by `setLngLat` because `Popup` wraps the anchor longitude across copies of the world to keep
     * the popup on screen.
     *
     * @returns {LngLat} The geographical location of the popup's anchor.
     */
    getLngLat() {
        return this._lngLat;
    }

    /**
     * Sets the geographical location of the popup's anchor, and moves the popup to it.
     *
     * @param lnglat The geographical location to set as the popup's anchor.
     * @returns {Popup} `this`
     */
    setLngLat(lnglat: LngLatLike) {
        this._lngLat = LngLat.convert(lnglat);
        this._pos = null;
        this._update();
        return this;
    }

    /**
     * Sets the popup's content to a string of text.
     *
     * This function creates a [Text](https://developer.mozilla.org/en-US/docs/Web/API/Text) node in the DOM,
     * so it cannot insert raw HTML. Use this method for security against XSS
     * if the popup content is user-provided.
     *
     * @param text Textual content for the popup.
     * @returns {Popup} `this`
     * @example
     * var popup = new mapboxgl.Popup()
     *   .setLngLat(e.lngLat)
     *   .setText('Hello, world!')
     *   .addTo(map);
     */
    setText(text: string) {
        return this.setDOMContent(window.document.createTextNode(text));
    }

    /**
     * Sets the popup's content to the HTML provided as a string.
     *
     * This method does not perform HTML filtering or sanitization, and must be
     * used only with trusted content. Consider {@link Popup#setText} if
     * the content is an untrusted text string.
     *
     * @param html A string representing HTML content for the popup.
     * @returns {Popup} `this`
     */
    setHTML(html: string) {
        const frag = window.document.createDocumentFragment();
        const temp = window.document.createElement('body');
        let child;
        temp.innerHTML = html;
        while (true) {
            child = temp.firstChild;
            if (!child) break;
            frag.appendChild(child);
        }

        return this.setDOMContent(frag);
    }

    /**
     * Returns the popup's max width.
     *
     * @returns {string} The max width of the popup.
     */
    getMaxWidth() {
        return this._container.style.maxWidth;
    }

    /**
     * Sets the popup's max width. This is setting the CSS property maxWidth. It expects a string in "Npx" format, where N is some number.
     *
     * @param maxWidth A string representing the pixel value for the maximum width.
     * @returns {Popup} `this`
     */
    setMaxWidth(maxWidth: string) {
        this.options.maxWidth = maxWidth;
        this._update();
        return this;
    }

    /**
     * Sets the popup's content to the element provided as a DOM node.
     *
     * @param htmlNode A DOM node to be used as content for the popup.
     * @returns {Popup} `this`
     * @example
     * // create an element with the popup content
     * var div = window.document.createElement('div');
     * div.innerHTML = 'Hello, world!';
     * var popup = new mapboxgl.Popup()
     *   .setLngLat(e.lngLat)
     *   .setDOMContent(div)
     *   .addTo(map);
     */
    setDOMContent(htmlNode: Node) {
        this._createContent();
        this._content.appendChild(htmlNode);
        this._update();
        return this;
    }

    _createContent() {
        if (this._content) {
            DOM.remove(this._content);
        }

        this._content = DOM.create('div', 'mapboxgl-popup-content', this._container);

        if (this.options.closeButton) {
            this._closeButton = DOM.create('button', 'mapboxgl-popup-close-button', this._content);
            this._closeButton.type = 'button';
            this._closeButton.setAttribute('aria-label', 'Close popup');
            this._closeButton.innerHTML = '&#215;';
            this._closeButton.addEventListener('click', this._onClickClose);
        }
    }

    _update() {
        if (!this._map || !this._lngLat || !this._content) { return; }

        if (!this._container) {
            this._container = DOM.create('div', 'mapboxgl-popup', this._map.getContainer());
            this._tip       = DOM.create('div', 'mapboxgl-popup-tip', this._container);
            this._container.appendChild(this._content);
            if (this.options.className) {
                this.options.className.split(' ').forEach(name =>
                    this._container.classList.add(name));
            }
        }

        if (this.options.maxWidth && this._container.style.maxWidth !== this.options.maxWidth) {
            this._container.style.maxWidth = this.options.maxWidth;
        }

        if (this._map.transform.renderWorldCopies) {
            this._lngLat = smartWrap(this._lngLat, this._pos, this._map.transform);
        }

        const pos = this._pos = this._map.project(this._lngLat);

        let anchor: ?Anchor = this.options.anchor;
        const offset = normalizeOffset(this.options.offset);

        if (!anchor) {
            const width = this._container.offsetWidth;
            const height = this._container.offsetHeight;
            let anchorComponents;

            if (pos.y + offset.bottom.y < height) {
                anchorComponents = ['top'];
            } else if (pos.y > this._map.transform.height - height) {
                anchorComponents = ['bottom'];
            } else {
                anchorComponents = [];
            }

            if (pos.x < width / 2) {
                anchorComponents.push('left');
            } else if (pos.x > this._map.transform.width - width / 2) {
                anchorComponents.push('right');
            }

            if (anchorComponents.length === 0) {
                anchor = 'bottom';
            } else {
                anchor = (anchorComponents.join('-'): any);
            }
        }

        const offsetedPos = pos.add(offset[anchor]).round();

        DOM.setTransform(this._container, `${anchorTranslate[anchor]} translate(${offsetedPos.x}px,${offsetedPos.y}px)`);
        applyAnchorClass(this._container, anchor, 'popup');
    }

    _onClickClose() {
        this.remove();
    }
}

function normalizeOffset(offset: ?Offset) {
    if (!offset) {
        return normalizeOffset(new Point(0, 0));

    } else if (typeof offset === 'number') {
        // input specifies a radius from which to calculate offsets at all positions
        const cornerOffset = Math.round(Math.sqrt(0.5 * Math.pow(offset, 2)));
        return {
            'center': new Point(0, 0),
            'top': new Point(0, offset),
            'top-left': new Point(cornerOffset, cornerOffset),
            'top-right': new Point(-cornerOffset, cornerOffset),
            'bottom': new Point(0, -offset),
            'bottom-left': new Point(cornerOffset, -cornerOffset),
            'bottom-right': new Point(-cornerOffset, -cornerOffset),
            'left': new Point(offset, 0),
            'right': new Point(-offset, 0)
        };

    } else if (offset instanceof Point || Array.isArray(offset)) {
        // input specifies a single offset to be applied to all positions
        const convertedOffset = Point.convert(offset);
        return {
            'center': convertedOffset,
            'top': convertedOffset,
            'top-left': convertedOffset,
            'top-right': convertedOffset,
            'bottom': convertedOffset,
            'bottom-left': convertedOffset,
            'bottom-right': convertedOffset,
            'left': convertedOffset,
            'right': convertedOffset
        };

    } else {
        // input specifies an offset per position
        return {
            'center': Point.convert(offset['center'] || [0, 0]),
            'top': Point.convert(offset['top'] || [0, 0]),
            'top-left': Point.convert(offset['top-left'] || [0, 0]),
            'top-right': Point.convert(offset['top-right'] || [0, 0]),
            'bottom': Point.convert(offset['bottom'] || [0, 0]),
            'bottom-left': Point.convert(offset['bottom-left'] || [0, 0]),
            'bottom-right': Point.convert(offset['bottom-right'] || [0, 0]),
            'left': Point.convert(offset['left'] || [0, 0]),
            'right': Point.convert(offset['right'] || [0, 0])
        };
    }
}
