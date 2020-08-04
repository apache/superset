import { Node, Element } from "domhandler";
export declare function filter(test: (elem: Node) => boolean, element: Node | Node[], recurse?: boolean, limit?: number): Node[];
export declare function find(test: (elem: Node) => boolean, elems: Node[], recurse: boolean, limit: number): Node[];
export declare function findOneChild(test: (elem: Node) => boolean, elems: Node[]): Node | null;
export declare function findOne(test: (elem: Element) => boolean, elems: Node[], recurse?: boolean): Element | null;
export declare function existsOne(test: (elem: Element) => boolean, elems: Node[]): boolean;
export declare function findAll(test: (elem: Element) => boolean, rootElems: Node[]): Element[];
//# sourceMappingURL=querying.d.ts.map