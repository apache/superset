/* @flow */
const MAP_EXISTS = typeof Map !== 'undefined';

export default class OrderedElements {
    /* ::
    elements: {[string]: any};
    keyOrder: string[];
    */

    constructor() {
        this.elements = {};
        this.keyOrder = [];
    }

    forEach(callback /* : (string, any) => void */) {
        for (let i = 0; i < this.keyOrder.length; i++) {
            // (value, key) to match Map's API
            callback(this.elements[this.keyOrder[i]], this.keyOrder[i]);
        }
    }

    set(key /* : string */, value /* : any */, shouldReorder /* : ?boolean */) {
        if (!this.elements.hasOwnProperty(key)) {
            this.keyOrder.push(key);
        } else if (shouldReorder) {
            const index = this.keyOrder.indexOf(key);
            this.keyOrder.splice(index, 1);
            this.keyOrder.push(key);
        }

        if (value == null) {
            this.elements[key] = value;
            return;
        }

        if ((MAP_EXISTS && value instanceof Map) || value instanceof OrderedElements) {
            // We have found a nested Map, so we need to recurse so that all
            // of the nested objects and Maps are merged properly.
            const nested = this.elements.hasOwnProperty(key)
                ? this.elements[key]
                : new OrderedElements();
            value.forEach((value, key) => {
                nested.set(key, value, shouldReorder);
            });
            this.elements[key] = nested;
            return;
        }

        if (!Array.isArray(value) && typeof value === 'object') {
            // We have found a nested object, so we need to recurse so that all
            // of the nested objects and Maps are merged properly.
            const nested = this.elements.hasOwnProperty(key)
                ? this.elements[key]
                : new OrderedElements();
            const keys = Object.keys(value);
            for (let i = 0; i < keys.length; i += 1) {
                nested.set(keys[i], value[keys[i]], shouldReorder);
            }
            this.elements[key] = nested;
            return;
        }

        this.elements[key] = value;
    }

    get(key /* : string */) /* : any */ {
        return this.elements[key];
    }

    has(key /* : string */) /* : boolean */ {
        return this.elements.hasOwnProperty(key);
    }

    addStyleType(styleType /* : any */) /* : void */ {
        if ((MAP_EXISTS && styleType instanceof Map) || styleType instanceof OrderedElements) {
            styleType.forEach((value, key) => {
                this.set(key, value, true);
            });
        } else {
            const keys = Object.keys(styleType);
            for (let i = 0; i < keys.length; i++) {
                this.set(keys[i], styleType[keys[i]], true);
            }
        }
    }
}
