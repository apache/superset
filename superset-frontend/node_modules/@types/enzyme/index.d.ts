// Type definitions for Enzyme 3.10
// Project: https://github.com/airbnb/enzyme
// Definitions by: Marian Palkus <https://github.com/MarianPalkus>
//                 Cap3 <http://www.cap3.de>
//                 Ivo Stratev <https://github.com/NoHomey>
//                 jwbay <https://github.com/jwbay>
//                 huhuanming <https://github.com/huhuanming>
//                 MartynasZilinskas <https://github.com/MartynasZilinskas>
//                 Torgeir Hovden <https://github.com/thovden>
//                 Martin Hochel <https://github.com/hotell>
//                 Christian Rackerseder <https://github.com/screendriver>
//                 Mateusz Sokoła <https://github.com/mateuszsokola>
//                 Braiden Cutforth <https://github.com/braidencutforth>
//                 Erick Zhao <https://github.com/erickzhao>
//                 Jack Tomaszewski <https://github.com/jtomaszewski>
//                 Jordan Harband <https://github.com/ljharb>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.1

/// <reference types="cheerio" />
import {
    ReactElement,
    Component,
    AllHTMLAttributes as ReactHTMLAttributes,
    SVGAttributes as ReactSVGAttributes,
} from 'react';

export type HTMLAttributes = ReactHTMLAttributes<{}> & ReactSVGAttributes<{}>;

export class ElementClass extends Component<any, any> {}

/* These are purposefully stripped down versions of React.ComponentClass and React.StatelessComponent.
 * The optional static properties on them break overload ordering for wrapper methods if they're not
 * all specified in the implementation. TS chooses the EnzymePropSelector overload and loses the generics
 */
export interface ComponentClass<Props> {
    new (props: Props, context?: any): Component<Props>;
}

export type StatelessComponent<Props> = (props: Props, context?: any) => JSX.Element | null;

export type ComponentType<Props> = ComponentClass<Props> | StatelessComponent<Props>;

/**
 * Many methods in Enzyme's API accept a selector as an argument. Selectors in Enzyme can fall into one of the
 * following three categories:
 *
 *  1. A Valid CSS Selector
 *  2. A React Component Constructor
 *  3. A React Component's displayName
 *  4. A React Stateless component
 *  5. A React component property map
 */
export interface EnzymePropSelector {
    [key: string]: any;
}
export type EnzymeSelector = string | StatelessComponent<any> | ComponentClass<any> | EnzymePropSelector;

export type Intercepter<T> = (intercepter: T) => void;

export interface CommonWrapper<P = {}, S = {}, C = Component<P, S>> {
    /**
     * Returns a new wrapper with only the nodes of the current wrapper that, when passed into the provided predicate function, return true.
     */
    filterWhere(predicate: (wrapper: this) => boolean): this;

    /**
     * Returns whether or not the current wrapper has a node anywhere in it's render tree that looks like the one passed in.
     */
    contains(node: ReactElement | ReactElement[] | string): boolean;

    /**
     * Returns whether or not a given react element exists in the shallow render tree.
     */
    containsMatchingElement(node: ReactElement | ReactElement[]): boolean;

    /**
     * Returns whether or not all the given react elements exists in the shallow render tree
     */
    containsAllMatchingElements(nodes: ReactElement[] | ReactElement[][]): boolean;

    /**
     * Returns whether or not one of the given react elements exists in the shallow render tree.
     */
    containsAnyMatchingElements(nodes: ReactElement[] | ReactElement[][]): boolean;

    /**
     * Returns whether or not the current render tree is equal to the given node, based on the expected value.
     */
    equals(node: ReactElement): boolean;

    /**
     * Returns whether or not a given react element matches the shallow render tree.
     */
    matchesElement(node: ReactElement): boolean;

    /**
     * Returns whether or not the current node has a className prop including the passed in class name.
     */
    hasClass(className: string | RegExp): boolean;

