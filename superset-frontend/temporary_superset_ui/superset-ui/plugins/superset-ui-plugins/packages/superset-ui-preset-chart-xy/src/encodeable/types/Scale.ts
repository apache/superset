import { ScaleType } from 'vega-lite/build/src/scale';
import { Value } from 'vega-lite/build/src/fielddef';

export interface Scale<Output extends Value = Value> {
  type?: ScaleType;
  domain?: any[];
  range?: Output[];
  scheme?: string;
}

export interface WithScale<Output extends Value = Value> {
  scale?: Scale<Output>;
}
