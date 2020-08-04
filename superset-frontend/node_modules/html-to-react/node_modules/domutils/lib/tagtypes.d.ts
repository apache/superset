import { Node, Element, NodeWithChildren, DataNode } from "domhandler";
export declare function isTag(node: Node): node is Element;
export declare function isCDATA(node: Node): node is NodeWithChildren;
export declare function isText(node: Node): node is DataNode;
export declare function isComment(node: Node): node is DataNode;
export declare function hasChildren(node: Node): node is NodeWithChildren;
//# sourceMappingURL=tagtypes.d.ts.map