    /**
     * Invokes a function prop.
     * @param invokePropName The function prop to call.
     * @param ...args The argments to the invokePropName function
     * @returns The value of the function.
     */
    invoke<
        K extends NonNullable<
            {
                [K in keyof P]: P[K] extends ((...arg: any[]) => void) | undefined ? K : never;
            }[keyof P]
        >
    >(
        invokePropName: K
    ): P[K];

    /**
     * Returns whether or not the current node matches a provided selector.
     */
    is(selector: EnzymeSelector): boolean;

    /**
     * Returns whether or not the current node is empty.
     * @deprecated Use .exists() instead.
     */
    isEmpty(): boolean;

    /**
     * Returns whether or not the current node exists.
     */
    exists(selector?: EnzymeSelector): boolean;

    /**
     * Returns a new wrapper with only the nodes of the current wrapper that don't match the provided selector.
     * This method is effectively the negation or inverse of filter.
     */
    not(selector: EnzymeSelector): this;

    /**
     * Returns a string of the rendered text of the current render tree. This function should be looked at with
     * skepticism if being used to test what the actual HTML output of the component will be. If that is what you
     * would like to test, use enzyme's render function instead.
     *
     * Note: can only be called on a wrapper of a single node.
     */
    text(): string;

    /**
     * Returns a string of the rendered HTML markup of the current render tree.
     *
     * Note: can only be called on a wrapper of a single node.
     */
    html(): string;

    /**
     * Returns the node at a given index of the current wrapper.
     */
    get(index: number): ReactElement;

    /**
     * Returns the wrapper's underlying node.
     */
    getNode(): ReactElement;

    /**
     * Returns the wrapper's underlying nodes.
     */
    getNodes(): ReactElement[];

    /**
     * Returns the wrapper's underlying node.
     */
    getElement(): ReactElement;

    /**
     * Returns the wrapper's underlying node.
     */
    getElements(): ReactElement[];

    /**
     * Returns the outer most DOMComponent of the current wrapper.
     */
    getDOMNode<T extends Element = Element>(): T;

    /**
     * Returns a wrapper around the node at a given index of the current wrapper.
     */
    at(index: number): this;

    /**
     * Reduce the set of matched nodes to the first in the set.
     */
    first(): this;

    /**
     * Reduce the set of matched nodes to the last in the set.
     */
    last(): this;

    /**
     * Returns a new wrapper with a subset of the nodes of the original wrapper, according to the rules of `Array#slice`.
     */
    slice(begin?: number, end?: number): this;

    /**
     * Taps into the wrapper method chain. Helpful for debugging.
     */
    tap(intercepter: Intercepter<this>): this;

    /**
     * Returns the state hash for the root node of the wrapper. Optionally pass in a prop name and it will return just that value.
     */
    state(): S;
    state<K extends keyof S>(key: K): S[K];
    state<T>(key: string): T;

    /**
     * Returns the context hash for the root node of the wrapper. Optionally pass in a prop name and it will return just that value.
     */
    context(): any;
    context<T>(key: string): T;

    /**
     * Returns the props hash for the current node of the wrapper.
     *
     * NOTE: can only be called on a wrapper of a single node.
     */
    props(): P;

    /**
     * Returns the prop value for the node of the current wrapper with the provided key.
     *
     * NOTE: can only be called on a wrapper of a single node.
     */
    prop<K extends keyof P>(key: K): P[K];
    prop<T>(key: string): T;

    /**
     * Returns the key value for the node of the current wrapper.
     * NOTE: can only be called on a wrapper of a single node.
     */
    key(): string;

    /**
     * Simulate events.
     * Returns itself.
     * @param args?
     */
    simulate(event: string, ...args: any[]): this;

    /**
     * Used to simulate throwing a rendering error. Pass an error to throw.
     * Returns itself.
     * @param error
     */
    simulateError(error: any): this;

