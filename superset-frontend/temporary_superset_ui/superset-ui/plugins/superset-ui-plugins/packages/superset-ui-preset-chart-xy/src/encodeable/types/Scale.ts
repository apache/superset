import { Value } from 'vega-lite/build/src/channeldef';
import { DateTime } from 'vega-lite/build/src/datetime';
import { SchemeParams, ScaleType } from 'vega-lite/build/src/scale';

export interface Scale<Output extends Value = Value> {
  type?: ScaleType;
  domain?: number[] | string[] | boolean[] | DateTime[];
  paddingInner?: number;
  paddingOuter?: number;
  range?: Output[];
  clamp?: boolean;
  nice?: boolean;
  scheme?: string | SchemeParams;
  /** vega-lite does not have this */
  namespace?: string;
}

export interface WithScale<Output extends Value = Value> {
  scale?: Scale<Output>;
}
