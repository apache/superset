import {MAIN, Parse} from '../../data';
import {Dict, fieldIntersection, hash, hasIntersection, keys, some} from '../../util';
import {Model} from '../model';
import {AggregateNode} from './aggregate';
import {BinNode} from './bin';
import {DataFlowNode, OutputNode} from './dataflow';
import {FacetNode} from './facet';
import {FilterNode} from './filter';
import {ParseNode} from './formatparse';
import {JoinAggregateTransformNode} from './joinaggregate';
import {FACET_SCALE_PREFIX} from './optimize';
import {BottomUpOptimizer, isDataSourceNode, TopDownOptimizer} from './optimizer';
import * as optimizers from './optimizers';
import {StackNode} from './stack';
import {TimeUnitNode} from './timeunit';
import {WindowTransformNode} from './window';
import {IdentifierNode} from './identifier';
import {requiresSelectionId} from '../selection';

export interface OptimizerFlags {
  /**
   * If true, iteration continues.
   */
  continueFlag: boolean;
  /**
   * If true, the tree has been mutated by the function.
   */
  mutatedFlag: boolean;
}

/**
 * Move parse nodes up to forks.
 */
export class MoveParseUp extends BottomUpOptimizer {
  public run(node: DataFlowNode): OptimizerFlags {
    const parent = node.parent;
    // Move parse up by merging or swapping.
    if (node instanceof ParseNode) {
      if (isDataSourceNode(parent)) {
        return this.flags;
      }

      if (parent.numChildren() > 1) {
        // Don't move parse further up but continue with parent.
        this.setContinue();
        return this.flags;
      }

      if (parent instanceof ParseNode) {
        this.setMutated();
        parent.merge(node);
      } else {
        // Don't swap with nodes that produce something that the parse node depends on (e.g. lookup).
        if (fieldIntersection(parent.producedFields(), node.dependentFields())) {
          this.setContinue();
          return this.flags;
        }
        this.setMutated();
        node.swapWithParent();
      }
    }
    this.setContinue();
    return this.flags;
  }
}

/**
 * Merge identical nodes at forks by comparing hashes.
 *
 * Does not need to iterate from leaves so we implement this with recursion as it's a bit simpler.
 */
export class MergeIdenticalNodes extends TopDownOptimizer {
  public mergeNodes(parent: DataFlowNode, nodes: DataFlowNode[]) {
    const mergedNode = nodes.shift();
    for (const node of nodes) {
      parent.removeChild(node);
      node.parent = mergedNode;
      node.remove();
    }
  }

  public run(node: DataFlowNode): boolean {
    const hashes = node.children.map(x => x.hash());
    const buckets: {hash?: DataFlowNode[]} = {};

    for (let i = 0; i < hashes.length; i++) {
      if (buckets[hashes[i]] === undefined) {
        buckets[hashes[i]] = [node.children[i]];
      } else {
        buckets[hashes[i]].push(node.children[i]);
      }
    }

    for (const k of keys(buckets)) {
      if (buckets[k].length > 1) {
        this.setMutated();
        this.mergeNodes(node, buckets[k]);
      }
    }
    for (const child of node.children) {
      this.run(child);
    }
    return this.mutatedFlag;
  }
}

/**
 * Repeatedly remove leaf nodes that are not output or facet nodes.
 * The reason is that we don't need subtrees that don't have any output nodes.
 * Facet nodes are needed for the row or column domains.
 */
export class RemoveUnusedSubtrees extends BottomUpOptimizer {
  public run(node: DataFlowNode): OptimizerFlags {
    if (node instanceof OutputNode || node.numChildren() > 0 || node instanceof FacetNode) {
      // no need to continue with parent because it is output node or will have children (there was a fork)
      return this.flags;
    } else {
      this.setMutated();
      node.remove();
    }
    return this.flags;
  }
}

/**
 * Removes duplicate time unit nodes (as determined by the name of the
 * output field) that may be generated due to selections projected over
 * time units.
 *
 * TODO: Try to make this a top down optimizer that keeps only the first
 * insance of a time unit node.
 * TODO: Try to make a generic version of this that only keeps one node per hash.
 */
export class RemoveDuplicateTimeUnits extends BottomUpOptimizer {
  private fields = new Set<string>();
  private prev: DataFlowNode = null;
  public run(node: DataFlowNode): OptimizerFlags {
    this.setContinue();
    if (node instanceof TimeUnitNode) {
      const pfields = node.producedFields();
      if (hasIntersection(pfields, this.fields)) {
        this.setMutated();
        this.prev.remove();
      } else {
        this.fields = new Set([...this.fields, ...pfields]);
      }
      this.prev = node;
    }
    return this.flags;
  }

  public reset(): void {
    this.fields.clear();
  }
}

/**
 * Merge adjacent time unit nodes.
 */
export class MergeTimeUnits extends BottomUpOptimizer {
  public run(node: DataFlowNode): OptimizerFlags {
    this.setContinue();
    const parent = node.parent;
    const timeUnitChildren = parent.children.filter(x => x instanceof TimeUnitNode) as TimeUnitNode[];
    const combination = timeUnitChildren.pop();
    for (const timeUnit of timeUnitChildren) {
      this.setMutated();
      combination.merge(timeUnit);
    }
    return this.flags;
  }
}