    /**
     * A method to invoke setState() on the root component instance similar to how you might in the definition of
     * the component, and re-renders. This method is useful for testing your component in hard to achieve states,
     * however should be used sparingly. If possible, you should utilize your component's external API in order to
     * get it into whatever state you want to test, in order to be as accurate of a test as possible. This is not
     * always practical, however.
     * Returns itself.
     *
     * NOTE: can only be called on a wrapper instance that is also the root instance.
     */
    setState<K extends keyof S>(state: Pick<S, K>, callback?: () => void): this;

    /**
     * A method that sets the props of the root component, and re-renders. Useful for when you are wanting to test
     * how the component behaves over time with changing props. Calling this, for instance, will call the
     * componentWillReceiveProps lifecycle method.
     *
     * Similar to setState, this method accepts a props object and will merge it in with the already existing props.
     * Returns itself.
     *
     * NOTE: can only be called on a wrapper instance that is also the root instance.
     */
    setProps<K extends keyof P>(props: Pick<P, K>, callback?: () => void): this;

    /**
     * A method that sets the context of the root component, and re-renders. Useful for when you are wanting to
     * test how the component behaves over time with changing contexts.
     * Returns itself.
     *
     * NOTE: can only be called on a wrapper instance that is also the root instance.
     */
    setContext(context: any): this;

    /**
     * Gets the instance of the component being rendered as the root node passed into shallow().
     *
     * NOTE: can only be called on a wrapper instance that is also the root instance.
     */
    instance(): C;

    /**
     * Forces a re-render. Useful to run before checking the render output if something external may be updating
     * the state of the component somewhere.
     * Returns itself.
     *
     * NOTE: can only be called on a wrapper instance that is also the root instance.
     */
    update(): this;

    /**
     * Returns an html-like string of the wrapper for debugging purposes. Useful to print out to the console when
     * tests are not passing when you expect them to.
     */
    debug(options?: {
        /** Whether props should be omitted in the resulting string. Props are included by default. */
        ignoreProps?: boolean;
        /** Whether arrays and objects passed as props should be verbosely printed. */
        verbose?: boolean;
    }): string;

    /**
     * Returns the name of the current node of the wrapper.
     */
    name(): string;

    /**
     * Iterates through each node of the current wrapper and executes the provided function with a wrapper around
     * the corresponding node passed in as the first argument.
     *
     * Returns itself.
     * @param fn A callback to be run for every node in the collection. Should expect a ShallowWrapper as the first
     *              argument, and will be run with a context of the original instance.
     */
    forEach(fn: (wrapper: this, index: number) => any): this;

    /**
     * Maps the current array of nodes to another array. Each node is passed in as a ShallowWrapper to the map
     * function.
     * Returns an array of the returned values from the mapping function..
     * @param fn A mapping function to be run for every node in the collection, the results of which will be mapped
     *              to the returned array. Should expect a ShallowWrapper as the first argument, and will be run
     *              with a context of the original instance.
     */
    map<V>(fn: (wrapper: this, index: number) => V): V[];

    /**
     * Applies the provided reducing function to every node in the wrapper to reduce to a single value. Each node
     * is passed in as a ShallowWrapper, and is processed from left to right.
     */
    reduce<R>(fn: (prevVal: R, wrapper: this, index: number) => R, initialValue?: R): R;

    /**
     * Applies the provided reducing function to every node in the wrapper to reduce to a single value.
     * Each node is passed in as a ShallowWrapper, and is processed from right to left.
     */
    reduceRight<R>(fn: (prevVal: R, wrapper: this, index: number) => R, initialValue?: R): R;

    /**
     * Returns whether or not any of the nodes in the wrapper match the provided selector.
     */
    some(selector: EnzymeSelector): boolean;

    /**
     * Returns whether or not any of the nodes in the wrapper pass the provided predicate function.
     */
    someWhere(fn: (wrapper: this) => boolean): boolean;

    /**
     * Returns whether or not all of the nodes in the wrapper match the provided selector.
     */
    every(selector: EnzymeSelector): boolean;

    /**
     * Returns whether or not all of the nodes in the wrapper pass the provided predicate function.
     */
    everyWhere(fn: (wrapper: this) => boolean): boolean;

    /**
     * Returns true if renderer returned null
     */
    isEmptyRender(): boolean;

