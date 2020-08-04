/**
 * These are types for things that are present in the `experimental` builds of React but not yet
 * on a stable build.
 *
 * Once they are promoted to stable they can just be moved to the main index file.
 *
 * To load the types declared here in an actual project, there are three ways. The easiest one,
 * if your `tsconfig.json` already has a `"types"` array in the `"compilerOptions"` section,
 * is to add `"react-dom/experimental"` to the `"types"` array.
 *
 * Alternatively, a specific import syntax can to be used from a typescript file.
 * This module does not exist in reality, which is why the {} is important:
 *
 * ```ts
 * import {} from 'react-dom/experimental'
 * ```
 *
 * It is also possible to include it through a triple-slash reference:
 *
 * ```ts
 * /// <reference types="react-dom/experimental" />
 * ```
 *
 * Either the import or the reference only needs to appear once, anywhere in the project.
 */

// See https://github.com/facebook/react/blob/master/packages/react-dom/src/client/ReactDOM.js to see how the exports are declared,
// and https://github.com/facebook/react/blob/master/packages/shared/ReactFeatureFlags.js to verify which APIs are
// flagged experimental or not. Experimental APIs will be tagged with `__EXPERIMENTAL__`.

import React = require('react');
import ReactDOM = require('.');

export {};

declare module '.' {
    // enableSuspenseServerRenderer feature
    interface HydrationOptions {
        onHydrated?(suspenseInstance: Comment): void;
        onDeleted?(suspenseInstance: Comment): void;
    }

    // exposeConcurrentModeAPIs features

    interface RootOptions {
        hydrate?: boolean;
        hydrationOptions?: HydrationOptions;
    }

    interface Root {
        render(children: React.ReactChild | React.ReactNodeArray, callback?: () => void): void;
        unmount(callback?: () => void): void;
    }

    /**
     * Replaces `ReactDOM.render` when the `.render` method is called and enables Blocking Mode.
     *
     * Opting into Concurrent Mode introduces semantic changes to how React works.
     * This means that you can’t use Concurrent Mode in just a few components.
     * Because of this, some apps may not be able to migrate directly to Concurrent Mode.
     * Blocking Mode only contains a small subset of Concurrent Mode features and is intended
     * as an intermediary migration step for apps that are unable to migrate directly.
     *
     * @see https://reactjs.org/docs/concurrent-mode-adoption.html#migration-step-blocking-mode
     * @see https://reactjs.org/docs/concurrent-mode-reference.html#createblockingroot
     */
    function unstable_createBlockingRoot(
        container: Element | Document | DocumentFragment | Comment,
        options?: RootOptions,
    ): Root;

    /**
     * Replaces `ReactDOM.render` when the `.render` method is called and enables Concurrent Mode.
     *
     * @see https://reactjs.org/docs/concurrent-mode-reference.html#createroot
     */
    function unstable_createRoot(container: Element | Document | DocumentFragment | Comment, options?: RootOptions): Root;

    function unstable_discreteUpdates<R>(callback: () => R): R;

    function unstable_discreteUpdates<R, A1>(callback: (a1: A1) => R, a1: A1): R;

    function unstable_discreteUpdates<R, A1, A2>(callback: (a1: A1, a2: A2) => R, a1: A1, a2: A2): R;

    function unstable_discreteUpdates<R, A1, A2, A3>(
        callback: (a1: A1, a2: A2, a3: A3) => R,
        a1: A1,
        a2: A2,
        a3: A3,
    ): R;

    function unstable_flushDiscreteUpdates(): void;

    function unstable_flushControlled(callback: () => void): void;

    // enableSelectiveHydration feature

    /**
     * @see https://github.com/facebook/react/commit/3a2b5f148d450c69aab67f055fc441d294c23518
     */
    function unstable_scheduleHydration(target: Element | Document | DocumentFragment | Comment): void;
}
