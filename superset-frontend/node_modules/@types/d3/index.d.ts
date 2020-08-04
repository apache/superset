// Type definitions for d3JS 3.5
// Project: http://d3js.org/
// Definitions by: Alex Ford <https://github.com/gustavderdrache>, Boris Yankov <https://github.com/borisyankov>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/* tslint:disable */

// Latest patch version of module validated against: 3.5.17

export = d3;
export as namespace d3;

declare namespace d3 {
    /**
     * The current version of D3.js.
     */
    export var version: string;

    /**
     * Find the first element that matches the given selector string.
     */
    export function select(selector: string): Selection<any>;

    /**
     * Create a selection from the given node reference.
     */
    export function select(node: EventTarget): Selection<any>;

    /**
     * Find all elements that match the given selector string.
     */
    export function selectAll(selector: string): Selection<any>;

    /**
     * Create a selection from the given list of nodes.
     */
    export function selectAll(nodes: EventTarget[]): Selection<any>;

    /**
     * Returns the root selection (as if by d3.select(document.documentElement)). This function may be used for 'instanceof' tests, and extending its prototype will add properties to all selections.
     */
    export function selection(): Selection<any>;

    namespace selection {
        export var prototype: Selection<any>;

        /**
         * Selections are grouped into arrays of nodes, with the parent tracked in the 'parentNode' property.
         */
        interface Group extends Array<EventTarget> {
            parentNode: EventTarget;
        }

        interface Update<Datum> {
            /**
             * Retrieve a grouped selection.
             */
            [index: number]: Group;

            /**
             * The number of groups in this selection.
             */
            length: number;

            /**
             * Retrieve the value of the given attribute for the first node in the selection.
             *
             * @param name The attribute name to query. May be prefixed (see d3.ns.prefix).
             */
            attr(name: string): string;

            /**
             * For all nodes, set the attribute to the specified constant value. Use null to remove.
             *
             * @param name The attribute name, optionally prefixed.
             * @param value The attribute value to use. Note that this is coerced to a string automatically.
             */
            attr(name: string, value: Primitive): Update<Datum>;

            /**
             * Derive an attribute value for each node in the selection based on bound data.
             *
             * @param name The attribute name, optionally prefixed.
             * @param value The function of the datum (the bound data item), index (the position in the subgrouping), and outer index (overall position in nested selections) which computes the attribute value. If the function returns null, the attribute is removed.
             */
            attr(name: string, value: (datum: Datum, index: number, outerIndex: number) => Primitive): Update<Datum>;

            /**
             * Set multiple properties at once using an Object. D3 iterates over all enumerable properties and either sets or computes the attribute's value based on the corresponding entry in the Object.
             *
             * @param obj A key-value mapping corresponding to attributes and values. If the value is a simple string or number, it is taken as a constant. Otherwise, it is a function that derives the attribute value.
             */
            attr(obj: { [key: string]: Primitive | ((datum: Datum, index: number, outerIndex: number) => Primitive) }): Update<Datum>;

            /**
             * Returns true if the first node in this selection has the given class list. If multiple classes are specified (i.e., "foo bar"), then returns true only if all classes match.
             *
             * @param name The class list to query.
             */
            classed(name: string): boolean;

            /**
             * Adds (or removes) the given class list.
             *
             * @param name The class list to toggle. Spaces separate class names: "foo bar" is a list of two classes.
             * @param value If true, add the classes. If false, remove them.
             */
            classed(name: string, value: boolean): Update<Datum>;

            /**
             * Determine if the given class list should be toggled for each node in the selection.
             *
             * @param name The class list. Spaces separate multiple class names.
             * @param value The function to run for each node. Should return true to add the class to the node, or false to remove it.
             */
            classed(name: string, value: (datum: Datum, index: number, outerIndex: number) => boolean): Update<Datum>;

            /**
             * Set or derive classes for multiple class lists at once.
             *
             * @param obj An Object mapping class lists to values that are either plain booleans or functions that return booleans.
             */
            classed(obj: { [key: string]: boolean | ((datum: Datum, index: number, outerIndex: number) => boolean) }): Update<Datum>;

            /**
             * Retrieve the computed style value for the first node in the selection.
             * @param name The CSS property name to query
             */
            style(name: string): string;

            /**
             * Set a style property for all nodes in the selection.
             * @param name the CSS property name
             * @param value the property value
             * @param priority if specified, either null or the string "important" (no exclamation mark)
             */
            style(name: string, value: Primitive, priority?: string): Update<Datum>;

            /**
             * Derive a property value for each node in the selection.
             * @param name the CSS property name
             * @param value the function to derive the value
             * @param priority if specified, either null or the string "important" (no exclamation mark)
             */
            style(name: string, value: (datum: Datum, index: number, outerIndex: number) => Primitive, priority?: string): Update<Datum>;

            /**
             * Set a large number of CSS properties from an object.
             *
             * @param obj an Object whose keys correspond to CSS property names and values are either constants or functions that derive property values
             * @param priority if specified, either null or the string "important" (no exclamation mark)
             */
            style(obj: { [key: string]: Primitive | ((datum: Datum, index: number, outerIndex: number) => Primitive) }, priority?: string): Update<Datum>;

            /**
             * Retrieve an arbitrary node property such as the 'checked' property of checkboxes, or the 'value' of text boxes.
             *
             * @param name the node's property to retrieve
             */
            property(name: string): any;

            /**
             * For each node, set the property value. Internally, this sets the node property directly (e.g., node[name] = value), so take care not to mutate special properties like __proto__.
             *
             * @param name the property name
             * @param value the property value
             */
            property(name: string, value: any): Update<Datum>;

            /**
             * For each node, derive the property value. Internally, this sets the node property directly (e.g., node[name] = value), so take care not to mutate special properties like __proto__.
             *
             * @param name the property name
             * @param value the function used to derive the property's value
             */
            property(name: string, value: (datum: Datum, index: number, outerIndex: number) => any): Update<Datum>;

            /**
             * Set multiple node properties. Caveats apply: take care not to mutate special properties like __proto__.
             *
             * @param obj an Object whose keys correspond to node properties and values are either constants or functions that will compute a value.
             */
            property(obj: { [key: string]: any | ((datum: Datum, index: number, outerIndex: number) => any) }): Update<Datum>;

            /**
             * Retrieve the textContent of the first node in the selection.
             */
            text(): string;

            /**
             * Set the textContent of each node in the selection.
             * @param value the text to use for all nodes
             */
            text(value: Primitive): Update<Datum>;

            /**
             * Compute the textContent of each node in the selection.
             * @param value the function which will compute the text
             */
            text(value: (datum: Datum, index: number, outerIndex: number) => Primitive): Update<Datum>;

            /**
             * Retrieve the HTML content of the first node in the selection. Uses 'innerHTML' internally and will not work with SVG or other elements without a polyfill.
             */
            html(): string;

            /**
             * Set the HTML content of every node in the selection. Uses 'innerHTML' internally and thus will not work with SVG or other elements without a polyfill.
             * @param value the HTML content to use.
             */
            html(value: string): Selection<Datum>;

            /**
             * Compute the HTML content for each node in the selection. Uses 'innerHTML' internally and thus will not work with SVG or other elements without a polyfill.
             * @param value the function to compute HTML content
             */
            html(value: (datum: Datum, index: number, outerIndex: number) => string): Selection<Datum>;

            /**
             * Appends a new child to each node in the selection. This child will inherit the parent's data (if available). Returns a fresh selection consisting of the newly-appended children.
             *
             * @param name the element name to append. May be prefixed (see d3.ns.prefix).
             */
            append(name: string): Selection<Datum>;

            /**
             * Appends a new child to each node in the selection by computing a new node. This child will inherit the parent's data (if available). Returns a fresh selection consisting of the newly-appended children.
             *
             * @param name the function to compute a new element
             */
            append(name: (datum: Datum, index: number, outerIndex: number) => EventTarget): Update<Datum>;

            /**
             * Inserts a new child to each node in the selection. This child will inherit its parent's data (if available). Returns a fresh selection consisting of the newly-inserted children.
             * @param name the element name to append. May be prefixed (see d3.ns.prefix).
             * @param before the selector to determine position (e.g., ":first-child")
             */
            insert(name: string, before: string): Update<Datum>;

            /**
             * Inserts a new child to each node in the selection. This child will inherit its parent's data (if available). Returns a fresh selection consisting of the newly-inserted children.
             * @param name the element name to append. May be prefixed (see d3.ns.prefix).
             * @param before a function to determine the node to use as the next sibling
             */
            insert(name: string, before: (datum: Datum, index: number, outerIndex: number) => EventTarget): Update<Datum>;

            /**
             * Inserts a new child to the end of each node in the selection by computing a new node. This child will inherit its parent's data (if available). Returns a fresh selection consisting of the newly-inserted children.
             * @param name the function to compute a new child
             * @param before the selector to determine position (e.g., ":first-child")
             */
            insert(name: (datum: Datum, index: number, outerIndex: number) => EventTarget, before: string): Update<Datum>;

            /**
             * Inserts a new child to the end of each node in the selection by computing a new node. This child will inherit its parent's data (if available). Returns a fresh selection consisting of the newly-inserted children.
             * @param name the function to compute a new child
             * @param before a function to determine the node to use as the next sibling
             */
            insert(name: (datum: Datum, index: number, outerIndex: number) => EventTarget, before: (datum: Datum, index: number, outerIndex: number) => EventTarget): Update<Datum>;

            /**
             * Removes the elements from the DOM. They are in a detached state and may be re-added (though there is currently no dedicated API for doing so).
             */
            remove(): Update<Datum>;

            /**
             * Retrieves the data bound to the first group in this selection.
             */
            data(): Datum[];

            /**
             * Binds data to this selection.
             * @param data the array of data to bind to this selection
             * @param key the optional function to determine the unique key for each piece of data. When unspecified, uses the index of the element.
             */
            data<NewDatum>(data: NewDatum[], key?: (datum: NewDatum, index: number, outerIndex: number) => string): Update<NewDatum>;

            /**
             * Derives data to bind to this selection.
             * @param data the function to derive data. Must return an array.
             * @param key the optional function to determine the unique key for each data item. When unspecified, uses the index of the element.
             */
            data<NewDatum>(data: (datum: Datum, index: number, outerIndex: number) => NewDatum[], key?: (datum: NewDatum, index: number, outerIndex: number) => string): Update<NewDatum>;

            /**
             * Filters the selection, returning only those nodes that match the given CSS selector.
             * @param selector the CSS selector
             */
            filter(selector: string): Update<Datum>;

            /**
             * Filters the selection, returning only those nodes for which the given function returned true.
             * @param selector the filter function
             */
            filter(selector: (datum: Datum, index: number, outerIndex: number) => boolean): Update<Datum>;

            /**
             * Return the data item bound to the first element in the selection.
             */
            datum(): Datum;

            /**
             * Derive the data item for each node in the selection. Useful for situations such as the HTML5 'dataset' attribute.
             * @param value the function to compute data for each node
             */
            datum<NewDatum>(value: (datum: Datum, index: number, outerIndex: number) => NewDatum): Update<NewDatum>;

            /**
             * Set the data item for each node in the selection.
             * @param value the constant element to use for each node
             */
            datum<NewDatum>(value: NewDatum): Update<NewDatum>;

            /**
             * Reorders nodes in the selection based on the given comparator. Nodes are re-inserted into the document once sorted.
             * @param comparator the comparison function, which defaults to d3.ascending
             */
            sort(comparator?: (a: Datum, b: Datum) => number): Update<Datum>;

            /**
             * Reorders nodes in the document to match the selection order. More efficient than calling sort() if the selection is already ordered.
             */
            order(): Update<Datum>;

            /**
             * Returns the listener (if any) for the given event.
             * @param type the type of event to load the listener for. May have a namespace (e.g., ".foo") at the end.
             */
            on(type: string): (datum: Datum, index: number, outerIndex: number) => any;

            /**
             * Adds a listener for the specified event. If one was already registered, it is removed before the new listener is added. The return value of the listener function is ignored.
             * @param type the of event to listen to. May have a namespace (e.g., ".foo") at the end.
             * @param listener an event listener function, or null to unregister
             * @param capture sets the DOM useCapture flag
             */
            on(type: string, listener: (datum: Datum, index: number, outerIndex: number) => any, capture?: boolean): Update<Datum>;

            /**
             * Begins a new transition. Interrupts any active transitions of the same name.
             * @param name the transition name (defaults to "")
             */
            transition(name?: string): Transition<Datum>;

            /**
             * Interrupts the active transition of the provided name. Does not cancel scheduled transitions.
             * @param name the transition name (defaults to "")
             */
            interrupt(name?: string): Update<Datum>;

            /**
             * Creates a subselection by finding the first descendent matching the selector string. Bound data is inherited.
             * @param selector the CSS selector to match against
             */
            select(selector: string): Update<Datum>;

            /**
             * Creates a subselection by using a function to find descendent elements. Bound data is inherited.
             * @param selector the function to find matching descendants
             */
            select(selector: (datum: Datum, index: number, outerIndex: number) => EventTarget): Update<Datum>;

            /**
             * Creates a subselection by finding all descendents that match the given selector. Bound data is not inherited.
             * @param selector the CSS selector to match against
             */
            selectAll(selector: string): Update<Datum>;

            /**
             * Creates a subselection by using a function to find descendent elements. Bound data is not inherited.
             * @param selector the function to find matching descendents
             */
            selectAll(selector: (datum: Datum, index: number, outerIndex: number) => Array<EventTarget> | NodeList): Update<any>;

            /**
             * Invoke the given function for each element in the selection. The return value of the function is ignored.
             * @param func the function to invoke
             */
            each(func: (datum: Datum, index: number, outerIndex: number) => any): Update<Datum>;