    /**
     * Renders the component to static markup and returns a Cheerio wrapper around the result.
     */
    render(): Cheerio;

    /**
     * Returns the type of the current node of this wrapper. If it's a composite component, this will be the
     * component constructor. If it's native DOM node, it will be a string of the tag name.
     *
     * Note: can only be called on a wrapper of a single node.
     */
    type(): string | ComponentClass<P> | StatelessComponent<P>;

    length: number;
}

export type Parameters<T> = T extends (...args: infer A) => any ? A : never;

// tslint:disable-next-line no-empty-interface
export interface ShallowWrapper<P = {}, S = {}, C = Component> extends CommonWrapper<P, S, C> {}
export class ShallowWrapper<P = {}, S = {}, C = Component> {
    constructor(nodes: JSX.Element[] | JSX.Element, root?: ShallowWrapper<any, any>, options?: ShallowRendererProps);
    shallow(options?: ShallowRendererProps): ShallowWrapper<P, S>;
    unmount(): this;

    /**
     * Find every node in the render tree that matches the provided selector.
     * @param selector The selector to match.
     */
    find<P2>(statelessComponent: StatelessComponent<P2>): ShallowWrapper<P2, never>;
    find<P2>(component: ComponentType<P2>): ShallowWrapper<P2, any>;
    find<C2 extends Component>(
      componentClass: ComponentClass<C2['props']>,
    ): ShallowWrapper<C2['props'], C2['state'], C2>;
    find(props: EnzymePropSelector): ShallowWrapper<any, any>;
    find(selector: string): ShallowWrapper<HTMLAttributes, any>;

    /**
     * Removes nodes in the current wrapper that do not match the provided selector.
     * @param selector The selector to match.
     */
    filter<P2>(statelessComponent: StatelessComponent<P2>): ShallowWrapper<P2, never>;
    filter<P2>(component: ComponentType<P2>): ShallowWrapper<P2, any>;
    filter(props: EnzymePropSelector | string): ShallowWrapper<P, S>;

    /**
     * Finds every node in the render tree that returns true for the provided predicate function.
     */
    findWhere(predicate: (wrapper: ShallowWrapper<any, any>) => boolean): ShallowWrapper<any, any>;

    /**
     * Returns a new wrapper with all of the children of the node(s) in the current wrapper. Optionally, a selector
     * can be provided and it will filter the children by this selector.
     */
    children<P2>(statelessComponent: StatelessComponent<P2>): ShallowWrapper<P2, never>;
    children<P2>(component: ComponentType<P2>): ShallowWrapper<P2, any>;
    children(selector: string): ShallowWrapper<HTMLAttributes, any>;
    children(props?: EnzymePropSelector): ShallowWrapper<any, any>;

    /**
     * Returns a new wrapper with child at the specified index.
     */
    childAt(index: number): ShallowWrapper<any, any>;
    childAt<P2, S2>(index: number): ShallowWrapper<P2, S2>;

    /**
     * Shallow render the one non-DOM child of the current wrapper, and return a wrapper around the result.
     * NOTE: can only be called on wrapper of a single non-DOM component element node.
     */
    dive<C2 extends Component, P2 = C2['props'], S2 = C2['state']>(
        options?: ShallowRendererProps
    ): ShallowWrapper<P2, S2, C2>;
    dive<P2, S2>(options?: ShallowRendererProps): ShallowWrapper<P2, S2>;
    dive<P2, S2, C2>(options?: ShallowRendererProps): ShallowWrapper<P2, S2, C2>;

    /**
     * Strips out all the not host-nodes from the list of nodes
     *
     * This method is useful if you want to check for the presence of host nodes
     * (actually rendered HTML elements) ignoring the React nodes.
     */
    hostNodes(): ShallowWrapper<HTMLAttributes>;

