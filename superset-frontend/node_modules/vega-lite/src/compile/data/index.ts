import {Parse} from '../../data';
import {Dict} from '../../util';
import {Split} from '../split';
import {OutputNode} from './dataflow';
import {FacetNode} from './facet';
import {SourceNode} from './source';

export interface DataComponent {
  /**
   * A list of unique sources.
   */
  sources: SourceNode[];

  /**
   * Registry of output nodes.
   */
  outputNodes: Dict<OutputNode | FacetNode>;

  /**
   * How often is an output node used. If it is not used, we don't need to
   * instantiate it in the assemble step.
   */
  outputNodeRefCounts: Dict<number>;

  /**
   * The output node before aggregation.
   */
  raw?: OutputNode;

  /**
   * The main output node.
   */
  main?: OutputNode;

  /**
   * For facets, we store the reference to the root node.
   */
  facetRoot?: FacetNode;

  /**
   * True if the data for this model is faceted.
   * A dataset is faceted if a parent model is a facet and no new dataset is
   * defined (which would make the data unfaceted again).
   */
  isFaceted: boolean;

  /**
   * Parse properties passed down from ancestors. Helps us to keep track of what has been parsed or is derived.
   */
  ancestorParse?: AncestorParse;
}

/**
 * Class to track interesting properties (see https://15721.courses.cs.cmu.edu/spring2016/papers/graefe-ieee1995.pdf)
 * about how fields have been parsed or whether they have been derived in a transform. We use this to not parse the
 * same field again (or differently).
 */
export class AncestorParse extends Split<Parse> {
  constructor(
    public readonly explicit: Partial<Parse> = {},
    public readonly implicit: Partial<Parse> = {},
    public parseNothing = false
  ) {
    super(explicit, implicit);
  }

  public clone(): AncestorParse {
    const clone = super.clone() as AncestorParse;
    clone.parseNothing = this.parseNothing;
    return clone;
  }
}
