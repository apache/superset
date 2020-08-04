import { TaggedEventHandler } from './addEventListener';
declare function removeEventListener<K extends keyof HTMLElementEventMap>(node: HTMLElement, eventName: K, handler: TaggedEventHandler<K>, options?: boolean | EventListenerOptions): void;
export default removeEventListener;