    /**
     * Returns a wrapper around all of the parents/ancestors of the wrapper. Does not include the node in the
     * current wrapper. Optionally, a selector can be provided and it will filter the parents by this selector.
     *
     * Note: can only be called on a wrapper of a single node.
     */
    parents<P2>(statelessComponent: StatelessComponent<P2>): ShallowWrapper<P2, never>;
    parents<P2>(component: ComponentType<P2>): ShallowWrapper<P2, any>;
    parents(selector: string): ShallowWrapper<HTMLAttributes, any>;
    parents(props?: EnzymePropSelector): ShallowWrapper<any, any>;

    /**
     * Returns a wrapper of the first element that matches the selector by traversing up through the current node's
     * ancestors in the tree, starting with itself.
     *
     * Note: can only be called on a wrapper of a single node.
     */
    closest<P2>(statelessComponent: StatelessComponent<P2>): ShallowWrapper<P2, never>;
    closest<P2>(component: ComponentType<P2>): ShallowWrapper<P2, any>;
    closest(props: EnzymePropSelector): ShallowWrapper<any, any>;
    closest(selector: string): ShallowWrapper<HTMLAttributes, any>;

    /**
     * Returns a wrapper with the direct parent of the node in the current wrapper.
     */
    parent(): ShallowWrapper<any, any>;

    /**
     * Returns a wrapper of the node rendered by the provided render prop.
     */
    renderProp<PropName extends keyof P>(
        prop: PropName
    ): (...params: Parameters<P[PropName]>) => ShallowWrapper<any, never>;

    /**
     * If a wrappingComponent was passed in options,
     * this methods returns a ShallowWrapper around the rendered wrappingComponent.
     * This ShallowWrapper can be used to update the wrappingComponent's props and state
     */
    getWrappingComponent: () => ShallowWrapper;
}

// tslint:disable-next-line no-empty-interface
export interface ReactWrapper<P = {}, S = {}, C = Component> extends CommonWrapper<P, S, C> {}
export class ReactWrapper<P = {}, S = {}, C = Component> {
    constructor(nodes: JSX.Element | JSX.Element[], root?: ReactWrapper<any, any>, options?: MountRendererProps);

    unmount(): this;
    mount(): this;

    /**
     * Returns a wrapper of the node that matches the provided reference name.
     *
     * NOTE: can only be called on a wrapper instance that is also the root instance.
     */
    ref(refName: string): ReactWrapper<any, any>;
    ref<P2, S2>(refName: string): ReactWrapper<P2, S2>;

    /**
     * Detaches the react tree from the DOM. Runs ReactDOM.unmountComponentAtNode() under the hood.
     *
     * This method will most commonly be used as a "cleanup" method if you decide to use the attachTo option in mount(node, options).
     *
     * The method is intentionally not "fluent" (in that it doesn't return this) because you should not be doing anything with this wrapper after this method is called.
     *
     * Using the attachTo is not generally recommended unless it is absolutely necessary to test something.
     * It is your responsibility to clean up after yourself at the end of the test if you do decide to use it, though.
     */
    detach(): void;

    /**
     * Strips out all the not host-nodes from the list of nodes
     *
     * This method is useful if you want to check for the presence of host nodes
     * (actually rendered HTML elements) ignoring the React nodes.
     */
    hostNodes(): ReactWrapper<HTMLAttributes>;

    /**
     * Find every node in the render tree that matches the provided selector.
     * @param selector The selector to match.
     */
    find<P2>(statelessComponent: StatelessComponent<P2>): ReactWrapper<P2, never>;
    find<P2>(component: ComponentType<P2>): ReactWrapper<P2, any>;
    find<C2 extends Component>(
      componentClass: ComponentClass<C2['props']>,
    ): ReactWrapper<C2['props'], C2['state'], C2>;
    find(props: EnzymePropSelector): ReactWrapper<any, any>;
    find(selector: string): ReactWrapper<HTMLAttributes, any>;

    /**
     * Finds every node in the render tree that returns true for the provided predicate function.
     */
    findWhere(predicate: (wrapper: ReactWrapper<any, any>) => boolean): ReactWrapper<any, any>;