            /**
             * Call a function on the selection. sel.call(foo) is equivalent to foo(sel).
             * @param func the function to call on the selection
             * @param args any optional args
             */
            call(func: (sel: Update<Datum>, ...args: any[]) => any, ...args: any[]): Update<Datum>;

            /**
             * Returns true if the current selection is empty.
             */
            empty(): boolean;

            /**
             * Returns the first non-null element in the selection, or null otherwise.
             */
            node(): Node;

            /**
             * Returns the total number of elements in the selection.
             */
            size(): number;

            /**
             * Returns the placeholder nodes for each data element for which no corresponding DOM element was found.
             */
            enter(): Enter<Datum>;

            /**
             * Returns a selection for those DOM nodes for which no new data element was found.
             */
            exit(): Selection<Datum>;
        }

        interface Enter<Datum> {
            append(name: string): Selection<Datum>;
            append(name: (datum: Datum, index: number, outerIndex: number) => EventTarget): Selection<Datum>;

            insert(name: string, before?: string): Selection<Datum>;
            insert(name: string, before: (datum: Datum, index: number, outerIndex: number) => EventTarget): Selection<Datum>;
            insert(name: (datum: Datum, index: number, outerIndex: number) => EventTarget, before?: string): Selection<Datum>;
            insert(name: (datum: Datum, index: number, outerIndex: number) => EventTarget, before: (datum: Datum, index: number, outerIndex: number) => EventTarget): Selection<Datum>;

            select(name: (datum: Datum, index: number, outerIndex: number) => EventTarget): Selection<Datum>;
            call(func: (selection: Enter<Datum>, ...args: any[]) => any, ...args: any[]): Enter<Datum>;

            empty(): boolean;
            size(): number;
        }
    }

    /**
     * Administrivia: JavaScript primitive types, or "things that toString() predictably".
     */
    export type Primitive = number | string | boolean;

    /**
     * Administrivia: anything with a valueOf(): number method is comparable, so we allow it in numeric operations
     */
    interface Numeric {
        valueOf(): number;
    }

    /**
     * A grouped array of nodes.
     * @param Datum the data bound to this selection.
     */
    interface Selection<Datum> {
        /**
         * Retrieve a grouped selection.
         */
        [index: number]: selection.Group;

        /**
         * The number of groups in this selection.
         */
        length: number;

        /**
         * Retrieve the value of the given attribute for the first node in the selection.
         *
         * @param name The attribute name to query. May be prefixed (see d3.ns.prefix).
         */
        attr(name: string): string;

        /**
         * For all nodes, set the attribute to the specified constant value. Use null to remove.
         *
         * @param name The attribute name, optionally prefixed.
         * @param value The attribute value to use. Note that this is coerced to a string automatically.
         */
        attr(name: string, value: Primitive): Selection<Datum>;

        /**
         * Derive an attribute value for each node in the selection based on bound data.
         *
         * @param name The attribute name, optionally prefixed.
         * @param value The function of the datum (the bound data item), index (the position in the subgrouping), and outer index (overall position in nested selections) which computes the attribute value. If the function returns null, the attribute is removed.
         */
        attr(name: string, value: (datum: Datum, index: number, outerIndex: number) => Primitive): Selection<Datum>;

        /**
         * Set multiple properties at once using an Object. D3 iterates over all enumerable properties and either sets or computes the attribute's value based on the corresponding entry in the Object.
         *
         * @param obj A key-value mapping corresponding to attributes and values. If the value is a simple string or number, it is taken as a constant. Otherwise, it is a function that derives the attribute value.
         */
        attr(obj: { [key: string]: Primitive | ((datum: Datum, index: number, outerIndex: number) => Primitive) }): Selection<Datum>;

        /**
         * Returns true if the first node in this selection has the given class list. If multiple classes are specified (i.e., "foo bar"), then returns true only if all classes match.
         *
         * @param name The class list to query.
         */
        classed(name: string): boolean;

        /**
         * Adds (or removes) the given class list.
         *
         * @param name The class list to toggle. Spaces separate class names: "foo bar" is a list of two classes.
         * @param value If true, add the classes. If false, remove them.
         */
        classed(name: string, value: boolean): Selection<Datum>;

        /**
         * Determine if the given class list should be toggled for each node in the selection.
         *
         * @param name The class list. Spaces separate multiple class names.
         * @param value The function to run for each node. Should return true to add the class to the node, or false to remove it.
         */
        classed(name: string, value: (datum: Datum, index: number, outerIndex: number) => boolean): Selection<Datum>;

        /**
         * Set or derive classes for multiple class lists at once.
         *
         * @param obj An Object mapping class lists to values that are either plain booleans or functions that return booleans.
         */
        classed(obj: { [key: string]: boolean | ((datum: Datum, index: number, outerIndex: number) => boolean) }): Selection<Datum>;

        /**
         * Retrieve the computed style value for the first node in the selection.
         * @param name The CSS property name to query
         */
        style(name: string): string;

        /**
         * Set a style property for all nodes in the selection.
         * @param name the CSS property name
         * @param value the property value
         * @param priority if specified, either null or the string "important" (no exclamation mark)
         */
        style(name: string, value: Primitive, priority?: string): Selection<Datum>;

        /**
         * Derive a property value for each node in the selection.
         * @param name the CSS property name
         * @param value the function to derive the value
         * @param priority if specified, either null or the string "important" (no exclamation mark)
         */
        style(name: string, value: (datum: Datum, index: number, outerIndex: number) => Primitive, priority?: string): Selection<Datum>;

        /**
         * Set a large number of CSS properties from an object.
         *
         * @param obj an Object whose keys correspond to CSS property names and values are either constants or functions that derive property values
         * @param priority if specified, either null or the string "important" (no exclamation mark)
         */
        style(obj: { [key: string]: Primitive | ((datum: Datum, index: number, outerIndex: number) => Primitive) }, priority?: string): Selection<Datum>;

        /**
         * Retrieve an arbitrary node property such as the 'checked' property of checkboxes, or the 'value' of text boxes.
         *
         * @param name the node's property to retrieve
         */
        property(name: string): any;

        /**
         * For each node, set the property value. Internally, this sets the node property directly (e.g., node[name] = value), so take care not to mutate special properties like __proto__.
         *
         * @param name the property name
         * @param value the property value
         */
        property(name: string, value: any): Selection<Datum>;

        /**
         * For each node, derive the property value. Internally, this sets the node property directly (e.g., node[name] = value), so take care not to mutate special properties like __proto__.
         *
         * @param name the property name
         * @param value the function used to derive the property's value
         */
        property(name: string, value: (datum: Datum, index: number, outerIndex: number) => any): Selection<Datum>;

        /**
         * Set multiple node properties. Caveats apply: take care not to mutate special properties like __proto__.
         *
         * @param obj an Object whose keys correspond to node properties and values are either constants or functions that will compute a value.
         */
        property(obj: { [key: string]: any | ((datum: Datum, index: number, innerInder: number) => any) }): Selection<Datum>;

        /**
         * Retrieve the textContent of the first node in the selection.
         */
        text(): string;

        /**
         * Set the textContent of each node in the selection.
         * @param value the text to use for all nodes
         */
        text(value: Primitive): Selection<Datum>;

        /**
         * Compute the textContent of each node in the selection.
         * @param value the function which will compute the text
         */
        text(value: (datum: Datum, index: number, outerIndex: number) => Primitive): Selection<Datum>;

        /**
         * Retrieve the HTML content of the first node in the selection. Uses 'innerHTML' internally and will not work with SVG or other elements without a polyfill.
         */
        html(): string;

        /**
         * Set the HTML content of every node in the selection. Uses 'innerHTML' internally and thus will not work with SVG or other elements without a polyfill.
         * @param value the HTML content to use.
         */
        html(value: string): Selection<Datum>;

        /**
         * Compute the HTML content for each node in the selection. Uses 'innerHTML' internally and thus will not work with SVG or other elements without a polyfill.
         * @param value the function to compute HTML content
         */
        html(value: (datum: Datum, index: number, outerIndex: number) => string): Selection<Datum>;

        /**
         * Appends a new child to each node in the selection. This child will inherit the parent's data (if available). Returns a fresh selection consisting of the newly-appended children.
         *
         * @param name the element name to append. May be prefixed (see d3.ns.prefix).
         */
        append(name: string): Selection<Datum>;

        /**
         * Appends a new child to each node in the selection by computing a new node. This child will inherit the parent's data (if available). Returns a fresh selection consisting of the newly-appended children.
         *
         * @param name the function to compute a new element
         */
        append(name: (datum: Datum, index: number, outerIndex: number) => EventTarget): Selection<Datum>;

        /**
         * Inserts a new child to each node in the selection. This child will inherit its parent's data (if available). Returns a fresh selection consisting of the newly-inserted children.
         * @param name the element name to append. May be prefixed (see d3.ns.prefix).
         * @param before the selector to determine position (e.g., ":first-child")
         */
        insert(name: string, before: string): Selection<Datum>;

        /**
         * Inserts a new child to each node in the selection. This child will inherit its parent's data (if available). Returns a fresh selection consisting of the newly-inserted children.
         * @param name the element name to append. May be prefixed (see d3.ns.prefix).
         * @param before a function to determine the node to use as the next sibling
         */
        insert(name: string, before: (datum: Datum, index: number, outerIndex: number) => EventTarget): Selection<Datum>;

        /**
         * Inserts a new child to the end of each node in the selection by computing a new node. This child will inherit its parent's data (if available). Returns a fresh selection consisting of the newly-inserted children.
         * @param name the function to compute a new child
         * @param before the selector to determine position (e.g., ":first-child")
         */
        insert(name: (datum: Datum, index: number, outerIndex: number) => EventTarget, before: string): Selection<Datum>;

        /**
         * Inserts a new child to the end of each node in the selection by computing a new node. This child will inherit its parent's data (if available). Returns a fresh selection consisting of the newly-inserted children.
         * @param name the function to compute a new child
         * @param before a function to determine the node to use as the next sibling
         */
        insert(name: (datum: Datum, index: number, outerIndex: number) => EventTarget, before: (datum: Datum, index: number, outerIndex: number) => EventTarget): Selection<Datum>;

        /**
         * Removes the elements from the DOM. They are in a detached state and may be re-added (though there is currently no dedicated API for doing so).
         */
        remove(): Selection<Datum>;

        /**
         * Retrieves the data bound to the first group in this selection.
         */
        data(): Datum[];

        /**
         * Binds data to this selection.
         * @param data the array of data to bind to this selection
         * @param key the optional function to determine the unique key for each piece of data. When unspecified, uses the index of the element.
         */
        data<NewDatum>(data: NewDatum[], key?: (datum: NewDatum, index: number, outerIndex: number) => string): selection.Update<NewDatum>;

        /**
         * Derives data to bind to this selection.
         * @param data the function to derive data. Must return an array.
         * @param key the optional function to determine the unique key for each data item. When unspecified, uses the index of the element.
         */
        data<NewDatum>(data: (datum: Datum, index: number, outerIndex: number) => NewDatum[], key?: (datum: NewDatum, index: number, outerIndex: number) => string): selection.Update<NewDatum>;

        /**
         * Filters the selection, returning only those nodes that match the given CSS selector.
         * @param selector the CSS selector
         */
        filter(selector: string): Selection<Datum>;

        /**
         * Filters the selection, returning only those nodes for which the given function returned true.
         * @param selector the filter function
         */
        filter(selector: (datum: Datum, index: number, outerIndex: number) => boolean): Selection<Datum>;

        /**
         * Return the data item bound to the first element in the selection.
         */
        datum(): Datum;

        /**
         * Derive the data item for each node in the selection. Useful for situations such as the HTML5 'dataset' attribute.
         * @param value the function to compute data for each node
         */
        datum<NewDatum>(value: (datum: Datum, index: number, outerIndex: number) => NewDatum): Selection<NewDatum>;

        /**
         * Set the data item for each node in the selection.
         * @param value the constant element to use for each node
         */
        datum<NewDatum>(value: NewDatum): Selection<NewDatum>;

        /**
         * Reorders nodes in the selection based on the given comparator. Nodes are re-inserted into the document once sorted.
         * @param comparator the comparison function, which defaults to d3.ascending
         */
        sort(comparator?: (a: Datum, b: Datum) => number): Selection<Datum>;

        /**
         * Reorders nodes in the document to match the selection order. More efficient than calling sort() if the selection is already ordered.
         */
        order(): Selection<Datum>;

        /**
         * Returns the listener (if any) for the given event.
         * @param type the type of event to load the listener for. May have a namespace (e.g., ".foo") at the end.
         */
        on(type: string): (datum: Datum, index: number, outerIndex: number) => any;

        /**
         * Adds a listener for the specified event. If one was already registered, it is removed before the new listener is added. The return value of the listener function is ignored.
         * @param type the of event to listen to. May have a namespace (e.g., ".foo") at the end.
         * @param listener an event listener function, or null to unregister
         * @param capture sets the DOM useCapture flag
         */
        on(type: string, listener: (datum: Datum, index: number, outerIndex: number) => any, capture?: boolean): Selection<Datum>;

        /**
         * Begins a new transition. Interrupts any active transitions of the same name.
         * @param name the transition name (defaults to "")
         */
        transition(name?: string): Transition<Datum>;

        /**
         * Interrupts the active transition of the provided name. Does not cancel scheduled transitions.
         * @param name the transition name (defaults to "")
         */
        interrupt(name?: string): Selection<Datum>;

        /**
         * Creates a subselection by finding the first descendent matching the selector string. Bound data is inherited.
         * @param selector the CSS selector to match against
         */
        select(selector: string): Selection<Datum>;

