import {Legend as VgLegend} from 'vega';
import {NonPositionScaleChannel} from '../../channel';
import {COMMON_LEGEND_PROPERTY_INDEX, Legend} from '../../legend';
import {Flag, keys} from '../../util';
import {Split} from '../split';

export type LegendComponentProps = VgLegend & {
  labelExpr?: string;
  selections?: string[];
};

const LEGEND_COMPONENT_PROPERTY_INDEX: Flag<keyof LegendComponentProps> = {
  ...COMMON_LEGEND_PROPERTY_INDEX,
  labelExpr: 1,
  selections: 1,
  // channel scales
  opacity: 1,
  shape: 1,
  stroke: 1,
  fill: 1,
  size: 1,
  strokeWidth: 1,
  strokeDash: 1,
  // encode
  encode: 1
};

export const LEGEND_COMPONENT_PROPERTIES = keys(LEGEND_COMPONENT_PROPERTY_INDEX);

export class LegendComponent extends Split<LegendComponentProps> {}

export type LegendComponentIndex = {[P in NonPositionScaleChannel]?: LegendComponent};

export type LegendIndex = {[P in NonPositionScaleChannel]?: Legend};
