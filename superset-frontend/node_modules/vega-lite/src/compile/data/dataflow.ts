import {DataSourceType} from '../../data';
import {Dict, uniqueId} from '../../util';

/**
 * A node in the dataflow tree.
 */
export abstract class DataFlowNode {
  private _children: DataFlowNode[] = [];

  private _parent: DataFlowNode = null;

  protected _hash: string | number;

  constructor(parent: DataFlowNode, public readonly debugName?: string) {
    if (parent) {
      this.parent = parent;
    }
  }

  /**
   * Clone this node with a deep copy but don't clone links to children or parents.
   */
  public clone(): DataFlowNode {
    throw new Error('Cannot clone node');
  }

  /**
   * Return a hash of the node.
   */
  public abstract hash(): string | number;

  /**
   * Set of fields that this node depends on.
   */
  public abstract dependentFields(): Set<string>;

  /**
   * Set of fields that are being created by this node.
   */
  public abstract producedFields(): Set<string>;

  get parent() {
    return this._parent;
  }

  /**
   * Set the parent of the node and also add this node to the parent's children.
   */
  set parent(parent: DataFlowNode) {
    this._parent = parent;
    if (parent) {
      parent.addChild(this);
    }
  }

  get children() {
    return this._children;
  }

  public numChildren() {
    return this._children.length;
  }

  public addChild(child: DataFlowNode, loc?: number) {
    // do not add the same child twice
    if (this._children.indexOf(child) > -1) {
      console.warn('Attempt to add the same child twice.');
      return;
    }

    if (loc !== undefined) {
      this._children.splice(loc, 0, child);
    } else {
      this._children.push(child);
    }
  }

  public removeChild(oldChild: DataFlowNode) {
    const loc = this._children.indexOf(oldChild);
    this._children.splice(loc, 1);
    return loc;
  }

  /**
   * Remove node from the dataflow.
   */
  public remove() {
    let loc = this._parent.removeChild(this);
    for (const child of this._children) {
      // do not use the set method because we want to insert at a particular location
      child._parent = this._parent;
      this._parent.addChild(child, loc++);
    }
  }

  /**
   * Insert another node as a parent of this node.
   */
  public insertAsParentOf(other: DataFlowNode) {
    const parent = other.parent;
    parent.removeChild(this);
    this.parent = parent;
    other.parent = this;
  }

  public swapWithParent() {
    const parent = this._parent;
    const newParent = parent.parent;

    // reconnect the children
    for (const child of this._children) {
      child.parent = parent;
    }

    // remove old links
    this._children = []; // equivalent to removing every child link one by one
    parent.removeChild(this);
    parent.parent.removeChild(parent);

    // swap two nodes
    this.parent = newParent;
    parent.parent = this;
  }
}

export class OutputNode extends DataFlowNode {
  private _source: string;

  private _name: string;

  public clone(): this {
    const cloneObj = new (this.constructor as any)();
    cloneObj.debugName = 'clone_' + this.debugName;
    cloneObj._source = this._source;
    cloneObj._name = 'clone_' + this._name;
    cloneObj.type = this.type;
    cloneObj.refCounts = this.refCounts;
    cloneObj.refCounts[cloneObj._name] = 0;
    return cloneObj;
  }

  /**
   * @param source The name of the source. Will change in assemble.
   * @param type The type of the output node.
   * @param refCounts A global ref counter map.
   */
  constructor(
    parent: DataFlowNode,
    source: string,
    public readonly type: DataSourceType,
    private readonly refCounts: Dict<number>
  ) {
    super(parent, source);

    this._source = this._name = source;

    if (this.refCounts && !(this._name in this.refCounts)) {
      this.refCounts[this._name] = 0;
    }
  }

  public dependentFields() {
    return new Set<string>();
  }

  public producedFields() {
    return new Set<string>();
  }

  public hash() {
    if (this._hash === undefined) {
      this._hash = `Output ${uniqueId()}`;
    }
    return this._hash;
  }

  /**
   * Request the datasource name and increase the ref counter.
   *
   * During the parsing phase, this will return the simple name such as 'main' or 'raw'.
   * It is crucial to request the name from an output node to mark it as a required node.
   * If nobody ever requests the name, this datasource will not be instantiated in the assemble phase.
   *
   * In the assemble phase, this will return the correct name.
   */
  public getSource() {
    this.refCounts[this._name]++;
    return this._source;
  }

  public isRequired(): boolean {
    return !!this.refCounts[this._name];
  }

  public setSource(source: string) {
    this._source = source;
  }
}
