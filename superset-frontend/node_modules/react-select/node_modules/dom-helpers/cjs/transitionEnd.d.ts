export declare type Listener = (this: HTMLElement, ev: TransitionEvent) => any;
export declare const TRANSITION_SUPPORTED: boolean;
export declare function parseDuration(node: HTMLElement): number;
declare function transitionEnd(element: HTMLElement, handler: Listener, duration?: number): () => void;
export default transitionEnd;