        /**
         * Creates a subselection by using a function to find descendent elements. Bound data is inherited.
         * @param selector the function to find matching descendants
         */
        select(selector: (datum: Datum, index: number, outerIndex: number) => EventTarget): Selection<Datum>;

        /**
         * Creates a subselection by finding all descendents that match the given selector. Bound data is not inherited.
         * @param selector the CSS selector to match against
         */
        selectAll(selector: string): Selection<any>;

        /**
         * Creates a subselection by finding all descendants that match the given selector. Bound data is not inherited.
         *
         * Use this overload when data-binding a subselection (that is, sel.selectAll('.foo').data(d => ...)). The type will carry over.
         */
        selectAll<T>(selector: string): Selection<T>;

        /**
         * Creates a subselection by using a function to find descendent elements. Bound data is not inherited.
         * @param selector the function to find matching descendents
         */
        selectAll(selector: (datum: Datum, index: number, outerIndex: number) => Array<EventTarget> | NodeList): Selection<any>;

        /**
         * Creates a subselection by using a function to find descendent elements. Bound data is not inherited.
         *
         * Use this overload when data-binding a subselection (that is, sel.selectAll('.foo').data(d => ...)). The type will carry over.
         * @param selector the function to find matching descendents
         */
        selectAll<T>(selector: (datum: Datum, index: number, outerIndex: number) => Array<EventTarget> | NodeList): Selection<T>;

        /**
         * Invoke the given function for each element in the selection. The return value of the function is ignored.
         * @param func the function to invoke
         */
        each(func: (datum: Datum, index: number, outerIndex: number) => any): Selection<Datum>;

        /**
         * Call a function on the selection. sel.call(foo) is equivalent to foo(sel).
         * @param func the function to call on the selection
         * @param args any optional args
         */
        call(func: (sel: Selection<Datum>, ...args: any[]) => any, ...args: any[]): Selection<Datum>;

        /**
         * Returns true if the current selection is empty.
         */
        empty(): boolean;

        /**
         * Returns the first non-null element in the selection, or null otherwise.
         */
        node(): Node;

        /**
         * Returns the total number of elements in the selection.
         */
        size(): number;
    }

    export function transition(): Transition<any>;
    namespace transition {
        export var prototype: Transition<any>;
    }

    interface Transition<Datum> {

        transition(): Transition<Datum>;

        delay(): number;
        delay(delay: number): Transition<Datum>;
        delay(delay: (datum: Datum, index: number, outerIndex: number) => number): Transition<Datum>;

        duration(): number;
        duration(duration: number): Transition<Datum>;
        duration(duration: (datum: Datum, index: number, outerIndex: number) => number): Transition<Datum>;

        ease(): (t: number) => number;
        ease(value: string, ...args: any[]): Transition<Datum>;
        ease(value: (t: number) => number): Transition<Datum>;

        attr(name: string, value: Primitive): Transition<Datum>;
        attr(name: string, value: (datum: Datum, index: number, outerIndex: number) => Primitive): Transition<Datum>;
        attr(obj: { [key: string]: Primitive | ((datum: Datum, index: number, outerIndex: number) => Primitive) }): Transition<Datum>;

        attrTween(name: string, tween: (datum: Datum, index: number, attr: string) => (t: number) => Primitive): Transition<Datum>;

        style(name: string, value: Primitive, priority?: string): Transition<Datum>;
        style(name: string, value: (datum: Datum, index: number, outerIndex: number) => Primitive, priority?: string): Transition<Datum>;
        style(obj: { [key: string]: Primitive | ((datum: Datum, index: number, outerIndex: number) => Primitive) }, priority?: string): Transition<Datum>;

        styleTween(name: string, tween: (datum: Datum, index: number, attr: string) => (t: number) => Primitive, priority?: string): Transition<Datum>;

        text(value: Primitive): Transition<Datum>;
        text(value: (datum: Datum, index: number, outerIndex: number) => Primitive): Transition<Datum>;

        tween(name: string, factory: () => (t: number) => any): Transition<Datum>;

        remove(): Transition<Datum>;

        select(selector: string): Transition<Datum>;
        select(selector: (d: Datum, i: number) => EventTarget): Transition<Datum>;

        selectAll(selector: string): Transition<any>;
        selectAll(selector: (d: Datum, i: number) => EventTarget[]): Transition<any>;

        filter(selector: string): Transition<Datum>;
        filter(selector: (d: Datum, i: number) => boolean): Transition<Datum>;

        each(type: string, listener: (d: Datum, i: number) => any): Transition<Datum>;
        each(listener: (d: Datum, i: number) => any): Transition<Datum>;

        call(func: (transition: Transition<Datum>, ...args: any[]) => any, ...args: any[]): Transition<Datum>;

        empty(): boolean;
        node(): Node;
        size(): number;
    }

    export function ease(type: 'linear'): (t: number) => number;
    export function ease(type: 'linear-in'): (t: number) => number;
    export function ease(type: 'linear-out'): (t: number) => number;
    export function ease(type: 'linear-in-out'): (t: number) => number;
    export function ease(type: 'linear-out-in'): (t: number) => number;

    export function ease(type: 'poly', k: number): (t: number) => number;
    export function ease(type: 'poly-in', k: number): (t: number) => number;
    export function ease(type: 'poly-out', k: number): (t: number) => number;
    export function ease(type: 'poly-in-out', k: number): (t: number) => number;
    export function ease(type: 'poly-out-in', k: number): (t: number) => number;

    export function ease(type: 'quad'): (t: number) => number;
    export function ease(type: 'quad-in'): (t: number) => number;
    export function ease(type: 'quad-out'): (t: number) => number;
    export function ease(type: 'quad-in-out'): (t: number) => number;
    export function ease(type: 'quad-out-in'): (t: number) => number;

    export function ease(type: 'cubic'): (t: number) => number;
    export function ease(type: 'cubic-in'): (t: number) => number;
    export function ease(type: 'cubic-out'): (t: number) => number;
    export function ease(type: 'cubic-in-out'): (t: number) => number;
    export function ease(type: 'cubic-out-in'): (t: number) => number;

    export function ease(type: 'sin'): (t: number) => number;
    export function ease(type: 'sin-in'): (t: number) => number;
    export function ease(type: 'sin-out'): (t: number) => number;
    export function ease(type: 'sin-in-out'): (t: number) => number;
    export function ease(type: 'sin-out-in'): (t: number) => number;

    export function ease(type: 'circle'): (t: number) => number;
    export function ease(type: 'circle-in'): (t: number) => number;
    export function ease(type: 'circle-out'): (t: number) => number;
    export function ease(type: 'circle-in-out'): (t: number) => number;
    export function ease(type: 'circle-out-in'): (t: number) => number;

    export function ease(type: 'elastic', a?: number, b?: number): (t: number) => number;
    export function ease(type: 'elastic-in', a?: number, b?: number): (t: number) => number;
    export function ease(type: 'elastic-out', a?: number, b?: number): (t: number) => number;
    export function ease(type: 'elastic-in-out', a?: number, b?: number): (t: number) => number;
    export function ease(type: 'elastic-out-in', a?: number, b?: number): (t: number) => number;

    export function ease(type: 'back', s: number): (t: number) => number;
    export function ease(type: 'back-in', s: number): (t: number) => number;
    export function ease(type: 'back-out', s: number): (t: number) => number;
    export function ease(type: 'back-in-out', s: number): (t: number) => number;
    export function ease(type: 'back-out-in', s: number): (t: number) => number;

    export function ease(type: 'bounce'): (t: number) => number;
    export function ease(type: 'bounce-in'): (t: number) => number;
    export function ease(type: 'bounce-out'): (t: number) => number;
    export function ease(type: 'bounce-in-out'): (t: number) => number;
    export function ease(type: 'bounce-out-in'): (t: number) => number;

    export function ease(type: string, ...args: any[]): (t: number) => number;

    export function timer(func: () => any, delay?: number, time?: number): void;

    namespace timer {
        export function flush(): void;
    }

	 interface BaseEvent {
		 type: string;
		 sourceEvent?: Event;
	 }

	 /**
	  * Define a D3-specific ZoomEvent per https://github.com/mbostock/d3/wiki/Zoom-Behavior#event
	  */
	 interface ZoomEvent extends BaseEvent {
		 scale: number;
		 translate: [number, number];
	 }

	 /**
	  * Define a D3-specific DragEvent per https://github.com/mbostock/d3/wiki/Drag-Behavior#on
	  */
	 interface DragEvent extends BaseEvent {
		 x: number;
		 y: number;
		 dx: number;
		 dy: number;
	 }

    /**
     * The current event's value. Use this variable in a handler registered with `selection.on`.
     */
    export var event: Event | BaseEvent;

    /**
     * Returns the x and y coordinates of the mouse relative to the provided container element, using d3.event for the mouse's position on the page.
     * @param container the container element (e.g. an SVG <g> element)
     */
    export function mouse(container: EventTarget): [number, number];

    /**
     * Given a container element and a touch identifier, determine the x and y coordinates of the touch.
     * @param container the container element (e.g., an SVG <svg> element)
     * @param identifier the given touch identifier
     */
    export function touch(container: EventTarget, identifer: number): [number, number];

    /**
     * Given a container element, a list of touches, and a touch identifier, determine the x and y coordinates of the touch.
     * @param container the container element (e.g., an SVG <svg> element)
     * @param identifier the given touch identifier
     */
    export function touch(container: EventTarget, touches: TouchList, identifer: number): [number, number];

    /**
     * Given a container element and an optional list of touches, return the position of every touch relative to the container.
     * @param container the container element
     * @param touches an optional list of touches (defaults to d3.event.touches)
     */
    export function touches(container: EventTarget, touches?: TouchList): Array<[number, number]>;

    // NB. this is limited to primitive values due to D3's use of the <, >, and >= operators. Results get weird for object instances.
    /**
     * Compares two primitive values for sorting (in ascending order).
     */
    export function ascending(a: Primitive, b: Primitive): number;

    /**
     * Compares two primitive values for sorting (in ascending order).
     */
    export function descending(a: Primitive, b: Primitive): number;

    /**
     * Return the minimum value in the array using natural order.
     */
    export function min(array: number[]): number;

    /**
     * Return the minimum value in the array using natural order.
     */
    export function min(array: string[]): string;

    /**
     * Return the minimum value in the array using natural order.
     */
    export function min<T extends Numeric>(array: T[]): T;

    /**
     * Return the minimum value in the array using natural order.
     */
    export function min<T>(array: T[], accessor: (datum: T, index: number) => number): number;

    /**
     * Return the minimum value in the array using natural order.
     */
    export function min<T>(array: T[], accessor: (datum: T, index: number) => string): string;

    /**
     * Return the minimum value in the array using natural order.
     */
    export function min<T, U extends Numeric>(array: T[], accessor: (datum: T, index: number) => U): U;

    /**
     * Return the maximum value in the array of numbers using natural order.
     */
    export function max(array: number[]): number;

    /**
     * Return the maximum value in the array of strings using natural order.
     */
    export function max(array: string[]): string;

    /**
     * Return the maximum value in the array of numbers using natural order.
     */
    export function max<T extends Numeric>(array: T[]): T;

    /**
     * Return the maximum value in the array using natural order and a projection function to map values to numbers.
     */
    export function max<T>(array: T[], accessor: (datum: T, index: number) => number): number;

    /**
     * Return the maximum value in the array using natural order and a projection function to map values to strings.
     */
    export function max<T>(array: T[], accessor: (datum: T, index: number) => string): string;

    /**
     * Return the maximum value in the array using natural order and a projection function to map values to easily-sorted values.
     */
    export function max<T, U extends Numeric>(array: T[], accessor: (datum: T, index: number) => U): U;

    /**
     * Return the min and max simultaneously.
     */
    export function extent(array: number[]): [number, number];

    /**
     * Return the min and max simultaneously.
     */
    export function extent(array: string[]): [string, string];

    /**
     * Return the min and max simultaneously.
     */
    export function extent<T extends Numeric>(array: T[]): [T, T];

    /**
     * Return the min and max simultaneously.
     */
    export function extent<T extends Numeric>(array: Array<T | Primitive>): [T | Primitive, T | Primitive];

    /**
     * Return the min and max simultaneously.
     */
    export function extent<T>(array: T[], accessor: (datum: T, index: number) => number): [number, number];

    /**
     * Return the min and max simultaneously.
     */
    export function extent<T>(array: T[], accessor: (datum: T, index: number) => string): [string, string];

    /**
     * Return the min and max simultaneously.
     */
    export function extent<T>(array: T[], accessor: (datum: T, index: number) => Date): [Date, Date];

    /**
     * Return the min and max simultaneously.
     */
    export function extent<T, U extends Numeric>(array: T[], accessor: (datum: T, index: number) => U): [U | Primitive, U | Primitive];

    /**
     * Compute the sum of an array of numbers.
     */
    export function sum(array: number[]): number;

    /**
     * Compute the sum of an array, using the given accessor to convert values to numbers.
     */
    export function sum<T>(array: T[], accessor: (datum: T, index: number) => number): number;

    export function mean(array: number[]): number;
    export function mean<T>(array: T[], accessor: (datum: T, index: number) => number): number;

    /**
     * Compute the median of an array of numbers (the 0.5-quantile).
     */
    export function median(array: number[]): number;
    export function median<T>(datum: T[], accessor: (datum: T, index: number) => number): number;

    export function quantile(array: number[], p: number): number;

    export function variance(array: number[]): number;
    export function variance<T>(array: T[], accessor: (datum: T, index: number) => number): number;

    export function deviation(array: number[]): number;
    export function deviation<T>(array: T[], accessor: (datum: T, index: number) => number): number;

