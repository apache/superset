export default parse;
export interface Options {
    lowerCaseAttributeNames?: boolean;
    lowerCaseTags?: boolean;
    xmlMode?: boolean;
}
export declare type Selector = PseudoSelector | PseudoElement | AttributeSelector | TagSelector | UniversalSelector | Traversal;
export interface AttributeSelector {
    type: "attribute";
    name: string;
    action: AttributeAction;
    value: string;
    ignoreCase: boolean;
}
declare type DataType = Selector[][] | null | string;
export interface PseudoSelector {
    type: "pseudo";
    name: string;
    data: DataType;
}
export interface PseudoElement {
    type: "pseudo-element";
    name: string;
}
export interface TagSelector {
    type: "tag";
    name: string;
}
export interface UniversalSelector {
    type: "universal";
}
export interface Traversal {
    type: TraversalType;
}
export declare type AttributeAction = "any" | "element" | "end" | "equals" | "exists" | "hyphen" | "not" | "start";
export declare type TraversalType = "adjacent" | "child" | "descendant" | "parent" | "sibling";
declare function parse(selector: string, options?: Options): Selector[][];
//# sourceMappingURL=parse.d.ts.map