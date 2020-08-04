// Type definitions for react-loadable 5.5
// Project: https://github.com/thejameskyle/react-loadable#readme
// Definitions by: Jessica Franco <https://github.com/Jessidhia>
//                 Oden S. <https://github.com/odensc>
//                 Ian Ker-Seymer <https://github.com/ianks>
//                 Tomek Łaziuk <https://github.com/tlaziuk>
//                 Ian Mobley <https://github.com/iMobs>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.8

/// <reference types="react" />

declare namespace LoadableExport {
    interface LoadingComponentProps {
        isLoading: boolean;
        pastDelay: boolean;
        timedOut: boolean;
        error: any;
        retry: () => void;
    }

    type Options<Props, Exports extends object> = OptionsWithoutRender<Props> | OptionsWithRender<Props, Exports>;

    interface CommonOptions {
        /**
         * React component displayed after delay until loader() succeeds. Also responsible for displaying errors.
         *
         * If you don't want to render anything you can pass a function that returns null
         * (this is considered a valid React component).
         */
        loading: React.ComponentType<LoadingComponentProps>;
        /**
         * Defaults to 200, in milliseconds.
         *
         * Only show the loading component if the loader() has taken this long to succeed or error.
         */
        delay?: number | false | null;
        /**
         * Disabled by default.
         *
         * After the specified time in milliseconds passes, the component's `timedOut` prop will be set to true.
         */
        timeout?: number | false | null;

        /**
         * Optional array of module paths that `Loadable.Capture`'s `report` function will be applied on during
         * server-side rendering. This helps the server know which modules were imported/used during SSR.
         * ```ts
         * Loadable({
         *   loader: () => import('./my-component'),
         *   modules: ['./my-component'],
         * });
         * ```
         */
        modules?: string[];

        /**
         * An optional function which returns an array of Webpack module ids which you can get
         * with require.resolveWeak. This is used by the client (inside `Loadable.preloadReady`) to
         * guarantee each webpack module is preloaded before the first client render.
         * ```ts
         * Loadable({
         *  loader: () => import('./Foo'),
         *  webpack: () => [require.resolveWeak('./Foo')],
         * });
         * ```
         */
        webpack?: () => Array<string | number>;
    }

    interface OptionsWithoutRender<Props> extends CommonOptions {
        /**
         * Function returning a promise which returns a React component displayed on success.
         *
         * Resulting React component receives all the props passed to the generated component.
         */
        loader(): Promise<React.ComponentType<Props> | { default: React.ComponentType<Props> }>;
    }

    interface OptionsWithRender<Props, Exports extends object> extends CommonOptions {
        /**
         * Function returning a promise which returns an object to be passed to `render` on success.
         */
        loader(): Promise<Exports>;
        /**
         * If you want to customize what gets rendered from your loader you can also pass `render`.
         *
         * Note: If you want to load multiple resources at once, you can also use `Loadable.Map`.
         *
         * ```ts
         * Loadable({
         *     // ...
         *     render(loaded, props) {
         *         const Component = loaded.default;
         *         return <Component {...props} />
         *     }
         * });
         * ```
         */
        render(loaded: Exports, props: Props): React.ReactNode;

        // NOTE: render is not optional if the loader return type is not compatible with the type
        // expected in `OptionsWithoutRender`. If you do not want to provide a render function, ensure that your
        // function is returning a promise for a React.ComponentType or is the result of import()ing a module
        // that has a component as its `default` export.
    }

    interface OptionsWithMap<Props, Exports extends { [key: string]: any }> extends CommonOptions {
        /**
         * An object containing functions which return promises, which resolve to an object to be passed to `render` on success.
         */
        loader: {
            [P in keyof Exports]: () => Promise<Exports[P]>
        };
        /**
         * If you want to customize what gets rendered from your loader you can also pass `render`.
         *
         * Note: If you want to load multiple resources at once, you can also use `Loadable.Map`.
         *
         * ```ts
         * Loadable({
         *     // ...
         *     render(loaded, props) {
         *         const Component = loaded.default;
         *         return <Component {...props} />
         *     }
         * });
         * ```
         */
        render(loaded: Exports, props: Props): React.ReactNode;
    }

    interface LoadableComponent {
        /**
         * The generated component has a static method preload() for calling the loader function ahead of time.
         * This is useful for scenarios where you think the user might do something next and want to load the
         * next component eagerly.
         *
         * Note: preload() intentionally does not return a promise. You should not be depending on the timing of
         * preload(). It's meant as a performance optimization, not for creating UI logic.
         */
        preload(): void;
    }

    interface LoadableCaptureProps {
        /**
         * Function called for every moduleName that is rendered via React Loadable.
         */
        report: (moduleName: string) => void;
    }

    interface Loadable {
        <Props, Exports extends object>(options: Options<Props, Exports>): React.ComponentType<Props> & LoadableComponent;
        Map<Props, Exports extends { [key: string]: any }>(options: OptionsWithMap<Props, Exports>): React.ComponentType<Props> & LoadableComponent;

        /**
         * This will call all of the LoadableComponent.preload methods recursively until they are all
         * resolved. Allowing you to preload all of your dynamic modules in environments like the server.
         * ```ts
         * Loadable.preloadAll().then(() => {
         *   app.listen(3000, () => {
         *     console.log('Running on http://localhost:3000/');
         *   });
         * });
         * ```
         */
        preloadAll(): Promise<void>;

        /**
         * Check for modules that are already loaded in the browser and call the matching
         * `LoadableComponent.preload` methods.
         * ```ts
         * window.main = () => {
         *   Loadable.preloadReady().then(() => {
         *     ReactDOM.hydrate(
         *       <App/>,
         *       document.getElementById('app'),
         *     );
         *   });
         * };
         * ```
         */
        preloadReady(): Promise<void>;

        Capture: React.ComponentType<LoadableCaptureProps>;
    }
}

declare const LoadableExport: LoadableExport.Loadable;

/* tslint:disable-next-line */
declare module "react-loadable" {
    export = LoadableExport;
}