/**
 * Clones the subtree and ignores output nodes except for the leaves, which are renamed.
 */
function cloneSubtree(facet: FacetNode) {
  function clone(node: DataFlowNode): DataFlowNode[] {
    if (!(node instanceof FacetNode)) {
      const copy = node.clone();

      if (copy instanceof OutputNode) {
        const newName = FACET_SCALE_PREFIX + copy.getSource();
        copy.setSource(newName);

        facet.model.component.data.outputNodes[newName] = copy;
      } else if (
        copy instanceof AggregateNode ||
        copy instanceof StackNode ||
        copy instanceof WindowTransformNode ||
        copy instanceof JoinAggregateTransformNode
      ) {
        copy.addDimensions(facet.fields);
      }
      node.children.flatMap(clone).forEach((n: DataFlowNode) => (n.parent = copy));

      return [copy];
    }

    return node.children.flatMap(clone);
  }
  return clone;
}

/**
 * Move facet nodes down to the next fork or output node. Also pull the main output with the facet node.
 * After moving down the facet node, make a copy of the subtree and make it a child of the main output.
 */
export function moveFacetDown(node: DataFlowNode) {
  if (node instanceof FacetNode) {
    if (node.numChildren() === 1 && !(node.children[0] instanceof OutputNode)) {
      // move down until we hit a fork or output node
      const child = node.children[0];

      if (
        child instanceof AggregateNode ||
        child instanceof StackNode ||
        child instanceof WindowTransformNode ||
        child instanceof JoinAggregateTransformNode
      ) {
        child.addDimensions(node.fields);
      }

      child.swapWithParent();
      moveFacetDown(node);
    } else {
      // move main to facet

      const facetMain = node.model.component.data.main;
      moveMainDownToFacet(facetMain);

      // replicate the subtree and place it before the facet's main node
      const cloner = cloneSubtree(node);
      const copy: DataFlowNode[] = node.children.map(cloner).flat();
      for (const c of copy) {
        c.parent = facetMain;
      }
    }
  } else {
    node.children.map(moveFacetDown);
  }
}

function moveMainDownToFacet(node: DataFlowNode) {
  if (node instanceof OutputNode && node.type === MAIN) {
    if (node.numChildren() === 1) {
      const child = node.children[0];
      if (!(child instanceof FacetNode)) {
        child.swapWithParent();
        moveMainDownToFacet(node);
      }
    }
  }
}

/**
 * Remove output nodes that are not required. Starting from a root.
 */
export class RemoveUnnecessaryOutputNodes extends TopDownOptimizer {
  constructor() {
    super();
  }

  public run(node: DataFlowNode): boolean {
    if (node instanceof OutputNode && !node.isRequired()) {
      this.setMutated();
      node.remove();
    }

    for (const child of node.children) {
      this.run(child);
    }

    return this.mutatedFlag;
  }
}

export class RemoveUnnecessaryIdentifierNodes extends TopDownOptimizer {
  private requiresSelectionId: boolean;
  constructor(model: Model) {
    super();
    this.requiresSelectionId = model && requiresSelectionId(model);
  }

  public run(node: DataFlowNode): boolean {
    if (node instanceof IdentifierNode) {
      // Only preserve IdentifierNodes if we have default discrete selections
      // in our model tree, and if the nodes come after tuple producing nodes.
      if (
        !(
          this.requiresSelectionId &&
          (isDataSourceNode(node.parent) || node.parent instanceof AggregateNode || node.parent instanceof ParseNode)
        )
      ) {
        this.setMutated();
        node.remove();
      }
    }

    for (const child of node.children) {
      this.run(child);
    }

    return this.mutatedFlag;
  }
}

/**
 * Inserts an intermediate ParseNode containing all non-conflicting parse fields and removes the empty ParseNodes.
 *
 * We assume that dependent paths that do not have a parse node can be just merged.
 */
export class MergeParse extends BottomUpOptimizer {
  public run(node: DataFlowNode): optimizers.OptimizerFlags {
    const parent = node.parent;
    const originalChildren = [...parent.children];
    const parseChildren = parent.children.filter((child): child is ParseNode => child instanceof ParseNode);

    if (parent.numChildren() > 1 && parseChildren.length >= 1) {
      const commonParse: Parse = {};
      const conflictingParse = new Set<string>();
      for (const parseNode of parseChildren) {
        const parse = parseNode.parse;
        for (const k of keys(parse)) {
          if (!(k in commonParse)) {
            commonParse[k] = parse[k];
          } else if (commonParse[k] !== parse[k]) {
            conflictingParse.add(k);
          }
        }
      }

      for (const field of conflictingParse) {
        delete commonParse[field];
      }

      if (keys(commonParse).length !== 0) {
        this.setMutated();
        const mergedParseNode = new ParseNode(parent, commonParse);
        for (const childNode of originalChildren) {
          if (childNode instanceof ParseNode) {
            for (const key of keys(commonParse)) {
              delete childNode.parse[key];
            }
          }

          parent.removeChild(childNode);
          childNode.parent = mergedParseNode;

          // remove empty parse nodes
          if (childNode instanceof ParseNode && keys(childNode.parse).length === 0) {
            childNode.remove();
          }
        }
      }
    }

    this.setContinue();
    return this.flags;
  }
}

