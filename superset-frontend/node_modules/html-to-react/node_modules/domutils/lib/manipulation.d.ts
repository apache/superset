import { Node, Element } from "domhandler";
/***
 * Remove an element from the dom
 *
 * @argument elem The element to be removed
 */
export declare function removeElement(elem: Node): void;
/***
 * Replace an element in the dom
 *
 * @argument elem The element to be replaced
 * @argument replacement The element to be added
 */
export declare function replaceElement(elem: Node, replacement: Node): void;
/***
 * Append a child to an element
 *
 * @argument elem The element to append to
 * @argument child The element to be added as a child
 */
export declare function appendChild(elem: Element, child: Node): void;
/***
 * Append an element after another
 *
 * @argument elem The element to append to
 * @argument next The element be added
 */
export declare function append(elem: Node, next: Node): void;
/***
 * Prepend an element before another
 *
 * @argument elem The element to append to
 * @argument prev The element be added
 */
export declare function prepend(elem: Node, prev: Node): void;
//# sourceMappingURL=manipulation.d.ts.map