    export function bisectLeft<T>(array: T[], x: T, lo?: number, hi?: number): number;

    export var bisect: typeof bisectRight;

    export function bisectRight<T>(array: T[], x: T, lo?: number, hi?: number): number;

    export function bisector<T, U>(accessor: (x: T) => U): {
        left: (array: T[], x: U, lo?: number, hi?: number) => number;
        right: (array: T[], x: U, lo?: number, hi?: number) => number;
    }

    export function bisector<T, U>(comparator: (a: T, b: U) => number): {
        left: (array: T[], x: U, lo?: number, hi?: number) => number;
        right: (array: T[], x: U, lo?: number, hi?: number) => number;
    }

    export function shuffle<T>(array: T[], lo?: number, hi?: number): T[];

    /**
     * Returns the enumerable property names of the specified object.
     * @param object a JavaScript object
     */
    export function keys(object: Object): string[];

    /**
     * Returns an array containing the property values of the specified object.
     */
    export function values<T>(object: { [key: string]: T }): T[];
    /**
     * Returns an array containing the property values of the specified object.
     */
    export function values<T>(object: { [key: number]: T }): T[];
    /**
     * Returns an array containing the property values of the specified object.
     */
    export function values(object: Object): any[];

    /**
     * Returns an array of key-value pairs containing the property values of the specified object.
     */
    export function entries<T>(object: { [key: string]: T }): { key: string; value: T }[];

    /**
     * Returns an array of key-value pairs containing the property values of the specified object.
     */
    export function entries<T>(object: { [key: number]: T }): { key: string; value: T }[];

    /**
     * Returns an array of key-value pairs containing the property values of the specified object.
     */
    export function entries(object: Object): { key: string; value: any }[];

    /**
     * A shim for ES6 maps. The implementation uses a JavaScript object internally, and thus keys are limited to strings.
     */
    interface Map<T> {
        /**
         * Does the map contain the given key?
         */
        has(key: string): boolean;

        /**
         * Retrieve the value for the given key. Returns undefined if there is no value stored.
         */
        get(key: string): T;

        /**
         * Set the value for the given key. Returns the new value.
         */
        set(key: string, value: T): T;

        /**
         * Remove the value for the given key. Returns true if there was a value and false otherwise.
         */
        remove(key: string): boolean;

        /**
         * Returns an array of all keys in arbitrary order.
         */
        keys(): string[];

        /**
         * Returns an array of all values in arbitrary order.
         */
        values(): T[];

        /**
         * Returns an array of key-value objects in arbitrary order.
         */
        entries(): { key: string; value: T }[];

        /**
         * Calls the function for each key and value pair in the map. The 'this' context is the map itself.
         */
        forEach(func: (key: string, value: T) => any): void;

        /**
         * Is this map empty?
         */
        empty(): boolean;

        /**
         * Returns the number of elements stored in the map.
         */
        size(): number;
    }

    /**
     * Constructs an initially empty map.
     */
    export function map<T>(): Map<T>;

    /**
     * Construct a new map by copying keys and values from the given one.
     */
    export function map<T>(object: Map<T>): Map<T>;

    /**
     * Construct a new map by copying enumerable properties and values from the given object.
     */
    export function map<T>(object: { [key: string]: T }): Map<T>;

    /**
     * Construct a new map by copying enumerable properties and values from the given object.
     */
    export function map<T>(object: { [key: number]: T }): Map<T>;

    /**
     * Construct a new map by copying elements from the array. The key function is used to identify each object.
     */
    export function map<T>(array: T[], key: (datum: T, index: number) => string): Map<T>;

    /**
     * Construct a new map by copying enumerable properties and values from the given object.
     */
    export function map(object: Object): Map<any>;

    /**
     * A shim for ES6 sets. Is only able to store strings.
     */
    interface Set {
        /**
         * Is the given string stored in this set?
         */
        has(value: string): boolean;

        /**
         * Add the string to this set. Returns the value.
         */
        add(value: string): string;

        /**
         * Remove the given value from the set. Returns true if it was stored, and false otherwise.
         */
        remove(value: string): boolean;

        /**
         * Returns an array of the strings stored in this set.
         */
        values(): string[];

        /**
         * Calls a given function for each value in the set. The return value of the function is ignored. The this context of the function is the set itself.
         */
        forEach(func: (value: string) => any): void;

        /**
         * Is this set empty?
         */
        empty(): boolean;

        /**
         * Returns the number of values stored in this set.
         */
        size(): number;
    }

    /**
     * Creates an initially-empty set.
     */
    export function set(): Set;

    /**
     * Initializes a set from the given array of strings.
     */
    export function set(array: string[]): Set;

    /**
     * Merges the specified arrays into a single array.
     */
    export function merge<T>(arrays: T[][]): T[];

    /**
     * Generates a 0-based numeric sequence. The output range does not include 'stop'.
     */
    export function range(stop: number): number[];

    /**
     * Generates a numeric sequence starting from the given start and stop values. 'step' defaults to 1. The output range does not include 'stop'.
     */
    export function range(start: number, stop: number, step?: number): number[];

    /**
     * Given the specified array, return an array corresponding to the list of indices in 'keys'.
     */
    export function permute<T>(array: { [key: number]: T }, keys: number[]): T[];

    /**
     * Given the specified object, return an array corresponding to the list of property names in 'keys'.
     */
    export function permute<T>(object: { [key: string]: T }, keys: string[]): T[];

    // TODO construct n-tuples from n input arrays
    export function zip<T>(...arrays: T[][]): T[][];

    export function transpose<T>(matrix: T[][]): T[][];

    /**
     * For each adjacent pair of elements in the specified array, returns a new array of tuples of elements i and i - 1.
     * Returns the empty array if the input array has fewer than two elements.
     */
    export function pairs<T>(array: T[]): Array<[T, T]>;

    interface Nest<T> {
        key(func: (datum: T) => string): Nest<T>;
        sortKeys(comparator: (a: string, b: string) => number): Nest<T>;
        sortValues(comparator: (a: T, b: T) => number): Nest<T>;
        rollup<U>(func: (values: T[]) => U): Nest<T>;
        map(array: T[]): { [key: string]: any };
        map(array: T[], mapType: typeof d3.map): Map<any>;
        entries(array: T[]): { key: string; values: any }[];
    }

    export function nest<T>(): Nest<T>;

    export module random {
        export function normal(mean?: number, deviation?: number): () => number;
        export function logNormal(mean?: number, deviation?: number): () => number;
        export function bates(count: number): () => number;
        export function irwinHall(count: number): () => number;
    }

    interface Transform {
        rotate: number;
        translate: [number, number];
        skew: number;
        scale: [number, number];
        toString(): string;
    }

    export function transform(transform: string): Transform;

    export function format(specifier: string): (n: number) => string;

    interface FormatPrefix {
        symbol: string;
        scale(n: number): number;
    }

    export function formatPrefix(value: number, precision?: number): FormatPrefix;

    export function round(x: number, n?: number): number;

    export function requote(string: string): string;

    export var rgb: {
        new (r: number, g: number, b: number): Rgb;
        new (color: string): Rgb;

        (r: number, g: number, b: number): Rgb;
        (color: string): Rgb;
    };

    interface Rgb extends Color {
        r: number;
        g: number;
        b: number;

        brighter(k?: number): Rgb;
        darker(k?: number): Rgb;

        hsl(): Hsl;

        toString(): string;
    }

    export var hsl: {
        new (h: number, s: number, l: number): Hsl;
        new (color: string): Hsl;

        (h: number, s: number, l: number): Hsl;
        (color: string): Hsl;
    };

    interface Hsl extends Color {
        h: number;
        s: number;
        l: number;

        brighter(k?: number): Hsl;
        darker(k?: number): Hsl;

        rgb(): Rgb;

        toString(): string;
    }

    export var hcl: {
        new (h: number, c: number, l: number): Hcl;
        new (color: string): Hcl;

        (h: number, c: number, l: number): Hcl;
        (color: string): Hcl;
    };

    interface Hcl extends Color {
        h: number;
        c: number;
        l: number;

        brighter(k?: number): Hcl;
        darker(k?: number): Hcl;
    }

    export var lab: {
        new (l: number, a: number, b: number): Lab;
        new (color: string): Lab;

        (l: number, a: number, b: number): Lab;
        (color: string): Lab;
    }

    interface Lab extends Color {
        l: number;
        a: number;
        b: number;

        brighter(k?: number): Lab;
        darker(k?: number): Lab;

        rgb(): Rgb;
        toString(): string;
    }

    export var color: {
        (): Color;
        new (): Color;
    };

    interface Color {
        rgb(): Rgb;
    }

    export module ns {
        interface Qualified {
            space: string;
            local: string;
        }

        export var prefix: { [key: string]: string };
        export function qualify(name: string): Qualified | string;
    }

    export function functor<T extends Function>(value: T): T;
    export function functor<T>(value: T): () => T;

    export function rebind(target: {}, source: {}, ...names: string[]): any;

    export function dispatch(...names: string[]): Dispatch;

    interface Dispatch {
        on(type: string): (...args: any[]) => void;
        on(type: string, listener: (...args: any[]) => any): Dispatch;
        [event: string]: (...args: any[]) => void;
    }

    export module scale {
        export function identity(): Identity;

        interface Identity {
            (n: number): number;
            invert(n: number): number;

            domain(): number[];
            domain(numbers: number[]): Identity;

            range(): number[];
            range(numbers: number[]): Identity;

            ticks(count?: number): number[];

            tickFormat(count?: number, format?: string): (n: number) => string;

            copy(): Identity;
        }

        export function linear(): Linear<number, number>;
        export function linear<Output>(): Linear<Output, Output>;
        export function linear<Range, Output>(): Linear<Range, Output>;

        interface Linear<Range, Output> {
            (x: number): Output;
            invert(y: number): number;

            domain(): number[];
            domain(numbers: number[]): Linear<Range, Output>;

            range(): Range[];
            range(values: Range[]): Linear<Range, Output>;

            rangeRound(values: number[]): Linear<number, number>;

            interpolate(): (a: Range, b: Range) => (t: number) => Output;
            interpolate(factory: (a: Range, b: Range) => (t: number) => Output): Linear<Range, Output>;

            clamp(): boolean;
            clamp(clamp: boolean): Linear<Range, Output>;

            nice(count?: number): Linear<Range, Output>;

            ticks(count?: number): number[];

            tickFormat(count?: number, format?: string): (n: number) => string;

            copy(): Linear<Range, Output>;
        }

        export function sqrt(): Pow<number, number>;
        export function sqrt<Output>(): Pow<Output, Output>;
        export function sqrt<Range, Output>(): Pow<Range, Output>;

        export function pow(): Pow<number, number>;
        export function pow<Output>(): Pow<Output, Output>;
        export function pow<Range, Output>(): Pow<Range, Output>;

        interface Pow<Range, Output> {
            (x: number): Output;

            invert(y: number): number;

            domain(): number[];
            domain(numbers: number[]): Pow<Range, Output>;

            range(): Range[];
            range(values: Range[]): Pow<Range, Output>;

            rangeRound(values: number[]): Pow<number, number>;

            exponent(): number;
            exponent(k: number): Pow<Range, Output>;

            interpolate(): (a: Range, b: Range) => (t: number) => Output;
            interpolate(factory: (a: Range, b: Range) => (t: number) => Output): Pow<Range, Output>;

            clamp(): boolean;
            clamp(clamp: boolean): Pow<Range, Output>;

            nice(m?: number): Pow<Range, Output>;

            ticks(count?: number): number[];

            tickFormat(count?: number, format?: string): (n: number) => string;

            copy(): Pow<Range, Output>;
        }

        export function log(): Log<number, number>;
        export function log<Output>(): Log<Output, Output>;
        export function log<Range, Output>(): Log<Range, Output>;

        interface Log<Range, Output> {
            (x: number): Output;

            invert(y: number): number;

            domain(): number[];
            domain(numbers: number[]): Log<Range, Output>;

            range(): Range[];
            range(values: Range[]): Log<Range, Output>;

            rangeRound(values: number[]): Log<number, number>;

            base(): number;
            base(base: number): Log<Range, Output>;

            interpolate(): (a: Range, b: Range) => (t: number) => Output;
            interpolate(factory: (a: Range, b: Range) => (t: number) => Output): Log<Range, Output>;

            clamp(): boolean;
            clamp(clamp: boolean): Log<Range, Output>;

            nice(): Log<Range, Output>;

            ticks(): number[];

            tickFormat(count?: number, format?: string): (t: number) => string;

            copy(): Log<Range, Output>;
        }

        export function quantize<T>(): Quantize<T>;

        interface Quantize<T> {
            (x: number): T;

            invertExtent(y: T): [number, number];

            domain(): number[];
            domain(numbers: number[]): Quantize<T>;

            range(): T[];
            range(values: T[]): Quantize<T>;

            copy(): Quantize<T>;
        }

        export function quantile<T>(): Quantile<T>;

        interface Quantile<T> {
            (x: number): T;

            invertExtent(y: T): [number, number];

            domain(): number[];
            domain(numbers: number[]): Quantile<T>;

            range(): T[];
            range(values: T[]): Quantile<T>;

            quantiles(): number[];

            copy(): Quantile<T>;
        }

        export function threshold<Range>(): Threshold<number, Range>;
        export function threshold<Domain, Range>(): Threshold<Domain, Range>;

        interface Threshold<Domain, Range> {
            (x: number): Range;

            invertExtent(y: Range): [Domain, Domain];

            domain(): Domain[];
            domain(domain: Domain[]): Threshold<Domain, Range>;

            range(): Range[];
            range(values: Range[]): Threshold<Domain, Range>;