export class MergeAggregates extends BottomUpOptimizer {
  public run(node: DataFlowNode): optimizers.OptimizerFlags {
    const parent = node.parent;
    const aggChildren = parent.children.filter((child): child is AggregateNode => child instanceof AggregateNode);

    // Object which we'll use to map the fields which an aggregate is grouped by to
    // the set of aggregates with that grouping. This is useful as only aggregates
    // with the same group by can be merged
    const groupedAggregates: Dict<AggregateNode[]> = {};

    // Build groupedAggregates
    for (const agg of aggChildren) {
      const groupBys = hash(agg.groupBy);
      if (!(groupBys in groupedAggregates)) {
        groupedAggregates[groupBys] = [];
      }
      groupedAggregates[groupBys].push(agg);
    }

    // Merge aggregateNodes with same key in groupedAggregates
    for (const group of keys(groupedAggregates)) {
      const mergeableAggs = groupedAggregates[group];
      if (mergeableAggs.length > 1) {
        const mergedAggs = mergeableAggs.pop();
        for (const agg of mergeableAggs) {
          if (mergedAggs.merge(agg)) {
            parent.removeChild(agg);
            agg.parent = mergedAggs;
            agg.remove();

            this.setMutated();
          }
        }
      }
    }

    this.setContinue();
    return this.flags;
  }
}

/**
 * Merge bin nodes and move them up through forks. Stop at filters, parse, identifier as we want them to stay before the bin node.
 */
export class MergeBins extends BottomUpOptimizer {
  constructor(private model: Model) {
    super();
  }
  public run(node: DataFlowNode): OptimizerFlags {
    const parent = node.parent;
    const moveBinsUp = !(
      isDataSourceNode(parent) ||
      parent instanceof FilterNode ||
      parent instanceof ParseNode ||
      parent instanceof IdentifierNode
    );

    const promotableBins: BinNode[] = [];
    const remainingBins: BinNode[] = [];

    for (const child of parent.children) {
      if (child instanceof BinNode) {
        if (moveBinsUp && !fieldIntersection(parent.producedFields(), child.dependentFields())) {
          promotableBins.push(child);
        } else {
          remainingBins.push(child);
        }
      }
    }

    if (promotableBins.length > 0) {
      const promotedBin = promotableBins.pop();
      for (const bin of promotableBins) {
        promotedBin.merge(bin, this.model.renameSignal.bind(this.model));
      }
      this.setMutated();
      if (parent instanceof BinNode) {
        parent.merge(promotedBin, this.model.renameSignal.bind(this.model));
      } else {
        promotedBin.swapWithParent();
      }
    }
    if (remainingBins.length > 1) {
      const remainingBin = remainingBins.pop();
      for (const bin of remainingBins) {
        remainingBin.merge(bin, this.model.renameSignal.bind(this.model));
      }
      this.setMutated();
    }
    this.setContinue();
    return this.flags;
  }
}

/**
 * This optimizer takes output nodes that are at a fork and moves them before the fork.
 *
 * The algorithm iterates over the children and tries to find the last output node in a cahin of output nodes.
 * It then moves all output nodes before that main output node. All other children (and the children of the output nodes)
 * are inserted after the main output node.
 */
export class MergeOutputs extends BottomUpOptimizer {
  public run(node: DataFlowNode) {
    const parent = node.parent;
    const children = [...parent.children];
    const hasOutputChild = some(children, child => child instanceof OutputNode);

    if (!hasOutputChild || parent.numChildren() <= 1) {
      this.setContinue();
      return this.flags;
    }

    const otherChildren: DataFlowNode[] = [];

    // The output node we will connect all other nodes to
    // output nodes will be added before, other nodes after
    let mainOutput: OutputNode;

    for (const child of children) {
      if (child instanceof OutputNode) {
        let lastOutput = child;

        while (lastOutput.numChildren() === 1) {
          const theChild = lastOutput.children[0];
          if (theChild instanceof OutputNode) {
            lastOutput = theChild;
          } else {
            break;
          }
        }

        otherChildren.push(...lastOutput.children);

        if (mainOutput) {
          // Move the output nodes before the mainOutput. We do this by setting
          // the parent of the first not to the parent of the main output and
          // the main output's parent to the last output.

          // note: the child is the first output
          parent.removeChild(child);
          child.parent = mainOutput.parent;

          mainOutput.parent.removeChild(mainOutput);
          mainOutput.parent = lastOutput;

          this.setMutated();
        } else {
          mainOutput = lastOutput;
        }
      } else {
        otherChildren.push(child);
      }
    }

    if (otherChildren.length) {
      this.setMutated();
      for (const child of otherChildren) {
        child.parent.removeChild(child);
        child.parent = mainOutput;
      }
    }

    this.setContinue();
    return this.flags;
  }
}
