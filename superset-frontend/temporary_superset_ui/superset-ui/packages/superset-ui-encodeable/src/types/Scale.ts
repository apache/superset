import { Value, DateTime, ScaleType, SchemeParams } from './VegaLite';

export interface Scale<Output extends Value = Value> {
  type?: ScaleType;
  domain?: number[] | string[] | boolean[] | DateTime[];
  paddingInner?: number;
  paddingOuter?: number;
  range?: Output[];
  clamp?: boolean;
  nice?: boolean;
  /** color scheme name */
  scheme?: string | SchemeParams;
  /** vega-lite does not have this */
  namespace?: string;
}

export interface WithScale<Output extends Value = Value> {
  scale?: Scale<Output>;
}
