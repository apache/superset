import { ElementType } from "domelementtype";
import {
    Node,
    Element,
    DataNode,
    NodeWithChildren,
    ProcessingInstruction
} from "./node";

export { Node, NodeWithChildren, DataNode, Element };

const reWhitespace = /\s+/g;

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

// Default options
const defaultOpts: DomHandlerOptions = {
    normalizeWhitespace: false,
    withStartIndices: false,
    withEndIndices: false
};

interface ParserInterface {
    startIndex: number | null;
    endIndex: number | null;
}

type Callback = (error: Error | null, dom: Node[]) => void;
type ElementCallback = (element: Element) => void;

export class DomHandler {
    /** The constructed DOM */
    public dom: Node[] = [];

    /** Called once parsing has completed. */
    private _callback: Callback | null;

    /** Settings for the handler. */
    private _options: DomHandlerOptions;

    /** Callback whenever a tag is closed. */
    private _elementCB: ElementCallback | null;

    /** Indicated whether parsing has been completed. */
    private _done: boolean = false;

    /** Stack of open tags. */
    private _tagStack: Element[] = [];

    /** A data node that is still being written to. */
    private _lastNode: DataNode | null = null;

    /** Reference to the parser instance. Used for location information. */
    private _parser: ParserInterface | null = null;

    /**
     * Initiate a new DomHandler.
     *
     * @param callback Called once parsing has completed.
     * @param options Settings for the handler.
     * @param elementCB Callback whenever a tag is closed.
     */
    public constructor(
        callback?: Callback | null,
        options?: DomHandlerOptions | null,
        elementCB?: ElementCallback
    ) {
        // Make it possible to skip arguments, for backwards-compatibility
        if (typeof options === "function") {
            elementCB = options;
            options = defaultOpts;
        }
        if (typeof callback === "object") {
            options = callback;
            callback = undefined;
        }

        this._callback = callback || null;
        this._options = options || defaultOpts;
        this._elementCB = elementCB || null;
    }

    public onparserinit(parser: ParserInterface): void {
        this._parser = parser;
    }

    // Resets the handler back to starting state
    public onreset(): void {
        this.dom = [];
        this._done = false;
        this._tagStack = [];
        this._lastNode = null;
        this._parser = this._parser || null;
    }

    // Signals the handler that parsing is done
    public onend(): void {
        if (this._done) return;
        this._done = true;
        this._parser = null;
        this.handleCallback(null);
    }

    public onerror(error: Error): void {
        this.handleCallback(error);
    }

    public onclosetag(): void {
        this._lastNode = null;

        // If(this._tagStack.pop().name !== name) this.handleCallback(Error("Tagname didn't match!"));
        const elem = this._tagStack.pop();

        if (!elem || !this._parser) {
            return;
        }

        if (this._options.withEndIndices) {
            elem.endIndex = this._parser.endIndex;
        }

        if (this._elementCB) this._elementCB(elem);
    }

    public onopentag(name: string, attribs: { [key: string]: string }): void {
        const element = new Element(name, attribs);
        this.addNode(element);
        this._tagStack.push(element);
    }

    public ontext(data: string): void {
        const normalize = this._options.normalizeWhitespace;

        const { _lastNode } = this;

        if (_lastNode && _lastNode.type === ElementType.Text) {
            if (normalize) {
                _lastNode.data = (_lastNode.data + data).replace(
                    reWhitespace,
                    " "
                );
            } else {
                _lastNode.data += data;
            }
        } else {
            if (normalize) {
                data = data.replace(reWhitespace, " ");
            }

            const node = new DataNode(ElementType.Text, data);
            this.addNode(node);
            this._lastNode = node;
        }
    }

    public oncomment(data: string): void {
        if (this._lastNode && this._lastNode.type === ElementType.Comment) {
            this._lastNode.data += data;
            return;
        }

        const node = new DataNode(ElementType.Comment, data);
        this.addNode(node);
        this._lastNode = node;
    }

    public oncommentend(): void {
        this._lastNode = null;
    }

    public oncdatastart(): void {
        const text = new DataNode(ElementType.Text, "");
        const node = new NodeWithChildren(ElementType.CDATA, [text]);

        this.addNode(node);

        text.parent = node;
        this._lastNode = text;
    }

    public oncdataend(): void {
        this._lastNode = null;
    }

    public onprocessinginstruction(name: string, data: string): void {
        const node = new ProcessingInstruction(name, data);
        this.addNode(node);
    }

    protected handleCallback(error: Error | null): void {
        if (typeof this._callback === "function") {
            this._callback(error, this.dom);
        } else if (error) {
            throw error;
        }
    }

    protected addNode(node: Node) {
        const parent = this._tagStack[this._tagStack.length - 1];
        const siblings = parent ? parent.children : this.dom;
        const previousSibling = siblings[siblings.length - 1];

        if (this._parser) {
            if (this._options.withStartIndices) {
                node.startIndex = this._parser.startIndex;
            }

            if (this._options.withEndIndices) {
                node.endIndex = this._parser.endIndex;
            }
        }

        siblings.push(node);

        if (previousSibling) {
            node.prev = previousSibling;
            previousSibling.next = node;
        }

        if (parent) {
            node.parent = parent;
        }

        this._lastNode = null;
    }

    protected addDataNode(node: DataNode): void {
        this.addNode(node);
        this._lastNode = node;
    }
}

export default DomHandler;
