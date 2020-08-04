import { ElementType } from "domelementtype";
export declare class Node {
    type: ElementType;
    /** Parent of the node */
    parent: NodeWithChildren | null;
    /** Previous sibling */
    prev: Node | null;
    /** Next sibling */
    next: Node | null;
    /** The start index of the node. Requires `withStartIndices` on the handler to be `true. */
    startIndex: number | null;
    /** The end index of the node. Requires `withEndIndices` on the handler to be `true. */
    endIndex: number | null;
    /**
     *
     * @param type The type of the node.
     */
    constructor(type: ElementType);
    readonly nodeType: number;
    parentNode: NodeWithChildren | null;
    previousSibling: Node | null;
    nextSibling: Node | null;
}
export declare class DataNode extends Node {
    data: string;
    /**
     *
     * @param type The type of the node
     * @param data The content of the data node
     */
    constructor(type: ElementType.Comment | ElementType.Text | ElementType.Directive, data: string);
    nodeValue: string;
}
export declare class ProcessingInstruction extends DataNode {
    name: string;
    constructor(name: string, data: string);
}
export declare class NodeWithChildren extends Node {
    children: Node[];
    /**
     *
     * @param type Type of the node.
     * @param children Children of the node. Only certain node types can have children.
     */
    constructor(type: ElementType.CDATA | ElementType.Script | ElementType.Style | ElementType.Tag, children: Node[]);
    readonly firstChild: Node | null;
    readonly lastChild: Node | null;
    childNodes: Node[];
}
export declare class Element extends NodeWithChildren {
    name: string;
    attribs: {
        [name: string]: string;
    };
    /**
     *
     * @param name Name of the tag, eg. `div`, `span`
     * @param attribs Object mapping attribute names to attribute values
     */
    constructor(name: string, attribs: {
        [name: string]: string;
    });
    tagName: string;
}
//# sourceMappingURL=node.d.ts.map