            copy(): Threshold<Domain, Range>;
        }

        export function ordinal<Range>(): Ordinal<string, Range>;
        export function ordinal<Domain extends { toString(): string }, Range>(): Ordinal<Domain, Range>;
        export function category10(): Ordinal<string, string>;
        export function category10<Domain extends { toString(): string }>(): Ordinal<Domain, string>;
        export function category20(): Ordinal<string, string>;
        export function category20<Domain extends { toString(): string }>(): Ordinal<Domain, string>;
        export function category20b(): Ordinal<string, string>;
        export function category20b<Domain extends { toString(): string }>(): Ordinal<Domain, string>;
        export function category20c(): Ordinal<string,string>;
        export function category20c<Domain extends { toString(): string }>(): Ordinal<Domain, string>;

        interface Ordinal<Domain extends { toString(): string }, Range> {
            (x: Domain): Range;

            domain(): Domain[];
            domain(values: Domain[]): Ordinal<Domain, Range>;

            range(): Range[];
            range(values: Range[]): Ordinal<Domain, Range>;

            rangePoints(interval: [number, number], padding?: number): Ordinal<Domain, number>;
            rangeRoundPoints(interval: [number, number], padding?: number): Ordinal<Domain, number>;

            rangeBands(interval: [number, number], padding?: number, outerPadding?: number): Ordinal<Domain, number>;
            rangeRoundBands(interval: [number, number], padding?: number, outerPadding?: number): Ordinal<Domain, number>;

            rangeBand(): number;
            rangeExtent(): [number, number];

            copy(): Ordinal<Domain, Range>;
        }
    }

    export function interpolate(a: number, b: number): (t: number) => number;
    export function interpolate(a: string, b: string): (t: number) => string;
    export function interpolate(a: string | Color, b: Color): (t: number) => string;
    export function interpolate(a: Array<string | Color>, b: Color[]): (t: number) => string;
    export function interpolate<Range, Output>(a: Range[], b: Output[]): (t: number) => Output[];
    export function interpolate<Range, Output>(a: Range[], b: Range[]): (t: number) => Output[];
    export function interpolate(a: { [key: string]: string | Color }, b: { [key: string]: Color }): (t: number) => { [key: string]: string };
    export function interpolate<Range, Output>(a: { [key: string]: Range }, b: { [key: string]: Output }): (t: number) => { [key: string]: Output };
    export function interpolate<Range, Output>(a: { [key: string]: Range }, b: { [key: string]: Range }): (t: number) => { [key: string]: Output };

    export function interpolateNumber(a: number, b: number): (t: number) => number;

    export function interpolateRound(a: number, b: number): (t: number) => number;

    export function interpolateString(a: string, b: string): (t: number) => string;

    export function interpolateRgb(a: string | Color, b: string | Color): (t: number) => string;

    export function interpolateHsl(a: string | Color, b: string | Color): (t: number) => string;

    export function interpolateLab(a: string | Color, b: string | Color): (t: number) => string;

    export function interpolateHcl(a: string | Color, b: string | Color): (t: number) => string;

    export function interpolateArray(a: Array<string | Color>, b: Color[]): (t: number) => string[];
    export function interpolateArray<Range, Output>(a: Range[], b: Range[]): (t: number) => Output[];
    export function interpolateArray<Range, Output>(a: Range[], b: Output[]): (t: number) => Output[];

    export function interpolateObject(a: { [key: string]: string | Color }, b: { [key: string]: Color }): (t: number) => { [key: string]: string };
    export function interpolateObject<Range, Output>(a: { [key: string]: Range }, b: { [key: string]: Output }): (t: number) => { [key: string]: Output };
    export function interpolateObject<Range, Output>(a: { [key: string]: Range }, b: { [key: string]: Range }): (t: number) => { [key: string]: Output };

    export function interpolateTransform(a: string | Transform, b: string | Transform): (t: number) => string;

    export function interpolateZoom(a: [number, number, number], b: [number, number, number]): {
        (t: number): [number, number, number];
        duration: number;
    };

    export var interpolators: Array<(a: any, b: any) => (t: number) => any>;

    export module time {
        export var second: Interval;
        export var minute: Interval;
        export var hour: Interval;
        export var day: Interval;
        export var week: Interval;
        export var sunday: Interval;
        export var monday: Interval;
        export var tuesday: Interval;
        export var wednesday: Interval;
        export var thursday: Interval;
        export var friday: Interval;
        export var saturday: Interval;
        export var month: Interval;
        export var year: Interval;

        interface Interval {
            (d: Date): Date;

            floor(d: Date): Date;

            round(d: Date): Date;

            ceil(d: Date): Date;

            range(start: Date, stop: Date, step?: number): Date[];

            offset(date: Date, step: number): Date;

            utc: {
                (d: Date): Date;

                floor(d: Date): Date;

                round(d: Date): Date;

                ceil(d: Date): Date;

                range(start: Date, stop: Date, step?: number): Date[];

                offset(date: Date, step: number): Date;
            }
        }

        export function seconds(start: Date, stop: Date, step?: number): Date[];
        export function minutes(start: Date, stop: Date, step?: number): Date[];
        export function hours(start: Date, stop: Date, step?: number): Date[];
        export function days(start: Date, stop: Date, step?: number): Date[];
        export function weeks(start: Date, stop: Date, step?: number): Date[];
        export function sundays(start: Date, stop: Date, step?: number): Date[];
        export function mondays(start: Date, stop: Date, step?: number): Date[];
        export function tuesdays(start: Date, stop: Date, step?: number): Date[];
        export function wednesdays(start: Date, stop: Date, step?: number): Date[];
        export function thursdays(start: Date, stop: Date, step?: number): Date[];
        export function fridays(start: Date, stop: Date, step?: number): Date[];
        export function saturdays(start: Date, stop: Date, step?: number): Date[];
        export function months(start: Date, stop: Date, step?: number): Date[];
        export function years(start: Date, stop: Date, step?: number): Date[];

        export function dayOfYear(d: Date): number;
        export function weekOfYear(d: Date): number;
        export function sundayOfYear(d: Date): number;
        export function mondayOfYear(d: Date): number;
        export function tuesdayOfYear(d: Date): number;
        export function wednesdayOfYear(d: Date): number;
        export function fridayOfYear(d: Date): number;
        export function saturdayOfYear(d: Date): number;

        export function format(specifier: string): Format;

        export module format {
            export function multi(formats: Array<[string, (d: Date) => boolean|number]>): Format;
            export function utc(specifier: string): Format;
            namespace utc {
                export function multi(formats: Array<[string, (d: Date) => boolean|number]>): Format;
            }

            export var iso: Format;
        }

        interface Format {
            (d: Date): string;
            parse(input: string): Date;
        }

        export function scale(): Scale<number, number>;
        export function scale<Output>(): Scale<Output, Output>;
        export function scale<Range, Output>(): Scale<Range, Output>;

        export module scale {
            export function utc(): Scale<number, number>;
            export function utc<Output>(): Scale<Output, Output>;
            export function utc<Range, Output>(): Scale<Range, Output>;
        }


        interface Scale<Range, Output> {
            (x: Date): Output;

            invert(y: number): Date;

            domain(): Date[];
            domain(dates: number[]): Scale<Range, Output>;
            domain(dates: Date[]): Scale<Range, Output>;

            nice(): Scale<Range, Output>;
            nice(interval: Interval, step?: number): Scale<Range, Output>;

            range(): Range[];
            range(values: Range[]): Scale<Range, Output>;

            rangeRound(values: number[]): Scale<number, number>;

            interpolate(): (a: Range, b: Range) => (t: number) => Output;
            interpolate(factory: (a: Range, b: Range) => (t: number) => Output): Scale<Range, Output>;

            clamp(): boolean;
            clamp(clamp: boolean): Scale<Range, Output>;

            ticks(): Date[];
            ticks(interval: Interval, step?: number): Date[];
            ticks(count: number): Date[];

            tickFormat(count: number): (d: Date) => string;

            copy(): Scale<Range, Output>;
        }
    }

    export module behavior {
        export function drag<Datum>(): Drag<Datum>;

        interface Drag<Datum> {
            (selection: Selection<Datum>): void;

            on(type: string): (d: Datum, i: number) => any;
            on(type: string, listener: (d: Datum, i: number) => any): Drag<Datum>;

            origin(): (d: Datum, i: number) => { x: number; y: number };
            origin(accessor: (d: Datum, i: number) => { x: number; y: number }): Drag<Datum>;
        }

        export function zoom<Datum>(): Zoom<Datum>;

        namespace zoom {
            interface Scale {
                domain(): number[];
                domain(values: number[]): Scale;

                invert(y: number): number;

                range(values: number[]): Scale;
                range(): number[];
            }
        }

        interface Zoom<Datum> {
            (selection: Selection<Datum>): void;

            translate(): [number, number];
            translate(translate: [number, number]): Zoom<Datum>;

            scale(): number;
            scale(scale: number): Zoom<Datum>;

            scaleExtent(): [number, number];
            scaleExtent(extent: [number, number]): Zoom<Datum>;

            center(): [number, number];
            center(center: [number, number]): Zoom<Datum>;

            size(): [number, number];
            size(size: [number, number]): Zoom<Datum>;

            x(): zoom.Scale;
            x(x: zoom.Scale): Zoom<Datum>;

            y(): zoom.Scale;
            y(y: zoom.Scale): Zoom<Datum>;

            on(type: string): (d: Datum, i: number) => any;
            on(type: string, listener: (d: Datum, i: number) => any): Zoom<Datum>;

            event(selection: Selection<Datum>): void;
            event(transition: Transition<Datum>): void;
        }
    }

    export module geo {
        export function path(): Path;

        interface Path {
            (feature: any, index?: number): string;

            area(feature: any): number;

            centroid(feature: any): [number, number];

            bounds(feature: any): [[number, number], [number, number]];

            projection(): Transform | ((coordinates: [number, number]) => [number, number]);
            projection(stream: Transform): Path;
            projection(projection: (coordinates: [number, number]) => [number, number]): Path;

            pointRadius(): number | ((datum: any, index: number) => number);
            pointRadius(radius: number): Path;
            pointRadius(radius: (datum: any, index: number) => number): Path;

            context(): CanvasRenderingContext2D;
            context(context: CanvasRenderingContext2D): Path;
        }

        export function graticule(): Graticule;

        interface Graticule {
            (): any;

            lines(): any[];

            outline(): any;

            extent(): [[number, number], [number, number]];
            extent(extent: [[number, number], [number, number]]): Graticule;

            majorExtent(): [[number, number], [number, number]];
            majorExtent(extent: [[number, number], [number, number]]): Graticule;

            minorExtent(): [[number, number], [number, number]];
            minorExtent(extent: [[number, number], [number, number]]): Graticule;

            step(): [number, number];
            step(step: [number, number]): Graticule;

            majorStep(): [number, number];
            majorStep(step: [number, number]): Graticule;

            minorStep(): [number, number];
            minorStep(step: [number, number]): Graticule;

            precision(): number;
            precision(precision: number): Graticule;
        }

        export function circle(): Circle;

        interface Circle {
            (...args: any[]): any;

            origin(): [number, number] | ((...args: any[]) => [number, number]);
            origin(origin: [number, number]): Circle;
            origin(origin: (...args: any[]) => [number, number]): Circle;

            angle(): number;
            angle(angle: number): Circle;

            precision(): number;
            precision(precision: number): Circle;
        }

        export function area(feature: any): number;
        export function centroid(feature: any): [number, number];
        export function bounds(feature: any): [[number, number], [number, number]];
        export function distance(a: [number, number], b: [number, number]): number;
        export function length(feature: any): number;
        export function interpolate(a: [number, number], b: [number, number]): (t: number) => [number, number];

        export function rotation(rotate: [number, number] | [number, number, number]): Rotation;

        interface Rotation {
            (location: [number, number]): [number, number];
            invert(location: [number, number]): [number, number];
        }

        export function stream(object: any, listener: Listener): void;

        interface Listener {
            point(x: number, y: number, z: number): void;
            lineStart(): void;
            lineEnd(): void;
            polygonStart(): void;
            polygonEnd(): void;
            sphere(): void;
        }

        export function transform(methods: TransformMethods): Transform;

        interface TransformMethods {
            point?(x: number, y: number, z: number): void;
            lineStart?(): void;
            lineEnd?(): void;
            polygonStart?(): void;
            polygonEnd?(): void;
            sphere?(): void;
        }

        interface Transform {
            stream(stream: Listener): Listener;
        }

        export function clipExtent(): ClipExtent;

        interface ClipExtent extends Transform {
            extent(): [[number, number], [number, number]];
            extent(extent: [[number, number], [number, number]]): ClipExtent;
        }

        export function projection(raw: RawInvertibleProjection): InvertibleProjection;
        export function projection(raw: RawProjection): Projection;

        export function projectionMutator(factory: (...args: any[]) => RawInvertibleProjection): (...args: any[]) => InvertibleProjection;
        export function projectionMutator(factory: (...args: any[]) => RawProjection): (...args: any[]) => Projection;

        export function albers(): ConicProjection;
        export function albersUsa(): ConicProjection;
        export function azimuthalEqualArea(): InvertibleProjection;
        namespace azimuthalEqualArea {
            export function raw(lambda: number, phi: number): [number, number];
            namespace raw {
                export function invert(x: number, y: number): [number, number];
            }
        }

        export function azimuthalEquidistant(): InvertibleProjection;
        namespace azimuthalEquidistant {
            export function raw(lambda: number, phi: number): [number, number];
            namespace raw {
                export function invert(x: number, y: number): [number, number];
            }
        }