    /**
     * Removes nodes in the current wrapper that do not match the provided selector.
     * @param selector The selector to match.
     */
    filter<P2>(statelessComponent: StatelessComponent<P2>): ReactWrapper<P2, never>;
    filter<P2>(component: ComponentType<P2>): ReactWrapper<P2, any>;
    filter(props: EnzymePropSelector | string): ReactWrapper<P, S>;

    /**
     * Returns a new wrapper with all of the children of the node(s) in the current wrapper. Optionally, a selector
     * can be provided and it will filter the children by this selector.
     */
    children<P2>(statelessComponent: StatelessComponent<P2>): ReactWrapper<P2, never>;
    children<P2>(component: ComponentType<P2>): ReactWrapper<P2, any>;
    children(selector: string): ReactWrapper<HTMLAttributes, any>;
    children(props?: EnzymePropSelector): ReactWrapper<any, any>;

    /**
     * Returns a new wrapper with child at the specified index.
     */
    childAt(index: number): ReactWrapper<any, any>;
    childAt<P2, S2>(index: number): ReactWrapper<P2, S2>;

    /**
     * Returns a wrapper around all of the parents/ancestors of the wrapper. Does not include the node in the
     * current wrapper. Optionally, a selector can be provided and it will filter the parents by this selector.
     *
     * Note: can only be called on a wrapper of a single node.
     */
    parents<P2>(statelessComponent: StatelessComponent<P2>): ReactWrapper<P2, never>;
    parents<P2>(component: ComponentType<P2>): ReactWrapper<P2, any>;
    parents(selector: string): ReactWrapper<HTMLAttributes, any>;
    parents(props?: EnzymePropSelector): ReactWrapper<any, any>;

    /**
     * Returns a wrapper of the first element that matches the selector by traversing up through the current node's
     * ancestors in the tree, starting with itself.
     *
     * Note: can only be called on a wrapper of a single node.
     */
    closest<P2>(statelessComponent: StatelessComponent<P2>): ReactWrapper<P2, never>;
    closest<P2>(component: ComponentType<P2>): ReactWrapper<P2, any>;
    closest(props: EnzymePropSelector): ReactWrapper<any, any>;
    closest(selector: string): ReactWrapper<HTMLAttributes, any>;

    /**
     * Returns a wrapper with the direct parent of the node in the current wrapper.
     */
    parent(): ReactWrapper<any, any>;

    /**
     * If a wrappingComponent was passed in options,
     * this methods returns a ReactWrapper around the rendered wrappingComponent.
     * This ReactWrapper can be used to update the wrappingComponent's props and state
     */
    getWrappingComponent: () => ReactWrapper;
}

export interface Lifecycles {
    componentDidUpdate?: {
        onSetState: boolean;
        prevContext: boolean;
    };
    getDerivedStateFromProps?: { hasShouldComponentUpdateBug: boolean } | boolean;
    getChildContext?: {
        calledByRenderer: boolean;
        [key: string]: any;
    };
    setState?: any;
    // TODO Maybe some life cycle are missing
    [lifecycleName: string]: any;
}

export interface ShallowRendererProps {
    // See https://github.com/airbnb/enzyme/blob/enzyme@3.10.0/docs/api/shallow.md#arguments
    /**
     * If set to true, componentDidMount is not called on the component, and componentDidUpdate is not called after
     * setProps and setContext. Default to false.
     */
    disableLifecycleMethods?: boolean;
    /**
     * Enable experimental support for full react lifecycle methods
     */
    lifecycleExperimental?: boolean;
    /**
     * Context to be passed into the component
     */
    context?: any;
    /**
     * The legacy enableComponentDidUpdateOnSetState option should be matched by
     * `lifecycles: { componentDidUpdate: { onSetState: true } }`, for compatibility
     */
    enableComponentDidUpdateOnSetState?: boolean;
    /**
     * the legacy supportPrevContextArgumentOfComponentDidUpdate option should be matched by
     * `lifecycles: { componentDidUpdate: { prevContext: true } }`, for compatibility
     */
    supportPrevContextArgumentOfComponentDidUpdate?: boolean;
    lifecycles?: Lifecycles;
    /**
     * A component that will render as a parent of the node.
     * It can be used to provide context to the `node`, among other things.
     * See the [getWrappingComponent() docs](https://airbnb.io/enzyme/docs/api/ShallowWrapper/getWrappingComponent.html) for an example.
     * **Note**: `wrappingComponent` must render its children.
     */
    wrappingComponent?: ComponentType<any>;
    /**
     * Initial props to pass to the `wrappingComponent` if it is specified.
     */
    wrappingComponentProps?: {};
    /**
     * If set to true, when rendering Suspense enzyme will replace all the lazy components in children
     * with fallback element prop. Otherwise it won't handle fallback of lazy component.
     * Default to true. Note: not supported in React < 16.6.
     */
    suspenseFallback?: boolean;
    adapter?: EnzymeAdapter;
    /* TODO what are these doing??? */
    attachTo?: any;
    hydrateIn?: any;
    PROVIDER_VALUES?: any;
}

