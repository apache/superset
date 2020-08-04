import { Component } from 'react';
import { TransitionProps } from "./Transition";

export interface CSSTransitionClassNames {
    appear?: string;
    appearActive?: string;
    appearDone?: string;
    enter?: string;
    enterActive?: string;
    enterDone?: string;
    exit?: string;
    exitActive?: string;
    exitDone?: string;
}

export type CSSTransitionProps = TransitionProps & {
    /**
     * The animation `classNames` applied to the component as it enters or exits.
     * A single name can be provided and it will be suffixed for each stage: e.g.
     *
     * `classNames="fade"` applies `fade-enter`, `fade-enter-active`,
     * `fade-exit`, `fade-exit-active`, `fade-appear`, and `fade-appear-active`.
     *
     * Each individual classNames can also be specified independently like:
     *
     * ```js
     * classNames={{
     *   appear: 'my-appear',
     *   appearActive: 'my-appear-active',
     *   appearDone: 'my-appear-done',
     *   enter: 'my-enter',
     *   enterActive: 'my-enter-active',
     *   enterDone: 'my-enter-done',
     *   exit: 'my-exit',
     *   exitActive: 'my-exit-active',
     *   exitDone: 'my-exit-done'
     * }}
     * ```
     */
    classNames?: string | CSSTransitionClassNames;
};

declare class CSSTransition extends Component<CSSTransitionProps> {}

export default CSSTransition;