        export function conicConformal(): ConicProjection;
        namespace conicConformal {
            export function raw(phi0: number, phi1: number): RawInvertibleProjection;
        }

        export function conicEqualArea(): ConicProjection;
        namespace conicEqualArea {
            export function raw(phi0: number, phi1: number): RawInvertibleProjection;
        }

        export function conicEquidistant(): ConicProjection;
        namespace conicEquidistant {
            export function raw(phi0: number, phi1: number): RawInvertibleProjection;
        }

        export function equirectangular(): InvertibleProjection;
        namespace equirectangular {
            export function raw(lambda: number, phi: number): [number, number];
            namespace raw {
                export function invert(x: number, y: number): [number, number];
            }
        }

        export function gnomonic(): InvertibleProjection;
        namespace gnomonic {
            export function raw(lambda: number, phi: number): [number, number];
            namespace raw {
                export function invert(x: number, y: number): [number, number];
            }
        }

        export function mercator(): InvertibleProjection;
        namespace mercator {
            export function raw(lambda: number, phi: number): [number, number];
            namespace raw {
                export function invert(x: number, y: number): [number, number];
            }
        }

        export function orthographic(): InvertibleProjection;
        namespace orthographic {
            export function raw(lambda: number, phi: number): [number, number];
            namespace raw {
                export function invert(x: number, y: number): [number, number];
            }
        }

        export function stereographic(): InvertibleProjection;
        namespace stereographic {
            export function raw(lambda: number, phi: number): [number, number];
            namespace raw {
                export function invert(x: number, y: number): [number, number];
            }
        }

        export function transverseMercator(): InvertibleProjection;
        namespace transverseMercator {
            export function raw(lambda: number, phi: number): [number, number];
            namespace raw {
                export function invert(x: number, y: number): [number, number];
            }
        }

        interface Projection {
            (location: [number, number]): [number, number];

            rotate(): [number, number, number];
            rotate(rotation: [number, number, number]): Projection;

            center(): [number, number];
            center(location: [number, number]): Projection;

            translate(): [number, number];
            translate(point: [number, number]): Projection;

            scale(): number;
            scale(scale: number): Projection;

            clipAngle(): number;
            clipAngle(angle: number): Projection;

            clipExtent(): [[number, number], [number, number]];
            clipExtent(extent: [[number, number], [number, number]]): Projection;

            precision(): number;
            precision(precision: number): Projection;

            stream(listener: Listener): Listener;
        }

        interface InvertibleProjection extends Projection {
            invert(point: [number, number]): [number, number];
        }

        interface ConicProjection extends InvertibleProjection {
            parallels(): [number, number];
            parallels(parallels: [number, number]): ConicProjection;

            rotate(): [number, number, number];
            rotate(rotation: [number, number, number]): ConicProjection;

            center(): [number, number];
            center(location: [number, number]): ConicProjection;

            translate(): [number, number];
            translate(point: [number, number]): ConicProjection;

            scale(): number;
            scale(scale: number): ConicProjection;

            clipAngle(): number;
            clipAngle(angle: number): ConicProjection;

            clipExtent(): [[number, number], [number, number]];
            clipExtent(extent: [[number, number], [number, number]]): ConicProjection;

            precision(): number;
            precision(precision: number): ConicProjection;
        }

        interface RawProjection {
            (lambda: number, phi: number): [number, number];
        }

        interface RawInvertibleProjection extends RawProjection {
            invert(x: number, y: number): [number, number];
        }
    }

    namespace svg {
        export function line(): Line<[number, number]>;
        export function line<T>(): Line<T>;

        interface Line<T> {
            (data: T[]): string;

            x(): number | ((d: T, i: number) => number);
            x(x: number): Line<T>;
            x(x: (d: T, i: number) => number): Line<T>;

            y(): number | ((d: T, i: number) => number);
            y(x: number): Line<T>;
            y(y: (d: T, i: number) => number): Line<T>;

            interpolate(): string | ((points: Array<[number, number]>) => string);
            interpolate(interpolate: "linear"): Line<T>;
            interpolate(interpolate: "linear-closed"): Line<T>;
            interpolate(interpolate: "step"): Line<T>;
            interpolate(interpolate: "step-before"): Line<T>;
            interpolate(interpolate: "step-after"): Line<T>;
            interpolate(interpolate: "basis"): Line<T>;
            interpolate(interpolate: "basis-open"): Line<T>;
            interpolate(interpolate: "basis-closed"): Line<T>;
            interpolate(interpolate: "bundle"): Line<T>;
            interpolate(interpolate: "cardinal"): Line<T>;
            interpolate(interpolate: "cardinal-open"): Line<T>;
            interpolate(interpolate: "cardinal-closed"): Line<T>;
            interpolate(interpolate: "monotone"): Line<T>;
            interpolate(interpolate: string | ((points: Array<[number, number]>) => string)): Line<T>;

            tension(): number;
            tension(tension: number): Line<T>;

            defined(): (d: T, i: number) => boolean;
            defined(defined: (d: T, i: number) => boolean): Line<T>;
        }

        namespace line {
            export function radial(): Radial<[number, number]>;
            export function radial<T>(): Radial<T>;

            interface Radial<T> {
                (data: T[]): string;

                radius(): number | ((d: T, i: number) => number);
                radius(radius: number): Radial<T>;
                radius(radius: (d: T, i: number) => number): Radial<T>;

                angle(): number | ((d: T, i: number) => number);
                angle(angle: number): Radial<T>;
                angle(angle: (d: T, i: number) => number): Radial<T>;

                interpolate(): string | ((points: Array<[number, number]>) => string);
                interpolate(interpolate: "linear"): Radial<T>;
                interpolate(interpolate: "linear-closed"): Radial<T>;
                interpolate(interpolate: "step"): Radial<T>;
                interpolate(interpolate: "step-before"): Radial<T>;
                interpolate(interpolate: "step-after"): Radial<T>;
                interpolate(interpolate: "basis"): Radial<T>;
                interpolate(interpolate: "basis-open"): Radial<T>;
                interpolate(interpolate: "basis-closed"): Radial<T>;
                interpolate(interpolate: "bundle"): Radial<T>;
                interpolate(interpolate: "cardinal"): Radial<T>;
                interpolate(interpolate: "cardinal-open"): Radial<T>;
                interpolate(interpolate: "cardinal-closed"): Radial<T>;
                interpolate(interpolate: "monotone"): Radial<T>;
                interpolate(interpolate: string | ((points: Array<[number, number]>) => string)): Radial<T>;

                tension(): number;
                tension(tension: number): Radial<T>;

                defined(): (d: T, i: number) => boolean;
                defined(defined: (d: T, i: number) => boolean): Radial<T>;
            }
        }

        export function area(): Area<[number, number]>;
        export function area<T>(): Area<T>;

        interface Area<T> {
            (data: T[]): string;

            x(): number | ((d: T, i: number) => number);
            x(x: number): Area<T>;
            x(x: (d: T, i: number) => number): Area<T>;

            x0(): number | ((d: T, i: number) => number);
            x0(x0: number): Area<T>;
            x0(x0: (d: T, i: number) => number): Area<T>;

            x1(): number | ((d: T, i: number) => number);
            x1(x1: number): Area<T>;
            x1(x1: (d: T, i: number) => number): Area<T>;

            y(): number | ((d: T, i: number) => number);
            y(y: number): Area<T>;
            y(y: (d: T, i: number) => number): Area<T>;

            y0(): number | ((d: T, i: number) => number);
            y0(y0: number): Area<T>;
            y0(y0: (d: T, i: number) => number): Area<T>;

            y1(): number | ((d: T, i: number) => number);
            y1(y1: number): Area<T>;
            y1(y1: (d: T, i: number) => number): Area<T>;

            interpolate(): string | ((points: Array<[number, number]>) => string);
            interpolate(interpolate: "linear"): Area<T>;
            interpolate(interpolate: "step"): Area<T>;
            interpolate(interpolate: "step-before"): Area<T>;
            interpolate(interpolate: "step-after"): Area<T>;
            interpolate(interpolate: "basis"): Area<T>;
            interpolate(interpolate: "basis-open"): Area<T>;
            interpolate(interpolate: "cardinal"): Area<T>;
            interpolate(interpolate: "cardinal-open"): Area<T>;
            interpolate(interpolate: "monotone"): Area<T>;
            interpolate(interpolate: string | ((points: Array<[number, number]>) => string)): Area<T>;

            tension(): number;
            tension(tension: number): Area<T>;

            defined(): (d: T, i: number) => boolean;
            defined(defined: (d: T, i: number) => boolean): Area<T>;
        }

        namespace area {
            export function radial(): Radial<[number, number]>;
            export function radial<T>(): Radial<T>;

            interface Radial<T> {
                (data: T[]): string;

                radius(): number | ((d: T, i: number) => number);
                radius(radius: number): Radial<T>;
                radius(radius: (d: T, i: number) => number): Radial<T>;

                innerRadius(): number | ((d: T, i: number) => number);
                innerRadius(innerRadius: number): Radial<T>;
                innerRadius(innerRadius: (d: T, i: number) => number): Radial<T>;

                outerRadius(): number | ((d: T, i: number) => number);
                outerRadius(outerRadius: number): Radial<T>;
                outerRadius(outerRadius: (d: T, i: number) => number): Radial<T>;

                angle(): number | ((d: T, i: number) => number);
                angle(angle: number): Radial<T>;
                angle(angle: (d: T, i: number) => number): Radial<T>;

                startAngle(): number | ((d: T, i: number) => number);
                startAngle(startAngle: number): Radial<T>;
                startAngle(startAngle: (d: T, i: number) => number): Radial<T>;

                endAngle(): number | ((d: T, i: number) => number);
                endAngle(endAngle: number): Radial<T>;
                endAngle(endAngle: (d: T, i: number) => number): Radial<T>;

                interpolate(): string | ((points: Array<[number, number]>) => string);
                interpolate(interpolate: "linear"): Radial<T>;
                interpolate(interpolate: "step"): Radial<T>;
                interpolate(interpolate: "step-before"): Radial<T>;
                interpolate(interpolate: "step-after"): Radial<T>;
                interpolate(interpolate: "basis"): Radial<T>;
                interpolate(interpolate: "basis-open"): Radial<T>;
                interpolate(interpolate: "cardinal"): Radial<T>;
                interpolate(interpolate: "cardinal-open"): Radial<T>;
                interpolate(interpolate: "monotone"): Radial<T>;
                interpolate(interpolate: string | ((points: Array<[number, number]>) => string)): Radial<T>;

                tension(): number;
                tension(tension: number): Radial<T>;

                defined(): (d: T, i: number) => boolean;
                defined(defined: (d: T, i: number) => boolean): Radial<T>;
            }
        }

        export function arc(): Arc<arc.Arc>;
        export function arc<T>(): Arc<T>;

        namespace arc {
            interface Arc {
                innerRadius: number;
                outerRadius: number;
                startAngle: number;
                endAngle: number;
                padAngle: number
            }
        }

        interface Arc<T> {
            (d: T, i?: number): string;

            innerRadius(): (d: T, i: number) => number;
            innerRadius(radius: number): Arc<T>;
            innerRadius(radius: (d: T, i: number) => number): Arc<T>;

            outerRadius(): (d: T, i: number) => number;
            outerRadius(radius: number): Arc<T>;
            outerRadius(radius: (d: T, i: number) => number): Arc<T>;

            cornerRadius(): (d: T, i: number) => number;
            cornerRadius(radius: number): Arc<T>;
            cornerRadius(radius: (d: T, i: number) => number): Arc<T>;

            padRadius(): string | ((d: T, i: number) => number);
            padRadius(radius: "auto"): Arc<T>;
            padRadius(radius: string): Arc<T>;
            padRadius(radius: (d: T, i: number) => number): Arc<T>;

            startAngle(): (d: T, i: number) => number;
            startAngle(angle: number): Arc<T>;
            startAngle(angle: (d: T, i: number) => number): Arc<T>;

            endAngle(): (d: T, i: number) => number;
            endAngle(angle: number): Arc<T>;
            endAngle(angle: (d: T, i: number) => number): Arc<T>;

            padAngle(): (d: T, i: number) => number;
            padAngle(angle: number): Arc<T>;
            padAngle(angle: (d: T, i: number) => number): Arc<T>;

            centroid(d: T, i?: number): [number, number];
        }

        export function symbol(): Symbol<{}>;
        export function symbol<T>(): Symbol<T>;

        interface Symbol<T> {
            (d: T, i?: number): string;

            type(): (d: T, i: number) => string;
            type(type: string): Symbol<T>;
            type(type: (d: T, i: number) => string): Symbol<T>;

            size(): (d: T, i: string) => number;
            size(size: number): Symbol<T>;
            size(size: (d: T, i: number) => number): Symbol<T>;
        }

        export var symbolTypes: string[];

        export function chord(): Chord<chord.Link<chord.Node>, chord.Node>;
        export function chord<Node>(): Chord<chord.Link<Node>, Node>;
        export function chord<Link, Node>(): Chord<Link, Node>;

        namespace chord {
            interface Link<Node> {
                source: Node;
                target: Node;
            }

            interface Node {
                radius: number;
                startAngle: number;
                endAngle: number
            }
        }

        interface Chord<Link, Node> {
            (d: Link, i: number): string;

            source(): (d: Link, i: number) => Node;
            source(source: Node): Chord<Link, Node>;
            source(source: (d: Link, i: number) => Node): Chord<Link, Node>;

            target(): (d: Link, i: number) => Node;
            target(target: Node): Chord<Link, Node>;
            target(target: (d: Link, i: number) => Node): Chord<Link, Node>;

            radius(): (d: Node, i: number) => number;
            radius(radius: number): Chord<Link, Node>;
            radius(radius: (d: Node, i: number) => number): Chord<Link, Node>;