export interface MountRendererProps {
    /**
     * Context to be passed into the component
     */
    context?: {};
    /**
     * DOM Element to attach the component to
     */
    attachTo?: HTMLElement | null;
    /**
     * Merged contextTypes for all children of the wrapper
     */
    childContextTypes?: {};
    /**
     * A component that will render as a parent of the node.
     * It can be used to provide context to the `node`, among other things.
     * See the [getWrappingComponent() docs](https://airbnb.io/enzyme/docs/api/ShallowWrapper/getWrappingComponent.html) for an example.
     * **Note**: `wrappingComponent` must render its children.
     */
    wrappingComponent?: ComponentType<any>;
    /**
     * Initial props to pass to the `wrappingComponent` if it is specified.
     */
    wrappingComponentProps?: {};
}

/**
 * Shallow rendering is useful to constrain yourself to testing a component as a unit, and to ensure that
 * your tests aren't indirectly asserting on behavior of child components.
 */
export function shallow<C extends Component, P = C['props'], S = C['state']>(
    node: ReactElement<P>,
    options?: ShallowRendererProps
): ShallowWrapper<P, S, C>;
export function shallow<P>(node: ReactElement<P>, options?: ShallowRendererProps): ShallowWrapper<P, any>;
export function shallow<P, S>(node: ReactElement<P>, options?: ShallowRendererProps): ShallowWrapper<P, S>;

/**
 * Mounts and renders a react component into the document and provides a testing wrapper around it.
 */
export function mount<C extends Component, P = C['props'], S = C['state']>(
    node: ReactElement<P>,
    options?: MountRendererProps
): ReactWrapper<P, S, C>;
export function mount<P>(node: ReactElement<P>, options?: MountRendererProps): ReactWrapper<P, any>;
export function mount<P, S>(node: ReactElement<P>, options?: MountRendererProps): ReactWrapper<P, S>;

/**
 * Render react components to static HTML and analyze the resulting HTML structure.
 */
export function render<P, S>(node: ReactElement<P>, options?: any): Cheerio;

// See https://github.com/airbnb/enzyme/blob/v3.10.0/packages/enzyme/src/EnzymeAdapter.js
export class EnzymeAdapter {
    wrapWithWrappingComponent?: (node: ReactElement, options?: ShallowRendererProps) => any;
}

/**
 * Configure enzyme to use the correct adapter for the react version
 * This is enabling the Enzyme configuration with adapters in TS
 */
export function configure(options: {
    adapter: EnzymeAdapter;
    // See https://github.com/airbnb/enzyme/blob/enzyme@3.10.0/docs/guides/migration-from-2-to-3.md#lifecycle-methods
    // Actually, `{adapter:} & Pick<ShallowRendererProps,"disableLifecycleMethods">` is more precise. However,
    // in that case jsdoc won't be shown
    /**
     * If set to true, componentDidMount is not called on the component, and componentDidUpdate is not called after
     * setProps and setContext. Default to false.
     */
    disableLifecycleMethods?: boolean;
}): void;
