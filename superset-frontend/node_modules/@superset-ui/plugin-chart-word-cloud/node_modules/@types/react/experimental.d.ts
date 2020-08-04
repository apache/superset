/**
 * These are types for things that are present in the `experimental` builds of React but not yet
 * on a stable build.
 *
 * Once they are promoted to stable they can just be moved to the main index file.
 *
 * To load the types declared here in an actual project, there are three ways. The easiest one,
 * if your `tsconfig.json` already has a `"types"` array in the `"compilerOptions"` section,
 * is to add `"react/experimental"` to the `"types"` array.
 *
 * Alternatively, a specific import syntax can to be used from a typescript file.
 * This module does not exist in reality, which is why the {} is important:
 *
 * ```ts
 * import {} from 'react/experimental'
 * ```
 *
 * It is also possible to include it through a triple-slash reference:
 *
 * ```ts
 * /// <reference types="react/experimental" />
 * ```
 *
 * Either the import or the reference only needs to appear once, anywhere in the project.
 */

// See https://github.com/facebook/react/blob/master/packages/react/src/React.js to see how the exports are declared,
// and https://github.com/facebook/react/blob/master/packages/shared/ReactFeatureFlags.js to verify which APIs are
// flagged experimental or not. Experimental APIs will be tagged with `__EXPERIMENTAL__`.
//
// For the inputs of types exported as simply a fiber tag, the `beginWork` function of ReactFiberBeginWork.js
// is a good place to start looking for details; it generally calls prop validation functions or delegates
// all tasks done as part of the render phase (the concurrent part of the React update cycle).
//
// Suspense-related handling can be found in ReactFiberThrow.js.

import React = require('.');

export {};

declare module '.' {
    export type SuspenseListRevealOrder = 'forwards' | 'backwards' | 'together';
    export type SuspenseListTailMode = 'collapsed' | 'hidden';

    export interface SuspenseListCommonProps {
        /**
         * Note that SuspenseList require more than one child;
         * it is a runtime warning to provide only a single child.
         *
         * It does, however, allow those children to be wrapped inside a single
         * level of `<React.Fragment>`.
         */
        children: ReactElement | Iterable<ReactElement>;
    }

    interface DirectionalSuspenseListProps extends SuspenseListCommonProps {
        /**
         * Defines the order in which the `SuspenseList` children should be revealed.
         */
        revealOrder: 'forwards' | 'backwards';
        /**
         * Dictates how unloaded items in a SuspenseList is shown.
         *
         * - By default, `SuspenseList` will show all fallbacks in the list.
         * - `collapsed` shows only the next fallback in the list.
         * - `hidden` doesn’t show any unloaded items.
         */
        tail?: SuspenseListTailMode;
    }

    interface NonDirectionalSuspenseListProps extends SuspenseListCommonProps {
        /**
         * Defines the order in which the `SuspenseList` children should be revealed.
         */
        revealOrder?: Exclude<SuspenseListRevealOrder, DirectionalSuspenseListProps['revealOrder']>;
        /**
         * The tail property is invalid when not using the `forwards` or `backwards` reveal orders.
         */
        tail?: never;
    }

    export type SuspenseListProps = DirectionalSuspenseListProps | NonDirectionalSuspenseListProps;

    /**
     * `SuspenseList` helps coordinate many components that can suspend by orchestrating the order
     * in which these components are revealed to the user.
     *
     * When multiple components need to fetch data, this data may arrive in an unpredictable order.
     * However, if you wrap these items in a `SuspenseList`, React will not show an item in the list
     * until previous items have been displayed (this behavior is adjustable).
     *
     * @see https://reactjs.org/docs/concurrent-mode-reference.html#suspenselist
     * @see https://reactjs.org/docs/concurrent-mode-patterns.html#suspenselist
     */
    export const unstable_SuspenseList: ExoticComponent<SuspenseListProps>;

    export interface SuspenseConfig extends TimeoutConfig {
        busyDelayMs?: number;
        busyMinDurationMs?: number;
    }

    // undocumented, considered for removal
    export function unstable_withSuspenseConfig(
        scope: () => void | undefined,
        config: SuspenseConfig | null | undefined,
    ): void;

    export interface TimeoutConfig {
        /**
         * This timeout (in milliseconds) tells React how long to wait before showing the next state.
         *
         * React will always try to use a shorter lag when network and device allows it.
         *
         * **NOTE: We recommend that you share Suspense Config between different modules.**
         */
        timeoutMs: number;
    }

    // must be synchronous
    export type TransitionFunction = () => void | undefined;
    // strange definition to allow vscode to show documentation on the invocation
    export interface TransitionStartFunction {
        /**
         * State updates caused inside the callback are allowed to be deferred.
         *
         * **If some state update causes a component to suspend, that state update should be wrapped in a transition.**
         *
         * @param callback A _synchronous_ function which causes state updates that can be deferred.
         */
        (callback: TransitionFunction): void;
    }

    /**
     * Returns a deferred version of the value that may “lag behind” it for at most `timeoutMs`.
     *
     * This is commonly used to keep the interface responsive when you have something that renders immediately
     * based on user input and something that needs to wait for a data fetch.
     *
     * A good example of this is a text input.
     *
     * @param value The value that is going to be deferred
     * @param config An optional object with `timeoutMs`
     *
     * @see https://reactjs.org/docs/concurrent-mode-reference.html#usedeferredvalue
     */
    export function unstable_useDeferredValue<T>(value: T, config?: TimeoutConfig | null): T;

    /**
     * Allows components to avoid undesirable loading states by waiting for content to load
     * before transitioning to the next screen. It also allows components to defer slower,
     * data fetching updates until subsequent renders so that more crucial updates can be
     * rendered immediately.
     *
     * The `useTransition` hook returns two values in an array.
     *
     * The first is a function that takes a callback. We can use it to tell React which state we want to defer.
     * The seconda boolean. It’s React’s way of informing us whether we’re waiting for the transition to finish.
     *
     * **If some state update causes a component to suspend, that state update should be wrapped in a transition.**
     *
     * @param config An optional object with `timeoutMs`
     *
     * @see https://reactjs.org/docs/concurrent-mode-reference.html#usetransition
     */
    export function unstable_useTransition(config?: SuspenseConfig | null): [TransitionStartFunction, boolean];
}