            startAngle(): (d: Node, i: number) => number;
            startAngle(angle: number): Chord<Link, Node>;
            startAngle(angle: (d: Node, i: number) => number): Chord<Link, Node>;

            endAngle(): (d: Node, i: number) => number;
            endAngle(angle: number): Chord<Link, Node>;
            endAngle(angle: (d: Node, i: number) => number): Chord<Link, Node>;
        }

        export function diagonal(): Diagonal<diagonal.Link<diagonal.Node>, diagonal.Node>;
        export function diagonal<Node>(): Diagonal<diagonal.Link<Node>, Node>;
        export function diagonal<Link, Node>(): Diagonal<Link, Node>;

        namespace diagonal {
            interface Link<Node> {
                source: Node;
                target: Node;
            }

            interface Node {
                x: number;
                y: number;
            }
        }

        interface Diagonal<Link, Node> {
            (d: Link, i?: number): string;

            source(): (d: Link, i: number) => Node;
            source(source: Node): Diagonal<Link, Node>;
            source(source: (d: Link, i: number) => { x: number; y: number; }): Diagonal<Link, Node>;

            target(): (d: Link, i: number) => Node;
            target(target: Node): Diagonal<Link, Node>;
            target(target: (d: Link, i: number) => { x: number; y: number; }): Diagonal<Link, Node>;

            projection(): (d: Node, i: number) => [number, number];
            projection(projection: (d: Node, i: number) => [number, number]): Diagonal<Link, Node>;
        }

        namespace diagonal {
            export function radial(): Radial<Link<Node>, Node>;
            export function radial<Node>(): Radial<Link<Node>, Node>;
            export function radial<Link, Node>(): Radial<Link, Node>;

            interface Radial<Link, Node> {
                (d: Link, i: number): string;

                source(): (d: Link, i: number) => Node;
                source(source: Node): Radial<Link, Node>;
                source(source: (d: Link, i: number) => Node): Radial<Link, Node>;

                target(): (d: Link, i: number) => Node;
                target(target: Node): Radial<Link, Node>;
                target(target: (d: Link, i: number) => Node): Radial<Link, Node>;

                projection(): (d: Node, i: number) => [number, number];
                projection(projection: (d: Node, i: number) => [number, number]): Radial<Link, Node>;
            }
        }

        export function axis(): Axis;

        interface Axis {
            (selection: Selection<any>): void;
            (selection: Transition<any>): void;

            scale(): any;
            scale(scale: any): Axis;

            orient(): string;
            orient(orientation: string): Axis;

            ticks(): any[];
            ticks(...args: any[]): Axis;

            tickValues(): any[];
            tickValues(values: any[]): Axis;

            tickSize(): number;
            tickSize(size: number): Axis;
            tickSize(inner: number, outer: number): Axis;

            innerTickSize(): number;
            innerTickSize(size: number): Axis;

            outerTickSize(): number;
            outerTickSize(size: number): Axis;

            tickPadding(): number;
            tickPadding(padding: number): Axis;

            tickFormat(): (t: any) => string;
            tickFormat(format: (t: any) => string): Axis;
            tickFormat(format:string): Axis;
        }

        export function brush(): Brush<any>;
        export function brush<T>(): Brush<T>;

        namespace brush {
            interface Scale {
                domain(): number[];
                domain(domain: number[]): Scale;

                range(): number[];
                range(range: number[]): Scale;

                invert?(y: number): number;
            }
        }

        interface Brush<T> {
            (selection: Selection<T>): void;
            (selection: Transition<T>): void;

            event(selection: Selection<T>): void;
            event(selection: Transition<T>): void;

            x(): brush.Scale;
            x(x: brush.Scale): Brush<T>;

            y(): brush.Scale;
            y(y: brush.Scale): Brush<T>;

            extent(): [number, number] | [[number, number], [number, number]];
            extent(extent: [number, number] | [[number, number], [number, number]]): Brush<T>;

            clamp(): boolean | [boolean, boolean];
            clamp(clamp: boolean | [boolean, boolean]): Brush<T>;

            clear(): void;

            empty(): boolean;

            on(type: 'brushstart'): (datum: T, index: number) => void;
            on(type: 'brush'): (datum: T, index: number) => void;
            on(type: 'brushend'): (datum: T, index: number) => void;
            on(type: string): (datum: T, index: number) => void;

            on(type: 'brushstart', listener: (datum: T, index: number) => void): Brush<T>;
            on(type: 'brush', listener: (datum: T, index: number) => void): Brush<T>;
            on(type: 'brushend', listener: (datum: T, index: number) => void): Brush<T>;
            on(type: string, listener: (datum: T, index: number) => void): Brush<T>;
        }
    }

    export function xhr(url: string, mimeType?: string, callback?: (err: any, data: any) => void): Xhr;
    export function xhr(url: string, callback: (err: any, data: any) => void): Xhr;

    interface Xhr {
        header(name: string): string;
        header(name: string, value: string): Xhr;

        mimeType(): string;
        mimeType(type: string): Xhr;

        responseType(): string;
        responseType(type: string): Xhr;

        response(): (request: XMLHttpRequest) => any;
        response(value: (request: XMLHttpRequest) => any): Xhr;

        get(callback?: (err: any, data: any) => void): Xhr;

        post(data?: any, callback?: (err: any, data: any) => void): Xhr;
        post(callback: (err: any, data: any) => void): Xhr;

        send(method: string, data?: any, callback?: (err: any, data: any) => void): Xhr;
        send(method: string, callback: (err: any, data: any) => void): Xhr;

        abort(): Xhr;

        on(type: "beforesend"): (request: XMLHttpRequest) => void;
        on(type: "progress"): (request: XMLHttpRequest) => void;
        on(type: "load"): (response: any) => void;
        on(type: "error"): (err: any) => void;
        on(type: string): (...args: any[]) => void;

        on(type: "beforesend", listener: (request: XMLHttpRequest) => void): Xhr;
        on(type: "progress", listener: (request: XMLHttpRequest) => void): Xhr;
        on(type: "load", listener: (response: any) => void): Xhr;
        on(type: "error", listener: (err: any) => void): Xhr;
        on(type: string, listener: (...args: any[]) => void): Xhr;
    }

    export function text(url: string, mimeType?: string, callback?: (err: any, data: string) => void): Xhr;
    export function text(url: string, callback: (err: any, data: string) => void): Xhr;

    export function json(url: string, callback?: (err: any, data: any) => void): Xhr;

    export function xml(url: string, mimeType?: string, callback?: (err: any, data: any) => void): Xhr;
    export function xml(url: string, callback: (err: any, data: any) => void): Xhr;

    export function html(url: string, callback?: (err: any, data: DocumentFragment) => void): Xhr;

    export var csv: Dsv;
    export var tsv: Dsv;
    export function dsv(delimiter: string, mimeType: string): Dsv;

    interface Dsv {
        (url: string, callback: (rows: { [key: string]: string }[]) => void): DsvXhr<{ [key: string]: string }>;
        (url: string, callback: (error: any, rows: { [key: string]: string }[]) => void): DsvXhr<{ [key: string]: string }>;
        (url: string): DsvXhr<{ [key: string]: string }>;
        <T>(url: string, accessor: (row: { [key: string]: string }) => T, callback: (rows: T[]) => void): DsvXhr<T>;
        <T>(url: string, accessor: (row: { [key: string]: string }) => T, callback: (error: any, rows: T[]) => void): DsvXhr<T>;
        <T>(url: string, accessor: (row: { [key: string]: string }) => T): DsvXhr<T>;

        parse(string: string): { [key: string]: string }[];
        parse<T>(string: string, accessor: (row: { [key: string]: string }, index: number) => T): T[];

        parseRows(string: string): string[][];
        parseRows<T>(string: string, accessor: (row: string[], index: number) => T): T[];

        format(rows: Object[]): string;

        formatRows(rows: string[][]): string;
    }

    interface DsvXhr<T> extends Xhr {
        row(): (row: { [key: string]: string }) => T;
        row<U>(accessor: (row: { [key: string]: string }) => U): DsvXhr<U>;

        header(name: string): string;
        header(name: string, value: string): DsvXhr<T>;

        mimeType(): string;
        mimeType(type: string): DsvXhr<T>;

        responseType(): string;
        responseType(type: string): DsvXhr<T>;

        response(): (request: XMLHttpRequest) => any;
        response(value: (request: XMLHttpRequest) => any): DsvXhr<T>;

        get(callback?: (err: XMLHttpRequest, data: T[]) => void): DsvXhr<T>;
        post(data?: any, callback?: (err: XMLHttpRequest, data: T[]) => void): DsvXhr<T>;
        post(callback: (err: XMLHttpRequest, data: T[]) => void): DsvXhr<T>;

        send(method: string, data?: any, callback?: (err: XMLHttpRequest, data: T[]) => void): DsvXhr<T>;
        send(method: string, callback: (err: XMLHttpRequest, data: T[]) => void): DsvXhr<T>;

        abort(): DsvXhr<T>;

        on(type: "beforesend"): (request: XMLHttpRequest) => void;
        on(type: "progress"): (request: XMLHttpRequest) => void;
        on(type: "load"): (response: T[]) => void;
        on(type: "error"): (err: any) => void;
        on(type: string): (...args: any[]) => void;

        on(type: "beforesend", listener: (request: XMLHttpRequest) => void): DsvXhr<T>;
        on(type: "progress", listener: (request: XMLHttpRequest) => void): DsvXhr<T>;
        on(type: "load", listener: (response: T[]) => void): DsvXhr<T>;
        on(type: "error", listener: (err: any) => void): DsvXhr<T>;
        on(type: string, listener: (...args: any[]) => void): DsvXhr<T>;
    }

    export function locale(definition: LocaleDefinition): Locale;

    interface LocaleDefinition {
        decimal: string;
        thousands: string;
        grouping: number[];
        currency: [string, string];
        dateTime: string;
        date: string;
        time: string;
        periods: [string, string];
        days: [string, string, string, string, string, string, string];
        shortDays: [string, string, string, string, string, string, string];
        months: [string, string, string, string, string, string, string, string, string, string, string, string];
        shortMonths: [string, string, string, string, string, string, string, string, string, string, string, string];
    }

    interface Locale {
        numberFormat(specifier: string): (n: number) => string;
        timeFormat: {
            (specifier: string): time.Format;
            utc(specifier: string): time.Format;
            multi(formats: Array<[string, (d: Date) => boolean|number]>): time.Format;
        }
    }

    namespace layout {
        export function bundle(): Bundle<bundle.Node>;
        export function bundle<T extends bundle.Node>(): Bundle<T>

        namespace bundle {
            interface Node {
                parent: Node;
            }

            interface Link<T extends Node> {
                source: T;
                target: T;
            }
        }

        interface Bundle<T extends bundle.Node> {
            (links: bundle.Link<T>[]): T[][];
        }

        export function chord(): Chord;

        namespace chord {
            interface Link {
                source: Node;
                target: Node;
            }

            interface Node {
                index: number;
                subindex: number;
                startAngle: number;
                endAngle: number;
                value: number;
            }

            interface Group {
                index: number;
                startAngle: number;
                endAngle: number;
                value: number;
            }
        }

        interface Chord {
            matrix(): number[][];
            matrix(matrix: number[][]): Chord;

            padding(): number;
            padding(padding: number): Chord;

            sortGroups(): (a: number, b: number) => number;
            sortGroups(comparator: (a: number, b: number) => number): Chord;

            sortSubgroups(): (a: number, b: number) => number;
            sortSubgroups(comparator: (a: number, b: number) => number): Chord;

            sortChords(): (a: number, b: number) => number;
            sortChords(comparator: (a: number, b: number) => number): Chord;

            chords(): chord.Link[];
            groups(): chord.Group[];
        }

        export function cluster(): Cluster<cluster.Result>;
        export function cluster<T extends cluster.Result>(): Cluster<T>;

        namespace cluster {
            interface Result {
                parent?: Result;
                children?: Result[];
                depth?: number;
                x?: number;
                y?: number;
            }

            interface Link<T extends Result> {
                source: T;
                target: T;
            }
        }

        interface Cluster<T extends cluster.Result> {
            (root: T): T[];

            nodes(root: T): T[];

            links(nodes: T[]): cluster.Link<T>[];

            children(): (node: T) => T[];
            children(accessor: (node: T) => T[]): Cluster<T>;

            sort(): (a: T, b: T) => number;
            sort(comparator: (a: T, b: T) => number): Cluster<T>;

            separation(): (a: T, b: T) => number;
            separation(separation: (a: T, b: T) => number): Cluster<T>;

            size(): [number, number];
            size(size: [number, number]): Cluster<T>;

            nodeSize(): [number, number];
            nodeSize(nodeSize: [number, number]): Cluster<T>;

            value(): (a: T) => number;
            value(value: (a: T) => number): Cluster<T>;
        }

        export function force(): Force<force.Link<force.Node>, force.Node>;
        export function force<Node extends force.Node>(): Force<force.Link<Node>, Node>;
        export function force<Link extends force.Link<force.Node>, Node extends force.Node>(): Force<Link, Node>;

        namespace force {
            interface Link<T extends Node> {
                source: T;
                target: T;
            }

            interface Node {
                index?: number;
                x?: number;
                y?: number;
                px?: number;
                py?: number;
                fixed?: boolean;
                weight?: number;
            }

            interface Event {
                type: string;
                alpha: number;
            }
        }

        interface Force<Link extends force.Link<force.Node>, Node extends force.Node> {
            size(): [number, number];
            size(size: [number, number]): Force<Link, Node>;

