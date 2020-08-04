import {NonPositionScaleChannel, PositionScaleChannel, ScaleChannel} from './channel';

export type ResolveMode = 'independent' | 'shared';

/**
 * Defines how scales, axes, and legends from different specs should be combined. Resolve is a mapping from `scale`, `axis`, and `legend` to a mapping from channels to resolutions. Scales and guides can be resolved to be `"independent"` or `"shared"`.
 */
export interface Resolve {
  scale?: ScaleResolveMap;

  axis?: AxisResolveMap;

  legend?: LegendResolveMap;
}

export type ScaleResolveMap = {[C in ScaleChannel]?: ResolveMode};

export type AxisResolveMap = {[C in PositionScaleChannel]?: ResolveMode};

export type LegendResolveMap = {[C in NonPositionScaleChannel]?: ResolveMode};
