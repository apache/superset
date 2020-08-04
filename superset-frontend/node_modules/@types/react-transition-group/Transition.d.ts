import { Component, ReactNode } from "react";

export type EndHandler = (node: HTMLElement, done: () => void) => void;
export type EnterHandler = (node: HTMLElement, isAppearing: boolean) => void;
export type ExitHandler = (node: HTMLElement) => void;

export const UNMOUNTED = 'unmounted';
export const EXITED = 'exited';
export const ENTERING = 'entering';
export const ENTERED = 'entered';
export const EXITING = 'exiting';

export interface TransitionActions {
    /**
     * Normally a component is not transitioned if it is shown when the
     * `<Transition>` component mounts. If you want to transition on the first
     * mount set  appear to true, and the component will transition in as soon
     * as the `<Transition>` mounts. Note: there are no specific "appear" states.
     * appear only adds an additional enter transition.
     */
    appear?: boolean;

    /**
     * Enable or disable enter transitions.
     */
    enter?: boolean;

    /**
     * Enable or disable exit transitions.
     */
    exit?: boolean;
}

interface BaseTransitionProps {
    /**
     * Show the component; triggers the enter or exit states
     */
    in?: boolean;

    /**
     * By default the child component is mounted immediately along with the
     * parent Transition component. If you want to "lazy mount" the component on
     * the first `in={true}` you can set `mountOnEnter`. After the first enter
     * transition the component will stay mounted, even on "exited", unless you
     * also specify `unmountOnExit`.
     */
    mountOnEnter?: boolean;

    /**
     * By default the child component stays mounted after it reaches the
     * 'exited' state. Set `unmountOnExit` if you'd prefer to unmount the
     * component after it finishes exiting.
     */
    unmountOnExit?: boolean;

    /**
     * Callback fired before the "entering" status is applied. An extra
     * parameter `isAppearing` is supplied to indicate if the enter stage is
     * occurring on the initial mount
     */
    onEnter?: EnterHandler;

    /**
     * Callback fired after the "entering" status is applied. An extra parameter
     * isAppearing is supplied to indicate if the enter stage is occurring on
     * the initial mount
     */
    onEntering?: EnterHandler;

    /**
     * Callback fired after the "entered" status is applied. An extra parameter
     * isAppearing is supplied to indicate if the enter stage is occurring on
     * the initial mount
     */
    onEntered?: EnterHandler;

    /**
     * Callback fired before the "exiting" status is applied.
     */
    onExit?: ExitHandler;

    /**
     * Callback fired after the "exiting" status is applied.
     */
    onExiting?: ExitHandler;

    /**
     * Callback fired after the "exited" status is applied.
     */
    onExited?: ExitHandler;

    /**
     * A function child can be used instead of a React element. This function is
     * called with the current transition status ('entering', 'entered',
     * 'exiting',  'exited', 'unmounted'), which can be used to apply context
     * specific props to a component.
     * ```jsx
     *    <Transition in={this.state.in} timeout={150}>
     *        {state => (
     *            <MyComponent className={`fade fade-${state}`} />
     *        )}
     *    </Transition>
     * ```
     */
    children?: TransitionChildren;
    [ prop: string ]: any;
}

export type TransitionStatus =
    typeof ENTERING |
    typeof ENTERED |
    typeof EXITING |
    typeof EXITED |
    typeof UNMOUNTED;
export type TransitionChildren = ReactNode | ((status: TransitionStatus) => ReactNode);

interface TimeoutProps extends BaseTransitionProps {
    /**
     * The duration of the transition, in milliseconds. Required unless addEndListener is provided.
     *
     * You may specify a single timeout for all transitions:
     * ```js
     *   timeout={500}
     * ```
     * or individually:
     * ```js
     * timeout={{
     *  appear: 500,
     *  enter: 300,
     *  exit: 500,
     * }}
     * ```
     * - appear defaults to the value of `enter`
     * - enter defaults to `0`
     * - exit defaults to `0`
     */
    timeout: number | { appear?: number, enter?: number, exit?: number };

    /**
     * Add a custom transition end trigger. Called with the transitioning DOM
     * node and a done callback. Allows for more fine grained transition end
     * logic. Note: Timeouts are still used as a fallback if provided.
     */
    addEndListener?: EndHandler;
}

interface EndListenerProps extends BaseTransitionProps {
    /**
     * The duration of the transition, in milliseconds. Required unless addEndListener is provided.
     *
     * You may specify a single timeout for all transitions:
     * ```js
     *   timeout={500}
     * ```
     * or individually:
     * ```js
     * timeout={{
     *  appear: 500,
     *  enter: 300,
     *  exit: 500,
     * }}
     * ```
     * - appear defaults to the value of `enter`
     * - enter defaults to `0`
     * - exit defaults to `0`
     */
    timeout?: number | { appear?: number, enter?: number, exit?: number };
    /**
     * Add a custom transition end trigger. Called with the transitioning DOM
     * node and a done callback. Allows for more fine grained transition end
     * logic. Note: Timeouts are still used as a fallback if provided.
     */
    addEndListener: EndHandler;
}

export type TransitionProps = TimeoutProps | EndListenerProps;

/**
 * The Transition component lets you describe a transition from one component
 * state to another _over time_ with a simple declarative API. Most commonly
 * It's used to animate the mounting and unmounting of Component, but can also
 * be used to describe in-place transition states as well.
 *
 * By default the `Transition` component does not alter the behavior of the
 * component it renders, it only tracks "enter" and "exit" states for the components.
 * It's up to you to give meaning and effect to those states. For example we can
 * add styles to a component when it enters or exits:
 *
 * ```jsx
 * import Transition from 'react-transition-group/Transition';
 *
 * const duration = 300;
 *
 * const defaultStyle = {
 *   transition: `opacity ${duration}ms ease-in-out`,
 *   opacity: 0,
 * }
 *
 * const transitionStyles = {
 *   entering: { opacity: 1 },
 *   entered:  { opacity: 1 },
 * };
 *
 * const Fade = ({ in: inProp }) => (
 *   <Transition in={inProp} timeout={duration}>
 *     {(state) => (
 *       <div style={{
 *         ...defaultStyle,
 *         ...transitionStyles[state]
 *       }}>
 *         I'm A fade Transition!
 *       </div>
 *     )}
 *   </Transition>
 * );
 * ```
 *
 */
declare class Transition extends Component<TransitionProps> {}

export default Transition;