            linkDistance(): number | ((link: Link, index: number) => number);
            linkDistance(distance: number): Force<Link, Node>;
            linkDistance(distance: (link: Link, index: number) => number): Force<Link, Node>;

            linkStrength(): number | ((link: Link, index: number) => number);
            linkStrength(strength: number): Force<Link, Node>;
            linkStrength(strength: (link: Link, index: number) => number): Force<Link, Node>;

            friction(): number;
            friction(friction: number): Force<Link, Node>;

            charge(): number | ((node: Node, index: number) => number);
            charge(charge: number): Force<Link, Node>;
            charge(charge: (node: Node, index: number) => number): Force<Link, Node>;

            chargeDistance(): number;
            chargeDistance(distance: number): Force<Link, Node>;

            theta(): number;
            theta(theta: number): Force<Link, Node>;

            gravity(): number;
            gravity(gravity: number): Force<Link, Node>;

            nodes(): Node[];
            nodes(nodes: Node[]): Force<Link, Node>;

            links(): Link[];
            links(links: { source: number; target: number }[]): Force<Link, Node>;
            links(links: Link[]): Force<Link, Node>;

            start(): Force<Link, Node>;

            tick(): Force<Link, Node>;

            alpha(): number;
            alpha(value: number): Force<Link, Node>;

            resume(): Force<Link, Node>;

            stop(): Force<Link, Node>;

            on(type: string): (event: force.Event) => void;
            on(type: string, listener: (event: force.Event) => void): Force<Link, Node>;

            drag(): behavior.Drag<Node>;
            drag(selection: Selection<Node>): void;
        }

        export function hierarchy(): Hierarchy<hierarchy.Result>;
        export function hierarchy<T extends hierarchy.Result>(): Hierarchy<T>;

        namespace hierarchy {
            interface Result {
                parent?: Result;
                children?: Result[];
                value?: number;
                depth?: number;
            }
        }

        interface Hierarchy<T extends hierarchy.Result> {
            (root: T): T[];

            children(): (node: T) => T[];
            children(accessor: (node: T) => T[]): Hierarchy<T>;

            sort(): (a: T, b: T) => number;
            sort(comparator: (a: T, b: T) => number): Hierarchy<T>;

            value(): (node: T) => number;
            value(accessor: (node: T) => number): Hierarchy<T>;

            revalue(root: T): T[];
        }

        export function histogram(): Histogram<number>;
        export function histogram<T>(): Histogram<T>;

        namespace histogram {
            interface Bin<T> extends Array<T> {
                x: number;
                dx: number;
                y: number;
            }
        }

        interface Histogram<T> {
            (values: T[], index?: number): histogram.Bin<T>[];

            value(): (datum: T, index: number) => number;
            value(value: (datum: T, index: number) => number): Histogram<T>;

            range(): (values: T[], index: number) => [number, number];
            range(range: (values: T[], index: number) => [number, number]): Histogram<T>;
            range(range: [number, number]): Histogram<T>;

            bins(): (range: [number, number], values: T[], index: number) => number[];
            bins(count: number): Histogram<T>;
            bins(thresholds: number[]): Histogram<T>;
            bins(func: (range: [number, number], values: T[], index: number) => number[]): Histogram<T>;

            frequency(): boolean;
            frequency(frequency: boolean): Histogram<T>;
        }

        export function pack(): Pack<pack.Node>;
        export function pack<T extends pack.Node>(): Pack<T>;

        namespace pack {
            interface Node {
                parent?: Node;
                children?: Node[];
                value?: number;
                depth?: number;
                x?: number;
                y?: number;
                r?: number;
            }

            interface Link<T extends Node> {
                source: Node;
                target: Node;
            }
        }

        interface Pack<T extends pack.Node> {
            (root: T): T[];

            nodes(root: T): T[];

            links(nodes: T[]): pack.Link<T>[];

            children(): (node: T, depth: number) => T[];
            children(children: (node: T, depth: number) => T[]): Pack<T>;

            sort(): (a: T, b: T) => number;
            sort(comparator: (a: T, b: T) => number): Pack<T>;

            value(): (node: T) => number;
            value(value: (node: T) => number): Pack<T>;

            size(): [number, number];
            size(size: [number, number]): Pack<T>;

            radius(): number | ((node: T) => number);
            radius(radius: number): Pack<T>;
            radius(radius: (node: T) => number): Pack<T>;

            padding(): number;
            padding(padding: number): Pack<T>;
        }

        export function partition(): Partition<partition.Node>;
        export function partition<T extends partition.Node>(): Partition<T>;

        namespace partition {
            interface Link<T extends Node> {
                source: T;
                target: T;
            }

            interface Node {
                parent?: Node;
                children?: number;
                value?: number;
                depth?: number;
                x?: number;
                y?: number;
                dx?: number;
                dy?: number;
            }

        }

        export interface Partition<T extends partition.Node> {
            (root: T): T[];

            nodes(root: T): T[];

            links(nodes: T[]): partition.Link<T>[];

            children(): (node: T, depth: number) => T[];
            children(children: (node: T, depth: number) => T[]): Partition<T>;

            sort(): (a: T, b: T) => number;
            sort(comparator: (a: T, b: T) => number): Partition<T>;

            value(): (node: T) => number;
            value(value: (node: T) => number): Partition<T>;

            size(): [number, number];
            size(size: [number, number]): Partition<T>;
        }

        export function pie(): Pie<number>;
        export function pie<T>(): Pie<T>;

        namespace pie {
            interface Arc<T> {
                value: number;
                startAngle: number;
                endAngle: number;
                padAngle: number;
                data: T;
            }
        }

        interface Pie<T> {
            (data: T[], index?: number): pie.Arc<T>[];

            value(): (datum: T, index: number) => number;
            value(accessor: (datum: T, index: number) => number): Pie<T>;

            sort(): (a: T, b: T) => number;
            sort(comparator: (a: T, b: T) => number): Pie<T>;

            startAngle(): number | ((data: T[], index: number) => number);
            startAngle(angle: number): Pie<T>;
            startAngle(angle: (data: T[], index: number) => number): Pie<T>;

            endAngle(): number | ((data: T[], index: number) => number);
            endAngle(angle: number): Pie<T>;
            endAngle(angle: (data: T[], index: number) => number): Pie<T>;

            padAngle(): number | ((data: T[], index: number) => number);
            padAngle(angle: number): Pie<T>;
            padAngle(angle: (data: T[], index: number) => number): Pie<T>;
        }

        export function stack(): Stack<stack.Value[], stack.Value>;
        export function stack<Value>(): Stack<Value[], Value>;
        export function stack<Series, Value>(): Stack<Series, Value>;
        namespace stack {
            interface Value {
                x: number;
                y: number;
                y0?: number;
            }
        }

        interface Stack<Series, Value> {
            (layers: Series[], index?: number): Series[];

            values(): (layer: Series, index: number) => Value[];
            values(accessor: (layer: Series, index: number) => Value[]): Stack<Series, Value>;

            offset(): (data: Array<[number, number]>) => number[];
            offset(offset: "silhouette"): Stack<Series, Value>;
            offset(offset: "wiggle"): Stack<Series, Value>;
            offset(offset: "expand"): Stack<Series, Value>;
            offset(offset: "zero"): Stack<Series, Value>;
            offset(offset: string): Stack<Series, Value>;
            offset(offset: (data: Array<[number, number]>) => number[]): Stack<Series, Value>;

            order(): (data: Array<[number, number]>) => number[];
            order(order: "inside-out"): Stack<Series, Value>;
            order(order: "reverse"): Stack<Series, Value>;
            order(order: "default"): Stack<Series, Value>;
            order(order: string): Stack<Series, Value>;
            order(order: (data: Array<[number, number]>) => number[]): Stack<Series, Value>;

            x(): (value: Value, index: number) => number;
            x(accessor: (value: Value, index: number) => number): Stack<Series, Value>;

            y(): (value: Value, index: number) => number;
            y(accesor: (value: Value, index: number) => number): Stack<Series, Value>;

            out(): (value: Value, y0: number, y: number) => void;
            out(setter: (value: Value, y0: number, y: number) => void): Stack<Series, Value>;
        }

        export function tree(): Tree<tree.Node>;
        export function tree<T extends tree.Node>(): Tree<T>;

        namespace tree {
            interface Link<T extends Node> {
                source: T;
                target: T;
            }

            interface Node {
                parent?: Node;
                children?: Node[];
                depth?: number;
                x?: number;
                y?: number;
            }
        }

        interface Tree<T> {
            (root: T, index?: number): T[];

            nodes(root: T, index?: number): T[];

            links(nodes: T[]): tree.Link<T>[];

            children(): (datum: T, index: number) => T[];
            children(children: (datum: T, index: number) => T[]): Tree<T>;

            separation(): (a: T, b: T) => number;
            separation(separation: (a: T, b: T) => number): Tree<T>;

            size(): [number, number];
            size(size: [number, number]): Tree<T>;

            nodeSize(): [number, number];
            nodeSize(size: [number, number]): Tree<T>;

            sort(): (a: T, b: T) => number;
            sort(comparator: (a: T, b: T) => number): Tree<T>;

            value(): (datum: T, index: number) => number;
            value(value: (datum: T, index: number) => number): Tree<T>;
        }

        export function treemap(): Treemap<treemap.Node>;
        export function treemap<T extends treemap.Node>(): Treemap<T>;

        namespace treemap {
            interface Node {
                parent?: Node;
                children?: Node[];
                value?: number;
                depth?: number;
                x?: number;
                y?: number;
                dx?: number;
                dy?: number;
            }

            interface Link<T extends Node> {
                source: T;
                target: T;
            }

            type Padding = number | [number, number, number, number];
        }

        interface Treemap<T extends treemap.Node> {
            (root: T, index?: number): T[];

            nodes(root: T, index?: number): T[];

            links(nodes: T[]): treemap.Link<T>[];

            children(): (node: T, depth: number) => T[];
            children(children: (node: T, depth: number) => T[]): Treemap<T>;

            sort(): (a: T, b: T) => number;
            sort(comparator: (a: T, b: T) => number): Treemap<T>;

            value(): (node: T, index: number) => number;
            value(value: (node: T, index: number) => number): Treemap<T>;

            size(): [number, number];
            size(size: [number, number]): Treemap<T>;

            padding(): (node: T, depth: number) => treemap.Padding;
            padding(padding: treemap.Padding): Treemap<T>;
            padding(padding: (node: T, depth: number) => treemap.Padding): Treemap<T>;

            round(): boolean;
            round(round: boolean): Treemap<T>;

            sticky(): boolean;
            sticky(sticky: boolean): boolean;

            mode(): string;
            mode(mode: "squarify"): Treemap<T>;
            mode(mode: "slice"): Treemap<T>;
            mode(mode: "dice"): Treemap<T>;
            mode(mode: "slice-dice"): Treemap<T>;
            mode(mode: string): Treemap<T>;

            ratio(): number;
            ratio(ratio: number): Treemap<T>;
        }
    }

    namespace geom {
        export function voronoi(): Voronoi<[number, number]>;
        export function voronoi<T>(): Voronoi<T>;

        namespace voronoi {
            interface Link<T> {
                source: T;
                target: T;
            }
        }

        interface Voronoi<T> {
            (data: T[]): Array<[number, number]>;

            x(): (vertex: T) => number;
            x(x: (vertex: T) => number): Voronoi<T>;

            y(): (vertex: T) => number;
            y(y: (vertex: T) => number): Voronoi<T>;

            clipExtent(): [[number, number], [number, number]];
            clipExtent(extent: [[number, number], [number, number]]): Voronoi<T>;

            links(data: T[]): voronoi.Link<T>[];

            triangles(data: T[]): Array<[T, T, T]>;
        }

        /**
         * @deprecated use d3.geom.voronoi().triangles() instead
         */
        export function delaunay(vertices: Array<[number, number]>): Array<[[number, number], [number, number], [number, number]]>;

        export function quadtree(): Quadtree<[number, number]>;
        export function quadtree<T>(nodes: T[], x1?: number, y1?: number, x2?: number, y2?: number): quadtree.Quadtree<T>;

        namespace quadtree {
            interface Node<T> {
                nodes: [Node<T>, Node<T>, Node<T>, Node<T>];
                leaf: boolean;
                point: T;
                x: number;
                y: number;
            }

            interface Quadtree<T> extends Node<T> {
                add(point: T): void;
                visit(callback: (node: Node<T>, x1: number, y1: number, x2: number, y2: number) => boolean | void): void;
                find(point: [number, number]): T;
            }
        }

        interface Quadtree<T> {
            (points: T[]): quadtree.Quadtree<T>;

            x(): (datum: T, index: number) => number;
            x(x: number): Quadtree<T>;
            x(x: (datum: T, index: number) => number): Quadtree<T>;

            y(): (datum: T, index: number) => number;
            y(y: number): Quadtree<T>;
            y(y: (datum: T, index: number) => number): Quadtree<T>;

            extent(): [[number, number], [number, number]];
            extent(extent: [[number, number], [number, number]]): Quadtree<T>;
        }

        export function hull(vertices: Array<[number, number]>): Array<[number, number]>;
        export function hull(): Hull<[number, number]>;
        export function hull<T>(): Hull<T>;

        interface Hull<T> {
            (vertices: T[]): Array<[number, number]>;

            x(): (datum: T) => number;
            x(x: (datum: T) => number): Hull<T>;

            y(): (datum: T) => number;
            y(y: (datum: T) => number): Hull<T>;
        }

        export function polygon(vertices: Array<[number, number]>): Polygon;

        interface Polygon {
            area(): number;

            centroid(): [number, number];

            clip(subject: Array<[number, number]>): Array<[number, number]>;
        }
    }
}

// we need this to exist
interface TouchList { }
