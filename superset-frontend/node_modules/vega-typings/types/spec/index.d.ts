import { AutoSize } from './autosize';
import { Color } from './color';
import { Config } from './config';
import { Encodable, EncodeEntry } from './encode';
import { Padding } from './padding';
import { Scope } from './scope';
import { SignalRef } from './signal';

export interface Spec extends Scope, Encodable<EncodeEntry> {
  $schema?: string;
  config?: Config;
  description?: string;
  width?: number | SignalRef;
  height?: number | SignalRef;
  padding?: Padding | SignalRef;
  autosize?: AutoSize | SignalRef;
  background?: Color | SignalRef;
  style?: string | string[];
}

export * from './autosize';
export * from './axis';
export * from './bind';
export * from './color';
export * from './config';
export * from './data';
export * from './encode';
export * from './expr';
export * from './layout';
export * from './legend';
export * from './locale';
export * from './mark';
export * from './marktype';
export * from './on-events';
export * from './on-trigger';
export * from './padding';
export * from './projection';
export * from './scale';
export * from './scheme';
export * from './scope';
export * from './selector';
export * from './signal';
export * from './stream';
export * from './title';
export * from './transform';
export * from './util';
export * from './values';
