import { Node, Element, DataNode, NodeWithChildren } from "./node";
export { Node, NodeWithChildren, DataNode, Element };
export interface DomHandlerOptions {
    /***
     * Indicates whether the whitespace in text nodes should be normalized
     * (= all whitespace should be replaced with single spaces). The default value is "false".
     */
    normalizeWhitespace?: boolean;
    /***
     * Indicates whether a startIndex property will be added to nodes.
     * When the parser is used in a non-streaming fashion, startIndex is an integer
     * indicating the position of the start of the node in the document.
     * The default value is "false".
     */
    withStartIndices?: boolean;
    /***
     * Indicates whether a endIndex property will be added to nodes.
     * When the parser is used in a non-streaming fashion, endIndex is an integer
     * indicating the position of the end of the node in the document.
     * The default value is "false".
     */
    withEndIndices?: boolean;
}
interface ParserInterface {
    startIndex: number | null;
    endIndex: number | null;
}
declare type Callback = (error: Error | null, dom: Node[]) => void;
declare type ElementCallback = (element: Element) => void;
export declare class DomHandler {
    /** The constructed DOM */
    dom: Node[];
    /** Called once parsing has completed. */
    private _callback;
    /** Settings for the handler. */
    private _options;
    /** Callback whenever a tag is closed. */
    private _elementCB;
    /** Indicated whether parsing has been completed. */
    private _done;
    /** Stack of open tags. */
    private _tagStack;
    /** A data node that is still being written to. */
    private _lastNode;
    /** Reference to the parser instance. Used for location information. */
    private _parser;
    /**
     * Initiate a new DomHandler.
     *
     * @param callback Called once parsing has completed.
     * @param options Settings for the handler.
     * @param elementCB Callback whenever a tag is closed.
     */
    constructor(callback?: Callback | null, options?: DomHandlerOptions | null, elementCB?: ElementCallback);
    onparserinit(parser: ParserInterface): void;
    onreset(): void;
    onend(): void;
    onerror(error: Error): void;
    onclosetag(): void;
    onopentag(name: string, attribs: {
        [key: string]: string;
    }): void;
    ontext(data: string): void;
    oncomment(data: string): void;
    oncommentend(): void;
    oncdatastart(): void;
    oncdataend(): void;
    onprocessinginstruction(name: string, data: string): void;
    protected handleCallback(error: Error | null): void;
    protected addNode(node: Node): void;
    protected addDataNode(node: DataNode): void;
}
export default DomHandler;
//# sourceMappingURL=index.d.ts.map